/**
 * Colombia uses America/Bogota (UTC-5, no DST).
 * Offset in minutes: local time = UTC + 5 hours for "date in Colombia" when deriving calendar date.
 */
export const COLOMBIA_UTC_OFFSET_MINUTES = 300

export interface ColombiaDateParts {
  y: number
  m: number
  d: number
  dayOfWeek: number
}

/**
 * Get the calendar date and day-of-week in Colombian timezone for a given instant.
 */
export function getColombiaDateParts(instant: Date): ColombiaDateParts {
  const colombiaAdjusted = new Date(instant.getTime() + COLOMBIA_UTC_OFFSET_MINUTES * 60 * 1000)
  const y = colombiaAdjusted.getUTCFullYear()
  const m = colombiaAdjusted.getUTCMonth()
  const d = colombiaAdjusted.getUTCDate()
  const dayOfWeek = new Date(Date.UTC(y, m, d, 12, 0, 0)).getUTCDay()
  return { y, m, d, dayOfWeek }
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
    Date.UTC(parts.y, parts.m, parts.d, startHour + 5, startMin, 0)
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
