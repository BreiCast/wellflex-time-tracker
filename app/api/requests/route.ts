import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { createRequestSchema, reviewRequestSchema } from '@/lib/validations/schemas'
import { sendRequestNotificationEmail, sendRequestConfirmationEmail } from '@/lib/utils/email'
import { getRequestNotificationRecipientEmails } from '@/lib/utils/request-notification-recipients'
import {
  calculateMinutesFromTimeRange,
  getAdjustmentTypeFromRequestType,
  getEffectiveDateFromRequestData,
} from '@/lib/utils/request-helpers'
import { z } from 'zod'
import { buildBusinessBreakInterval, type BusinessBreakInterval } from '@/lib/utils/date'

function normalizeIso(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp')
  }
  return date.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()

    const body = await request.json()
    const { team_id, time_session_id, request_type, description, requested_data } = createRequestSchema.parse(body)

    // Verify user is member of team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .single()

    if (!teamMember) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      )
    }

    const { data: newRequest, error } = await supabase
      .from('requests')
      .insert({
        user_id: user.id,
        team_id,
        time_session_id: time_session_id || null,
        request_type,
        description,
        requested_data: requested_data || null,
        created_by: user.id,
        status: 'PENDING',
      } as any)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Send email notifications (don't wait for it to complete)
    // Fetch user and team details for the emails
    Promise.all([
      supabase
        .from('users')
        .select('email, full_name')
        .eq('id', user.id)
        .single(),
      supabase
        .from('teams')
        .select('name')
        .eq('id', team_id)
        .single()
    ]).then(async ([userResult, teamResult]) => {
      if (userResult.error) {
        console.error('Error fetching user data for email:', userResult.error)
        return
      }
      if (teamResult.error) {
        console.error('Error fetching team data for email:', teamResult.error)
        return
      }
      
      if (userResult.data && teamResult.data) {
        const userData = userResult.data as { email: string; full_name: string | null }
        const teamData = teamResult.data as { name: string }
        const userName = userData.full_name || userData.email
        const recipientEmails = await getRequestNotificationRecipientEmails(supabase, team_id)

        console.log('[EMAIL] 📧 Preparing to send emails for request:', {
          requestType: request_type,
          userName,
          userEmail: userData.email,
          teamName: teamData.name,
          recipientCount: recipientEmails.length,
          requestedData: requested_data
        })
        
        // Send notification to admins
        await sendRequestNotificationEmail(
          request_type,
          userName,
          userData.email,
          teamData.name,
          description,
          requested_data?.date_from || requested_data?.date,
          requested_data?.date_to || requested_data?.date,
          requested_data?.time_from,
          requested_data?.time_to,
          recipientEmails
        )
        
        // Send confirmation to requester
        await sendRequestConfirmationEmail(
          request_type,
          userName,
          userData.email,
          teamData.name,
          description,
          requested_data?.date_from || requested_data?.date,
          requested_data?.date_to || requested_data?.date,
          requested_data?.time_from,
          requested_data?.time_to
        )
      } else {
        console.warn('Missing user or team data for email notification', {
          hasUserData: !!userResult.data,
          hasTeamData: !!teamResult.data
        })
      }
    }).catch(err => {
      console.error('[EMAIL] ❌ Error in email sending process:', {
        error: err?.message || err,
        stack: err?.stack,
        requestType: request_type,
        teamId: team_id
      })
      // Don't fail the request if email fails
    })

    return NextResponse.json({ request: newRequest })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()

    const body = await request.json()
    const { request_id, status, review_notes } = reviewRequestSchema.parse(body)

    // Get full request data to create adjustment if approved
    const { data: requestData } = await supabase
      .from('requests')
      .select('id, user_id, team_id, status, request_type, requested_data, time_session_id')
      .eq('id', request_id)
      .single()

    if (!requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    if ((requestData as { status: string }).status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request already reviewed' },
        { status: 400 }
      )
    }

    const isSuperAdminUser = isSuperAdmin(user)

    if (!isSuperAdminUser) {
      // Verify user is manager/admin
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', (requestData as { team_id: string }).team_id)
        .eq('user_id', user.id)
        .single()

      if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: string }).role)) {
        return NextResponse.json(
          { error: 'Only managers and admins can review requests' },
          { status: 403 }
        )
      }
    }

    const { data: updatedRequest, error } = await (supabase
      .from('requests') as any)
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        review_notes: review_notes || null,
      })
      .eq('id', request_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // If approved, handle break-specific requests or create adjustment from the request data
    if (status === 'APPROVED' && requestData.requested_data) {
      const requestedData = requestData.requested_data as any
      const requestTypeUpper = requestData.request_type.toUpperCase()

      // Handle "Forgot to Log Break" or "Forgot to Log Lunch"
      if (requestTypeUpper.includes('FORGOT') && (requestTypeUpper.includes('BREAK') || requestTypeUpper.includes('LUNCH'))) {
        const breakDate = requestedData.date || requestedData.date_from
        const timeFrom = requestedData.time_from
        const timeTo = requestedData.time_to
        const breakType = requestedData.break_type || (requestTypeUpper.includes('LUNCH') ? 'LUNCH' : 'BREAK')

        if (breakDate && timeFrom && timeTo) {
          let breakInterval: BusinessBreakInterval | null = null

          try {
            breakInterval = buildBusinessBreakInterval({
              date: breakDate,
              timeFrom,
              timeTo,
            })
          } catch (intervalError) {
            console.error('[REQUESTS] Invalid break interval for approved request:', {
              error: intervalError instanceof Error ? intervalError.message : intervalError,
              requestId: request_id,
              requestedData,
            })
          }

          if (breakInterval) {
            // Find the time_session for this Colombia business date, not the server timezone date.
            const { data: sessions } = await supabase
              .from('time_sessions')
              .select('id')
              .eq('user_id', (requestData as any).user_id)
              .eq('team_id', (requestData as any).team_id)
              .gte('clock_in_at', breakInterval.businessDayStartIso)
              .lte('clock_in_at', breakInterval.businessDayEndIso)
              .order('clock_in_at', { ascending: false })
              .limit(1)

            if (sessions && sessions.length > 0) {
              const sessionId = (sessions[0] as { id: string }).id

              // Create the break segment
              const { error: breakError } = await supabase
                .from('break_segments')
                .insert({
                  time_session_id: sessionId,
                  break_type: breakType,
                  break_start_at: breakInterval.startIso,
                  break_end_at: breakInterval.endIso,
                  created_by: (requestData as any).user_id,
                } as any)

              if (breakError) {
                console.error('[REQUESTS] Error creating break segment:', {
                  error: breakError,
                  requestId: request_id,
                  requestedData,
                })
              } else {
                console.log('[REQUESTS] ✅ Auto-created break segment for approved request:', {
                  requestId: request_id,
                  breakType,
                  breakStart: breakInterval.startIso,
                  breakEnd: breakInterval.endIso,
                  durationMinutes: breakInterval.durationMinutes,
                })
              }
            } else {
              console.error('[REQUESTS] No time session found for break date:', breakDate)
            }
          }
        }
      }
      // Handle "Break/Lunch Duration Adjustment"
      else if ((requestTypeUpper.includes('BREAK') || requestTypeUpper.includes('LUNCH')) && requestTypeUpper.includes('ADJUSTMENT')) {
        const breakSegmentId = requestedData.break_segment_id
        const currentDuration = requestedData.current_duration_minutes
        const adjustedDuration = requestedData.adjusted_duration_minutes

        if (breakSegmentId && typeof currentDuration === 'number' && typeof adjustedDuration === 'number') {
          // Get the break segment scoped to the request's user/team
          const { data: breakSegment } = await supabase
            .from('break_segments')
            .select('id, break_start_at, break_end_at, time_session_id, time_sessions!inner(user_id, team_id)')
            .eq('id', breakSegmentId)
            .eq('time_sessions.user_id', (requestData as any).user_id)
            .eq('time_sessions.team_id', (requestData as any).team_id)
            .single()

          if (breakSegment) {
            const breakStart = new Date((breakSegment as any).break_start_at)
            // Calculate new break_end_at based on adjusted duration
            const newBreakEnd = new Date(breakStart.getTime() + adjustedDuration * 60 * 1000)

            // Directly update the break_segment's break_end_at
            const { error: updateError } = await supabase
              .from('break_segments')
              .update({ break_end_at: newBreakEnd.toISOString() })
              .eq('id', breakSegmentId)

            if (updateError) {
              console.error('[REQUESTS] Error updating break segment:', {
                error: updateError,
                requestId: request_id,
                breakSegmentId,
                adjustedDuration,
              })
            } else {
              console.log('[REQUESTS] ✅ Updated break segment duration:', {
                requestId: request_id,
                breakSegmentId,
                currentDuration,
                adjustedDuration,
                newBreakEnd: newBreakEnd.toISOString(),
              })
            }
          } else {
            console.error('[REQUESTS] Break segment not found or not authorized for request:', {
              requestId: request_id,
              breakSegmentId,
              userId: (requestData as any).user_id,
              teamId: (requestData as any).team_id,
            })
          }
        }
      }
      // Handle "Time Entry Edit"
      else if (requestTypeUpper.includes('TIME') && requestTypeUpper.includes('ENTRY') && requestTypeUpper.includes('EDIT')) {
        const editType = requestedData.edit_type

        if (editType === 'TIME_SESSION') {
          const sessionId = requestedData.time_session_id
          const newClockIn = normalizeIso(requestedData.new_clock_in_at)
          const newClockOut = normalizeIso(requestedData.new_clock_out_at)
          if (sessionId && (newClockIn || newClockOut)) {
            const { data: session } = await supabase
              .from('time_sessions')
              .select('id, user_id, team_id, clock_in_at, clock_out_at')
              .eq('id', sessionId)
              .eq('user_id', (requestData as any).user_id)
              .eq('team_id', (requestData as any).team_id)
              .single()

            if (session) {
              const currentClockIn = (session as any).clock_in_at
              const currentClockOut = (session as any).clock_out_at
              const finalClockIn = newClockIn ?? currentClockIn
              const finalClockOut = newClockOut ?? currentClockOut
              if (finalClockIn && finalClockOut && new Date(finalClockOut) < new Date(finalClockIn)) {
                console.error('[REQUESTS] Invalid time session edit: clock-out before clock-in', {
                  requestId: request_id,
                  sessionId,
                  finalClockIn,
                  finalClockOut,
                })
              } else {
                const updates: Record<string, string> = {}
                if (newClockIn) updates.clock_in_at = newClockIn
                if (newClockOut) updates.clock_out_at = newClockOut
                const { error: updateError } = await supabase
                  .from('time_sessions')
                  .update(updates)
                  .eq('id', sessionId)

                if (updateError) {
                  console.error('[REQUESTS] Error updating time session:', {
                    error: updateError,
                    requestId: request_id,
                    sessionId,
                  })
                }
              }
            }
          }
        } else if (editType === 'BREAK_SEGMENT') {
          const breakSegmentId = requestedData.break_segment_id
          const newBreakStart = normalizeIso(requestedData.new_break_start_at)
          const newBreakEnd = normalizeIso(requestedData.new_break_end_at)
          if (breakSegmentId && (newBreakStart || newBreakEnd)) {
            const { data: breakSeg } = await supabase
              .from('break_segments')
              .select('id, break_start_at, break_end_at, time_session_id, time_sessions!inner(user_id, team_id)')
              .eq('id', breakSegmentId)
              .eq('time_sessions.user_id', (requestData as any).user_id)
              .eq('time_sessions.team_id', (requestData as any).team_id)
              .single()

            if (breakSeg) {
              const currentBreakStart = (breakSeg as any).break_start_at
              const currentBreakEnd = (breakSeg as any).break_end_at
              const finalBreakStart = newBreakStart ?? currentBreakStart
              const finalBreakEnd = newBreakEnd ?? currentBreakEnd
              if (finalBreakStart && finalBreakEnd && new Date(finalBreakEnd) < new Date(finalBreakStart)) {
                console.error('[REQUESTS] Invalid break edit: break_end before break_start', {
                  requestId: request_id,
                  breakSegmentId,
                  finalBreakStart,
                  finalBreakEnd,
                })
              } else {
                const updates: Record<string, string> = {}
                if (newBreakStart) updates.break_start_at = newBreakStart
                if (newBreakEnd) updates.break_end_at = newBreakEnd
                const { error: updateError } = await supabase
                  .from('break_segments')
                  .update(updates)
                  .eq('id', breakSegmentId)

                if (updateError) {
                  console.error('[REQUESTS] Error updating break segment (edit):', {
                    error: updateError,
                    requestId: request_id,
                    breakSegmentId,
                  })
                }
              }
            }
          }
        } else if (editType === 'NOTE') {
          const noteId = requestedData.note_id
          const newContent = typeof requestedData.new_content === 'string' ? requestedData.new_content.trim() : ''
          if (noteId && newContent) {
            const { data: note } = await supabase
              .from('notes')
              .select('id, time_session_id, time_sessions!inner(user_id, team_id)')
              .eq('id', noteId)
              .eq('time_sessions.user_id', (requestData as any).user_id)
              .eq('time_sessions.team_id', (requestData as any).team_id)
              .single()

            if (note) {
              const { error: updateError } = await supabase
                .from('notes')
                .update({ content: newContent })
                .eq('id', noteId)

              if (updateError) {
                console.error('[REQUESTS] Error updating note (edit):', {
                  error: updateError,
                  requestId: request_id,
                  noteId,
                })
              }
            }
          }
        }
      }
      // Handle "Work From Home" - no adjustments needed, just approve/reject
      else if (requestTypeUpper.includes('WORK FROM HOME')) {
        // Work From Home requests don't create time adjustments or affect PTO balances
        // They're just informational requests for location tracking
        console.log('[REQUESTS] ✅ Work From Home request approved (no adjustments created):', {
          requestId: request_id,
          requestType: requestData.request_type,
        })
      }
      // Handle other request types (existing logic)
      else {
        const effectiveDate = getEffectiveDateFromRequestData(requestedData)

        // Only create adjustment if we have time information or it's a time-related request
        if (effectiveDate && (requestedData.time_from || requestedData.time_to || requestedData.time)) {
          const minutes = calculateMinutesFromTimeRange(
            requestedData.time_from || requestedData.time,
            requestedData.time_to || requestedData.time
          )

          // If we have a time range, use calculated minutes; otherwise default to 8 hours (480 minutes) for PTO/leave
          const adjustmentMinutes = minutes !== null 
            ? minutes 
            : (requestData.request_type.toUpperCase().includes('PTO') || 
               requestData.request_type.toUpperCase().includes('LEAVE') ||
               requestData.request_type.toUpperCase().includes('VACATION') ||
               requestData.request_type.toUpperCase().includes('MEDICAL'))
              ? 480 // 8 hours default for leave requests
              : 0

          // Only create adjustment if we have valid minutes
          if (adjustmentMinutes > 0 || requestedData.time_from || requestedData.time_to || requestedData.time) {
            const adjustmentType = getAdjustmentTypeFromRequestType(requestData.request_type)

            const { error: adjustmentError } = await supabase
              .from('adjustments')
              .insert({
                request_id: request_id,
                user_id: (requestData as any).user_id,
                team_id: (requestData as any).team_id,
                time_session_id: (requestData as any).time_session_id || null,
                adjustment_type: adjustmentType,
                minutes: adjustmentMinutes,
                effective_date: effectiveDate,
                description: `Auto-created from approved ${requestData.request_type} request`,
                created_by: user.id,
              } as any)

            if (adjustmentError) {
              console.error('[REQUESTS] Error creating adjustment:', {
                error: adjustmentError,
                requestId: request_id,
                requestedData,
              })
              // Don't fail the request approval if adjustment creation fails
              // Just log it - admin can create adjustment manually if needed
            } else {
              console.log('[REQUESTS] ✅ Auto-created adjustment for approved request:', {
                requestId: request_id,
                adjustmentType,
                minutes: adjustmentMinutes,
                effectiveDate,
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
