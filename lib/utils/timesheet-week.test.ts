import { describe, it, expect } from 'vitest'
import {
  getWeekStart,
  getWeekEnd,
  isDateInRange,
  formatWeekRange,
  formatMinutes,
  calculateTimesheet,
} from './timesheet'

describe('getWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    const wed = new Date(2026, 0, 21) // Jan 21, 2026 (Wed)
    const mon = getWeekStart(wed)
    expect(mon.getDay()).toBe(1)
    expect(mon.getDate()).toBe(19)
    expect(mon.getMonth()).toBe(0)
    expect(mon.getFullYear()).toBe(2026)
  })

  it('returns same Monday for a Monday', () => {
    const mon = new Date(2026, 0, 19)
    const start = getWeekStart(mon)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(19)
  })

  it('returns previous Monday for Sunday', () => {
    const sun = new Date(2026, 0, 25)
    const start = getWeekStart(sun)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(19)
  })

  it('handles week crossing month boundary', () => {
    const d = new Date(2026, 0, 31) // Sat Jan 31
    const start = getWeekStart(d)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(26)
    expect(start.getMonth()).toBe(0)
  })
})

describe('getWeekEnd', () => {
  it('returns Sunday of same week', () => {
    const mon = new Date(2026, 0, 19)
    const end = getWeekEnd(mon)
    expect(end.getDay()).toBe(0)
    expect(end.getDate()).toBe(25)
    expect(end.getMonth()).toBe(0)
  })
})

describe('isDateInRange', () => {
  it('returns true when date is within range', () => {
    expect(isDateInRange('2026-01-20', '2026-01-19', '2026-01-25')).toBe(true)
    expect(isDateInRange('2026-01-19', '2026-01-19', '2026-01-25')).toBe(true)
    expect(isDateInRange('2026-01-25', '2026-01-19', '2026-01-25')).toBe(true)
  })

  it('returns false when date is outside range', () => {
    expect(isDateInRange('2026-01-18', '2026-01-19', '2026-01-25')).toBe(false)
    expect(isDateInRange('2026-01-26', '2026-01-19', '2026-01-25')).toBe(false)
  })
})

describe('formatWeekRange', () => {
  it('formats week range with year on end', () => {
    const start = new Date(2026, 0, 19)
    const end = new Date(2026, 0, 25)
    const s = formatWeekRange(start, end)
    expect(s).toMatch(/Jan.*19.*to.*Jan.*25.*2026/)
  })

  it('handles week crossing two months', () => {
    const start = new Date(2026, 0, 27)
    const end = new Date(2026, 1, 2)
    const s = formatWeekRange(start, end)
    expect(s).toMatch(/Jan.*27.*to.*Feb.*2.*2026/)
  })
})

describe('formatMinutes', () => {
  it('formats positive minutes as hours:minutes', () => {
    expect(formatMinutes(90)).toBe('1:30')
    expect(formatMinutes(480)).toBe('8:00')
  })
  it('formats negative minutes with sign', () => {
    expect(formatMinutes(-30)).toBe('-0:30')
  })
})

describe('weekly totals (via calculateTimesheet)', () => {
  it('week with no entries has zero work and zero days worked', () => {
    const start = new Date(2026, 0, 19)
    const end = new Date(2026, 0, 25)
    const entries = calculateTimesheet([], [], [], [], start, end)
    const totalWork = entries.reduce((s, e) => s + e.workMinutes, 0)
    const daysWorked = entries.filter(e => e.workMinutes > 0).length
    expect(entries.length).toBe(7)
    expect(totalWork).toBe(0)
    expect(daysWorked).toBe(0)
  })

  it('week crossing month boundary includes all 7 days', () => {
    const start = new Date(2026, 0, 27)
    const end = new Date(2026, 1, 2)
    const entries = calculateTimesheet([], [], [], [], start, end)
    expect(entries.length).toBe(7)
    const dates = entries.map(e => e.date)
    expect(dates).toContain('2026-01-27')
    expect(dates).toContain('2026-02-02')
  })
})
