import { describe, expect, it } from 'vitest'
import { computeLateCheckInColombia, getColombiaDateParts } from './schedule-helpers'

describe('schedule-helpers Colombia timezone', () => {
  it('derives Colombia day-of-week across UTC boundary', () => {
    // 2026-02-22 04:30 UTC == 2026-02-21 23:30 Colombia
    const instant = new Date(Date.UTC(2026, 1, 22, 4, 30, 0))
    const { dayOfWeek, y, m, d } = getColombiaDateParts(instant)
    expect(y).toBe(2026)
    expect(m).toBe(1)
    expect(d).toBe(21)
    // 2026-02-21 is Saturday (6)
    expect(dayOfWeek).toBe(6)
  })

  it('computes scheduled start in UTC for Colombia schedule', () => {
    const clockInTime = new Date(Date.UTC(2026, 1, 22, 14, 1, 0)) // 09:01 Colombia
    const { isLate, scheduledStart } = computeLateCheckInColombia(clockInTime, '09:00')
    expect(isLate).toBe(true)
    expect(scheduledStart.toISOString()).toBe('2026-02-22T14:00:00.000Z')
  })
})
