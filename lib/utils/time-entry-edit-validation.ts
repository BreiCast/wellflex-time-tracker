export type TimeEntryEditValidationError = {
  error: string
  status: number
}

export type TimeSessionEditValidationResult = {
  session: any
  newClockIn: string | null
  newClockOut: string | null
  finalClockIn: string | null
  finalClockOut: string | null
}

export type BreakSegmentEditValidationResult = {
  breakSegment: any
  newBreakStart: string | null
  newBreakEnd: string | null
  finalBreakStart: string | null
  finalBreakEnd: string | null
}

type ScopedEdit = {
  userId?: string | null
  teamId?: string | null
}

export function normalizeIso(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp')
  }
  return date.toISOString()
}

function toTime(value?: string | null, fallback: number = Number.POSITIVE_INFINITY): number {
  if (!value) return fallback
  return new Date(value).getTime()
}

function rangesOverlap(
  startA?: string | null,
  endA?: string | null,
  startB?: string | null,
  endB?: string | null
) {
  if (!startA || !startB) return false
  return toTime(startA) < toTime(endB) && toTime(endA) > toTime(startB)
}

export async function validateTimeSessionEdit(
  supabase: any,
  params: ScopedEdit & {
    timeSessionId: string
    newClockInAt?: string | null
    newClockOutAt?: string | null
  }
): Promise<TimeSessionEditValidationResult | TimeEntryEditValidationError> {
  let sessionQuery = supabase
    .from('time_sessions')
    .select('id, user_id, team_id, clock_in_at, clock_out_at')
    .eq('id', params.timeSessionId)

  if (params.userId) sessionQuery = sessionQuery.eq('user_id', params.userId)
  if (params.teamId) sessionQuery = sessionQuery.eq('team_id', params.teamId)

  const { data: session } = await sessionQuery.single()
  if (!session) return { error: 'Time session not found', status: 404 }

  const newClockIn = normalizeIso(params.newClockInAt)
  const newClockOut = normalizeIso(params.newClockOutAt)
  const finalClockIn = newClockIn ?? session.clock_in_at ?? null
  const finalClockOut = newClockOut ?? session.clock_out_at ?? null

  if (finalClockIn && finalClockOut && toTime(finalClockOut) <= toTime(finalClockIn)) {
    return { error: 'Clock out must be after clock in', status: 400 }
  }

  const { data: otherSessions, error } = await supabase
    .from('time_sessions')
    .select('id, clock_in_at, clock_out_at')
    .eq('user_id', session.user_id)
    .eq('team_id', session.team_id)
    .neq('id', session.id)

  if (error) return { error: error.message, status: 400 }

  const overlappingSession = (otherSessions || []).find((otherSession: any) =>
    rangesOverlap(
      finalClockIn,
      finalClockOut,
      otherSession.clock_in_at,
      otherSession.clock_out_at
    )
  )

  if (overlappingSession) {
    return { error: 'Time session overlaps another session for this user and team', status: 400 }
  }

  return { session, newClockIn, newClockOut, finalClockIn, finalClockOut }
}

export async function validateBreakSegmentEdit(
  supabase: any,
  params: ScopedEdit & {
    breakSegmentId: string
    newBreakStartAt?: string | null
    newBreakEndAt?: string | null
  }
): Promise<BreakSegmentEditValidationResult | TimeEntryEditValidationError> {
  let breakQuery = supabase
    .from('break_segments')
    .select('id, break_start_at, break_end_at, time_session_id, time_sessions!inner(user_id, team_id, clock_in_at, clock_out_at)')
    .eq('id', params.breakSegmentId)

  if (params.userId) breakQuery = breakQuery.eq('time_sessions.user_id', params.userId)
  if (params.teamId) breakQuery = breakQuery.eq('time_sessions.team_id', params.teamId)

  const { data: breakSegment } = await breakQuery.single()
  if (!breakSegment) return { error: 'Break segment not found', status: 404 }

  const parentSession = breakSegment.time_sessions ?? null
  if (!parentSession?.clock_in_at) {
    return { error: 'Parent time session not found', status: 404 }
  }

  const newBreakStart = normalizeIso(params.newBreakStartAt)
  const newBreakEnd = normalizeIso(params.newBreakEndAt)
  const finalBreakStart = newBreakStart ?? breakSegment.break_start_at ?? null
  const finalBreakEnd = newBreakEnd ?? breakSegment.break_end_at ?? null

  if (finalBreakStart && finalBreakEnd && toTime(finalBreakEnd) <= toTime(finalBreakStart)) {
    return { error: 'Break end must be after break start', status: 400 }
  }

  if (finalBreakStart && toTime(finalBreakStart) < toTime(parentSession.clock_in_at)) {
    return { error: 'Break cannot start before clock in', status: 400 }
  }

  if (parentSession.clock_out_at && finalBreakEnd && toTime(finalBreakEnd) > toTime(parentSession.clock_out_at)) {
    return { error: 'Break cannot end after clock out', status: 400 }
  }

  const { data: siblingBreaks, error } = await supabase
    .from('break_segments')
    .select('id, break_start_at, break_end_at')
    .eq('time_session_id', breakSegment.time_session_id)
    .neq('id', breakSegment.id)

  if (error) return { error: error.message, status: 400 }

  const overlappingBreak = (siblingBreaks || []).find((siblingBreak: any) =>
    rangesOverlap(
      finalBreakStart,
      finalBreakEnd,
      siblingBreak.break_start_at,
      siblingBreak.break_end_at
    )
  )

  if (overlappingBreak) {
    return { error: 'Break segment overlaps another break for this time session', status: 400 }
  }

  return { breakSegment, newBreakStart, newBreakEnd, finalBreakStart, finalBreakEnd }
}

export function isTimeEntryEditValidationError(
  result: TimeSessionEditValidationResult | BreakSegmentEditValidationResult | TimeEntryEditValidationError
): result is TimeEntryEditValidationError {
  return typeof (result as TimeEntryEditValidationError).error === 'string'
}
