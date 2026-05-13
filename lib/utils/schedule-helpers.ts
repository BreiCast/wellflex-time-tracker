import { COLOMBIA_UTC_OFFSET_MINUTES } from './date'
export { COLOMBIA_UTC_OFFSET_MINUTES } from './date'

export interface LocalDateParts {
  y: number
  m: number
  d: number
  dayOfWeek: number
}

export type ColombiaDateParts = LocalDateParts

export interface UtcDayBounds {
  start: Date
  end: Date
}

/**
 * Get the calendar date and day-of-week for a fixed UTC offset.
 */
export function getDatePartsForOffset(instant: Date, offsetMinutes: number): LocalDateParts {
  const localAdjusted = new Date(
    instant.getTime() + offsetMinutes * 60 * 1000
  )
  const y = localAdjusted.getUTCFullYear()
  const m = localAdjusted.getUTCMonth()
  const d = localAdjusted.getUTCDate()
  const dayOfWeek = new Date(Date.UTC(y, m, d, 12, 0, 0)).getUTCDay()
  return { y, m, d, dayOfWeek }
}

/**
 * Return UTC instants bounding the local calendar day for a fixed UTC offset.
 * The end instant is exclusive and is exactly 24 hours after the start instant.
 */
export function getUtcDayBoundsForOffset(
  instant: Date,
  offsetMinutes: number
): UtcDayBounds {
  const parts = getDatePartsForOffset(instant, offsetMinutes)
  const startMs =
    Date.UTC(parts.y, parts.m, parts.d, 0, 0, 0, 0) - offsetMinutes * 60 * 1000
  const endMs = startMs + 24 * 60 * 60 * 1000

  return {
    start: new Date(startMs),
    end: new Date(endMs),
  }
}

/**
 * Get the calendar date and day-of-week in Colombian timezone for a given instant.
 */
export function getColombiaDateParts(instant: Date): ColombiaDateParts {
  return getDatePartsForOffset(instant, COLOMBIA_UTC_OFFSET_MINUTES)
}

/**
 * Return UTC instants bounding the Colombian business calendar day.
 */
export function getColombiaBusinessDayUtcBounds(
  instant: Date = new Date()
): UtcDayBounds {
  return getUtcDayBoundsForOffset(instant, COLOMBIA_UTC_OFFSET_MINUTES)
}

/**
 * Pure function: compute whether clock-in is late and the scheduled start instant,
 * interpreting the schedule in Colombian timezone.
 */
export function computeLateCheckInColombia(
  clockInTime: Date,
  startTimeStr: string
): { isLate: boolean; scheduledStart: Date } {
  const parts = getColombiaDateParts(clockInTime)
  const [startHour, startMin] = startTimeStr.split(':').map(Number)
  // That calendar day at start_time in Colombia → UTC instant (09:00 Colombia = 14:00 UTC)
  const scheduledStart = new Date(
    Date.UTC(
      parts.y,
      parts.m,
      parts.d,
      startHour - COLOMBIA_UTC_OFFSET_MINUTES / 60,
      startMin,
      0
    )
  )
  const isLate = clockInTime > scheduledStart
  return { isLate, scheduledStart }
}

/**
 * Check if a clock-in time is late compared to the scheduled start time (Colombian timezone).
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param teamId - Team ID
 * @param clockInTime - The clock-in timestamp
 * @returns Object with isLate flag, scheduledStart time, and grace period
 */
export async function checkIfLateClockIn(
  supabase: any,
  userId: string,
  teamId: string,
  clockInTime: Date
): Promise<{ isLate: boolean; scheduledStart: Date | null; gracePeriodMinutes: number }> {
  const { dayOfWeek } = getColombiaDateParts(clockInTime)

  const { data: schedule } = await supabase
    .from('schedules')
    .select('start_time')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (!schedule) {
    return { isLate: false, scheduledStart: null, gracePeriodMinutes: 0 }
  }

  const { isLate, scheduledStart } = computeLateCheckInColombia(clockInTime, schedule.start_time)
  const gracePeriodMinutes = 0
  return { isLate, scheduledStart, gracePeriodMinutes }
}
