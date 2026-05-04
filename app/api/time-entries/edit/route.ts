import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { sendRequestConfirmationEmail, sendRequestNotificationEmail } from '@/lib/utils/email'
import { getRequestNotificationRecipientEmails } from '@/lib/utils/request-notification-recipients'
import { z } from 'zod'

const editTimeEntrySchema = z.object({
  edit_type: z.enum(['TIME_SESSION', 'BREAK_SEGMENT', 'NOTE']),
  time_session_id: z.string().uuid().optional(),
  break_segment_id: z.string().uuid().optional(),
  note_id: z.string().uuid().optional(),
  new_clock_in_at: z.string().optional(),
  new_clock_out_at: z.string().optional(),
  new_break_start_at: z.string().optional(),
  new_break_end_at: z.string().optional(),
  new_content: z.string().optional(),
  reason: z.string().optional(),
})

function normalizeIso(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp')
  }
  return date.toISOString()
}

function validateEditPayload(payload: z.infer<typeof editTimeEntrySchema>) {
  if (payload.edit_type === 'TIME_SESSION') {
    if (!payload.time_session_id) return 'time_session_id is required'
    if (!payload.new_clock_in_at && !payload.new_clock_out_at) return 'New clock-in or clock-out time is required'
    return null
  }
  if (payload.edit_type === 'BREAK_SEGMENT') {
    if (!payload.break_segment_id) return 'break_segment_id is required'
    if (!payload.new_break_start_at && !payload.new_break_end_at) return 'New break start or end time is required'
    return null
  }
  if (payload.edit_type === 'NOTE') {
    if (!payload.note_id) return 'note_id is required'
    if (typeof payload.new_content !== 'string' || payload.new_content.trim().length === 0) {
      return 'new_content is required'
    }
    return null
  }
  return 'Invalid edit type'
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const payload = editTimeEntrySchema.parse(body)
    const validationError = validateEditPayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const supabase = createServiceSupabaseClient()

    let teamId: string | null = null
    let targetUserId: string | null = null
    let timeSessionId: string | null = null
    let currentClockIn: string | null = null
    let currentClockOut: string | null = null
    let currentBreakStart: string | null = null
    let currentBreakEnd: string | null = null

    if (payload.edit_type === 'TIME_SESSION') {
      const { data: session } = await supabase
        .from('time_sessions')
        .select('id, user_id, team_id, clock_in_at, clock_out_at')
        .eq('id', payload.time_session_id!)
        .single()
      if (!session) return NextResponse.json({ error: 'Time session not found' }, { status: 404 })
      teamId = (session as any).team_id
      targetUserId = (session as any).user_id
      timeSessionId = (session as any).id
      currentClockIn = (session as any).clock_in_at
      currentClockOut = (session as any).clock_out_at
    } else if (payload.edit_type === 'BREAK_SEGMENT') {
      const { data: breakSeg } = await supabase
        .from('break_segments')
        .select('id, break_start_at, break_end_at, time_session_id, time_sessions!inner(user_id, team_id)')
        .eq('id', payload.break_segment_id!)
        .single()
      if (!breakSeg) return NextResponse.json({ error: 'Break segment not found' }, { status: 404 })
      teamId = (breakSeg as any).time_sessions?.team_id ?? null
      targetUserId = (breakSeg as any).time_sessions?.user_id ?? null
      timeSessionId = (breakSeg as any).time_session_id
      currentBreakStart = (breakSeg as any).break_start_at
      currentBreakEnd = (breakSeg as any).break_end_at
    } else if (payload.edit_type === 'NOTE') {
      const { data: note } = await supabase
        .from('notes')
        .select('id, time_session_id, time_sessions!inner(user_id, team_id)')
        .eq('id', payload.note_id!)
        .single()
      if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
      teamId = (note as any).time_sessions?.team_id ?? null
      targetUserId = (note as any).time_sessions?.user_id ?? null
      timeSessionId = (note as any).time_session_id
    }

    if (!teamId || !targetUserId) {
      return NextResponse.json({ error: 'Unable to resolve team or user for entry' }, { status: 400 })
    }

    let role: 'MANAGER' | 'ADMIN' | 'SUPERADMIN' | null = null
    if (isSuperAdmin(user)) {
      role = 'SUPERADMIN'
    } else {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()
      const memberRole = (teamMember as { role?: string } | null)?.role
      if (memberRole === 'ADMIN') role = 'ADMIN'
      if (memberRole === 'MANAGER') role = 'MANAGER'
    }

    if (!role) {
      return NextResponse.json({ error: 'Only managers and admins can edit time entries' }, { status: 403 })
    }

    const newClockIn = normalizeIso(payload.new_clock_in_at)
    const newClockOut = normalizeIso(payload.new_clock_out_at)
    const newBreakStart = normalizeIso(payload.new_break_start_at)
    const newBreakEnd = normalizeIso(payload.new_break_end_at)

    if (payload.edit_type === 'TIME_SESSION') {
      const finalClockIn = newClockIn ?? currentClockIn
      const finalClockOut = newClockOut ?? currentClockOut
      if (finalClockIn && finalClockOut && new Date(finalClockOut) < new Date(finalClockIn)) {
        return NextResponse.json({ error: 'Clock out must be after clock in' }, { status: 400 })
      }
    }
    if (payload.edit_type === 'BREAK_SEGMENT') {
      const finalBreakStart = newBreakStart ?? currentBreakStart
      const finalBreakEnd = newBreakEnd ?? currentBreakEnd
      if (finalBreakStart && finalBreakEnd && new Date(finalBreakEnd) < new Date(finalBreakStart)) {
        return NextResponse.json({ error: 'Break end must be after break start' }, { status: 400 })
      }
    }

    const requestedData = {
      edit_type: payload.edit_type,
      time_session_id: payload.time_session_id || timeSessionId || null,
      break_segment_id: payload.break_segment_id || null,
      note_id: payload.note_id || null,
      new_clock_in_at: newClockIn,
      new_clock_out_at: newClockOut,
      new_break_start_at: newBreakStart,
      new_break_end_at: newBreakEnd,
      new_content: payload.new_content?.trim() || null,
      original_clock_in_at: currentClockIn,
      original_clock_out_at: currentClockOut,
      original_break_start_at: currentBreakStart,
      original_break_end_at: currentBreakEnd,
      reason: payload.reason || null,
    }

    const description = payload.reason?.trim() || 'Time entry edit request'

    if (role === 'MANAGER') {
      const { data: requestRow, error: requestError } = await supabase
        .from('requests')
        .insert({
          user_id: targetUserId,
          team_id: teamId,
          time_session_id: timeSessionId,
          request_type: 'Time Entry Edit',
          description,
          requested_data: requestedData,
          status: 'PENDING',
          created_by: user.id,
        } as any)
        .select()
        .single()

      if (requestError) {
        return NextResponse.json({ error: requestError.message }, { status: 400 })
      }

      Promise.all([
        supabase.from('users').select('email, full_name').eq('id', user.id).single(),
        supabase.from('users').select('email, full_name').eq('id', targetUserId).single(),
        supabase.from('teams').select('name').eq('id', teamId).single(),
      ])
        .then(async ([managerRes, employeeRes, teamRes]) => {
          if (managerRes.error || !managerRes.data) {
            console.error('[EMAIL] manager user fetch for time edit request:', managerRes.error)
            return
          }
          if (employeeRes.error || !employeeRes.data) {
            console.error('[EMAIL] employee user fetch for time edit request:', employeeRes.error)
            return
          }
          if (teamRes.error || !teamRes.data) {
            console.error('[EMAIL] team fetch for time edit request:', teamRes.error)
            return
          }
          const mgr = managerRes.data as { email: string; full_name: string | null }
          const emp = employeeRes.data as { email: string; full_name: string | null }
          const tm = teamRes.data as { name: string }
          const recipientEmails = await getRequestNotificationRecipientEmails(supabase, teamId)
          const managerName = mgr.full_name || mgr.email
          const employeeName = emp.full_name || emp.email
          await sendRequestNotificationEmail(
            'Time Entry Edit',
            managerName,
            mgr.email,
            tm.name,
            description,
            undefined,
            undefined,
            undefined,
            undefined,
            recipientEmails,
            { submittedForName: employeeName, submittedForEmail: emp.email }
          )
          await sendRequestConfirmationEmail(
            'Time Entry Edit',
            managerName,
            mgr.email,
            tm.name,
            description,
            undefined,
            undefined,
            undefined,
            undefined,
            { submittedForName: employeeName, submittedForEmail: emp.email }
          )
        })
        .catch((err) => console.error('[EMAIL] time entry edit request emails:', err))

      return NextResponse.json({ request: requestRow })
    }

    const { data: requestRow, error: requestError } = await supabase
      .from('requests')
      .insert({
        user_id: targetUserId,
        team_id: teamId,
        time_session_id: timeSessionId,
        request_type: 'Time Entry Edit',
        description,
        requested_data: requestedData,
        status: 'APPROVED',
        created_by: user.id,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: payload.reason?.trim() || null,
      } as any)
      .select()
      .single()

    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 400 })
    }

    if (payload.edit_type === 'TIME_SESSION') {
      const updates: Record<string, string> = {}
      if (newClockIn) updates.clock_in_at = newClockIn
      if (newClockOut) updates.clock_out_at = newClockOut
      const { error } = await supabase
        .from('time_sessions')
        .update(updates)
        .eq('id', payload.time_session_id!)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else if (payload.edit_type === 'BREAK_SEGMENT') {
      const updates: Record<string, string> = {}
      if (newBreakStart) updates.break_start_at = newBreakStart
      if (newBreakEnd) updates.break_end_at = newBreakEnd
      const { error } = await supabase
        .from('break_segments')
        .update(updates)
        .eq('id', payload.break_segment_id!)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else if (payload.edit_type === 'NOTE') {
      const { error } = await supabase
        .from('notes')
        .update({ content: payload.new_content!.trim() })
        .eq('id', payload.note_id!)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ request: requestRow, status: 'APPLIED' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
