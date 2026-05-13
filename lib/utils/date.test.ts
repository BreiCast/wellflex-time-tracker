import { describe, expect, it } from 'vitest'
import { buildBusinessBreakInterval } from './date'

describe('buildBusinessBreakInterval', () => {
  it('builds UTC timestamps for a same-day Colombia break', () => {
    const interval = buildBusinessBreakInterval({
      date: '2026-02-21',
      timeFrom: '12:00',
      timeTo: '12:30',
    })

    expect(interval.startIso).toBe('2026-02-21T17:00:00.000Z')
    expect(interval.endIso).toBe('2026-02-21T17:30:00.000Z')
    expect(interval.durationMinutes).toBe(30)
    expect(interval.businessDayStartIso).toBe('2026-02-21T05:00:00.000Z')
    expect(interval.businessDayEndIso).toBe('2026-02-22T04:59:59.999Z')
  })

  it('treats a break end before start as an overnight Colombia break', () => {
    const interval = buildBusinessBreakInterval({
      date: '2026-02-21',
      timeFrom: '23:30',
      timeTo: '00:15',
    })

    expect(interval.startIso).toBe('2026-02-22T04:30:00.000Z')
    expect(interval.endIso).toBe('2026-02-22T05:15:00.000Z')
    expect(interval.durationMinutes).toBe(45)
    expect(interval.businessDayStartIso).toBe('2026-02-21T05:00:00.000Z')
    expect(interval.businessDayEndIso).toBe('2026-02-22T04:59:59.999Z')
  })

  it('rejects equal break start and end times', () => {
    expect(() =>
      buildBusinessBreakInterval({
        date: '2026-02-21',
        timeFrom: '12:00',
        timeTo: '12:00',
      })
    ).toThrow('Break end time must be different from break start time')
  })

  it('rejects unreasonably long break intervals', () => {
    expect(() =>
      buildBusinessBreakInterval({
        date: '2026-02-21',
        timeFrom: '12:00',
        timeTo: '11:59',
      })
    ).toThrow('Break interval must not exceed 720 minutes')
  })
})
