/**
 * Colombia uses America/Bogota (UTC-5, no DST).
 * Offset in minutes: local time = UTC - 5 hours.
 */
export const COLOMBIA_UTC_OFFSET_MINUTES = -300

const MINUTES_PER_DAY = 24 * 60
const DEFAULT_MAX_BREAK_DURATION_MINUTES = 12 * 60

export interface LocalDateParts {
  year: number
  monthIndex: number
  day: number
}

export interface LocalTimeParts {
  hours: number
  minutes: number
  seconds: number
  totalMinutes: number
}

export interface BusinessBreakIntervalInput {
  date: string
  timeFrom: string
  timeTo: string
  offsetMinutes?: number
  maxDurationMinutes?: number
}

export interface BusinessBreakInterval {
  startIso: string
  endIso: string
  durationMinutes: number
  businessDayStartIso: string
  businessDayEndIso: string
}

/**
 * Compute the start and end of "today" in ISO strings, adjusted for a given
 * UTC offset so that "today" matches the viewer's local calendar day.
 *
 * @param offsetMinutes UTC offset in minutes (e.g. -300 for EST, 60 for CET).
 *                      When omitted or 0, uses UTC.
 */
export function getTodayBounds(offsetMinutes: number = 0): { start: string; end: string } {
  const now = new Date()

  // Shift "now" by the offset so UTC date parts give the local calendar date
  const adjusted = new Date(now.getTime() + offsetMinutes * 60 * 1000)

  const y = adjusted.getUTCFullYear()
  const m = adjusted.getUTCMonth()
  const d = adjusted.getUTCDate()

  // Start of that calendar day in the given timezone, as a UTC instant
  const startMs = Date.UTC(y, m, d, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  // End = start + 24h - 1ms
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  }
}

/**
 * Compute day bounds for a local calendar date (YYYY-MM-DD) for a viewer's UTC offset.
 * Invalid dates fall back to today's bounds.
 */
export function getDayBounds(
  targetDate: string | null | undefined,
  offsetMinutes: number = 0
): { start: string; end: string } {
  if (!targetDate) return getTodayBounds(offsetMinutes)

  const parts = parseLocalDate(targetDate)
  if (!parts) return getTodayBounds(offsetMinutes)

  return getLocalDayBoundsFromParts(parts, offsetMinutes)
}

export function getBusinessDayBounds(
  targetDate: string,
  offsetMinutes: number = COLOMBIA_UTC_OFFSET_MINUTES
): { start: string; end: string } {
  const parts = parseLocalDate(targetDate)
  if (!parts) {
    throw new Error('Invalid business date')
  }

  return getLocalDayBoundsFromParts(parts, offsetMinutes)
}

export function buildBusinessBreakInterval({
  date,
  timeFrom,
  timeTo,
  offsetMinutes = COLOMBIA_UTC_OFFSET_MINUTES,
  maxDurationMinutes = DEFAULT_MAX_BREAK_DURATION_MINUTES,
}: BusinessBreakIntervalInput): BusinessBreakInterval {
  const dateParts = parseLocalDate(date)
  if (!dateParts) {
    throw new Error('Invalid break date')
  }

  const startTime = parseLocalTime(timeFrom)
  const endTime = parseLocalTime(timeTo)
  if (!startTime || !endTime) {
    throw new Error('Invalid break time')
  }

  if (endTime.totalMinutes === startTime.totalMinutes) {
    throw new Error('Break end time must be different from break start time')
  }

  const endDayOffset = endTime.totalMinutes < startTime.totalMinutes ? 1 : 0
  const startMs = localDateTimeToUtcMs(dateParts, startTime, offsetMinutes)
  const endMs = localDateTimeToUtcMs(dateParts, endTime, offsetMinutes, endDayOffset)
  const durationMinutes = (endMs - startMs) / (60 * 1000)

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Break interval must be positive')
  }

  if (durationMinutes > maxDurationMinutes) {
    throw new Error(`Break interval must not exceed ${maxDurationMinutes} minutes`)
  }

  const businessDayBounds = getLocalDayBoundsFromParts(dateParts, offsetMinutes)

  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    durationMinutes,
    businessDayStartIso: businessDayBounds.start,
    businessDayEndIso: businessDayBounds.end,
  }
}

function getLocalDayBoundsFromParts(
  parts: LocalDateParts,
  offsetMinutes: number
): { start: string; end: string } {
  const startMs = Date.UTC(parts.year, parts.monthIndex, parts.day, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  const endMs = startMs + MINUTES_PER_DAY * 60 * 1000 - 1

  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  }
}

function localDateTimeToUtcMs(
  dateParts: LocalDateParts,
  timeParts: LocalTimeParts,
  offsetMinutes: number,
  dayOffset: number = 0
): number {
  return Date.UTC(
    dateParts.year,
    dateParts.monthIndex,
    dateParts.day + dayOffset,
    timeParts.hours,
    timeParts.minutes,
    timeParts.seconds,
    0
  ) - offsetMinutes * 60 * 1000
}

function parseLocalDate(value: string): LocalDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const monthIndex = month - 1
  const roundTrip = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0))

  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== monthIndex ||
    roundTrip.getUTCDate() !== day
  ) {
    return null
  }

  return { year, monthIndex, day }
}

function parseLocalTime(value: string): LocalTimeParts | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] ? Number(match[3]) : 0

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null
  }

  return {
    hours,
    minutes,
    seconds,
    totalMinutes: hours * 60 + minutes + seconds / 60,
  }
}
