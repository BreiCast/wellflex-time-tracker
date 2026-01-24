/**
 * Check if a clock-in time is late compared to the scheduled start time
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
  // Get today's schedule for user and team
  const dayOfWeek = clockInTime.getDay()
  const { data: schedule } = await supabase
    .from('schedules')
    .select('start_time')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (!schedule) {
    // No schedule means not late
    return { isLate: false, scheduledStart: null, gracePeriodMinutes: 0 }
  }

  // Parse scheduled start time
  const [startHour, startMin] = schedule.start_time.split(':').map(Number)
  const scheduledStart = new Date(clockInTime)
  scheduledStart.setHours(startHour, startMin, 0, 0)

  // Get grace period from org settings (default 0 - no grace period)
  // For now, we'll use 0 as default. Can be extended later with org settings
  const gracePeriodMinutes = 0
  const gracePeriodEnd = new Date(scheduledStart.getTime() + gracePeriodMinutes * 60 * 1000)

  const isLate = clockInTime > gracePeriodEnd

  return { isLate, scheduledStart, gracePeriodMinutes }
}
