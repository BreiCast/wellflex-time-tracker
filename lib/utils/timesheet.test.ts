import { describe, it, expect } from 'vitest'
import { calculateTimesheet } from './timesheet'

type Session = Parameters<typeof calculateTimesheet>[0][number]
type Break = Parameters<typeof calculateTimesheet>[1][number]
type Adjustment = Parameters<typeof calculateTimesheet>[3][number]

function session(partial: Partial<Session> & Pick<Session, 'clock_in_at'>): Session {
  return {
    id: 'session-1',
    user_id: 'user-1',
    team_id: 'team-1',
    clock_out_at: null,
    created_at: partial.clock_in_at,
    created_by: 'user-1',
    ...partial,
  } as Session
}

function adjustment(partial: Partial<Adjustment> & Pick<Adjustment, 'adjustment_type' | 'minutes' | 'effective_date'>): Adjustment {
  return {
    id: 'adj-1',
    user_id: 'user-1',
    team_id: 'team-1',
    created_at: '2026-07-15T00:00:00.000Z',
    created_by: 'user-1',
    description: null,
    request_id: null,
    time_session_id: null,
    ...partial,
  } as Adjustment
}

describe('calculateTimesheet — Colombia day bucketing', () => {
  it('buckets an evening shift by the Colombia calendar date, not UTC', () => {
    // 01:30 UTC on Jul 12 == 20:30 COT on Jul 11 (UTC-5). The whole shift is Jul 11.
    const s = session({
      clock_in_at: '2026-07-12T01:30:00.000Z',
      clock_out_at: '2026-07-12T03:30:00.000Z', // 22:30 COT Jul 11
    })

    const entries = calculateTimesheet([s], [], [], [], '2026-07-11', '2026-07-12')

    const jul11 = entries.find((e) => e.date === '2026-07-11')!
    const jul12 = entries.find((e) => e.date === '2026-07-12')!

    expect(jul11.totalMinutes).toBe(120)
    expect(jul11.workMinutes).toBe(120)
    expect(jul11.sessions).toHaveLength(1)
    expect(jul12.totalMinutes).toBe(0)
    expect(jul12.workMinutes).toBe(0)
  })

  it('buckets a break by the Colombia calendar date of its start', () => {
    const s = session({
      id: 'session-eve',
      clock_in_at: '2026-07-12T01:00:00.000Z', // 20:00 COT Jul 11
      clock_out_at: '2026-07-12T04:00:00.000Z', // 23:00 COT Jul 11 (180 min)
    })
    const b: Break = {
      id: 'break-1',
      time_session_id: 'session-eve',
      break_type: 'BREAK',
      break_start_at: '2026-07-12T02:00:00.000Z', // 21:00 COT Jul 11
      break_end_at: '2026-07-12T02:15:00.000Z', // 15 min
    } as Break

    const entries = calculateTimesheet([s], [b], [], [], '2026-07-11', '2026-07-12')
    const jul11 = entries.find((e) => e.date === '2026-07-11')!

    expect(jul11.breakMinutes).toBe(15)
    expect(jul11.workMinutes).toBe(165) // 180 worked - 15 break
    expect(jul11.breaks).toHaveLength(1)
  })
})

describe('calculateTimesheet — adjustments', () => {
  const base = session({
    clock_in_at: '2026-07-15T13:00:00.000Z', // 08:00 COT
    clock_out_at: '2026-07-15T21:00:00.000Z', // 16:00 COT -> 480 min
  })

  it('OVERRIDE replaces the day total with exactly `minutes`', () => {
    const adj = adjustment({ adjustment_type: 'OVERRIDE', minutes: 300, effective_date: '2026-07-15' })

    const entries = calculateTimesheet([base], [], [], [adj], '2026-07-15', '2026-07-15')
    const day = entries.find((e) => e.date === '2026-07-15')!

    expect(day.totalMinutes).toBe(480)
    expect(day.workMinutes).toBe(300) // overridden, not 480 + 300
  })

  it('ADD_TIME adds on top of worked minutes', () => {
    const adj = adjustment({ adjustment_type: 'ADD_TIME', minutes: 60, effective_date: '2026-07-15' })

    const entries = calculateTimesheet([base], [], [], [adj], '2026-07-15', '2026-07-15')
    const day = entries.find((e) => e.date === '2026-07-15')!

    expect(day.workMinutes).toBe(540) // 480 + 60
  })

  it('SUBTRACT_TIME reduces worked minutes', () => {
    const adj = adjustment({ adjustment_type: 'SUBTRACT_TIME', minutes: 90, effective_date: '2026-07-15' })

    const entries = calculateTimesheet([base], [], [], [adj], '2026-07-15', '2026-07-15')
    const day = entries.find((e) => e.date === '2026-07-15')!

    expect(day.workMinutes).toBe(390) // 480 - 90
  })

  it('OVERRIDE on an empty day sets the day to exactly `minutes`', () => {
    const adj = adjustment({ adjustment_type: 'OVERRIDE', minutes: 240, effective_date: '2026-07-15' })

    const entries = calculateTimesheet([], [], [], [adj], '2026-07-15', '2026-07-15')
    const day = entries.find((e) => e.date === '2026-07-15')!

    expect(day.workMinutes).toBe(240) // base 0 -> override to 240
  })
})
