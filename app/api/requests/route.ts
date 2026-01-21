import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { createRequestSchema, reviewRequestSchema } from '@/lib/validations/schemas'
import { sendRequestNotificationEmail, sendRequestConfirmationEmail } from '@/lib/utils/email'
import {
  calculateMinutesFromTimeRange,
  getAdjustmentTypeFromRequestType,
  getEffectiveDateFromRequestData,
} from '@/lib/utils/request-helpers'
import { z } from 'zod'

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
        
        console.log('[EMAIL] 📧 Preparing to send emails for request:', {
          requestType: request_type,
          userName,
          userEmail: userData.email,
          teamName: teamData.name,
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
          requested_data?.time_to
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
          // Find the time_session for this date
          const dateStart = new Date(breakDate)
          dateStart.setHours(0, 0, 0, 0)
          const dateEnd = new Date(breakDate)
          dateEnd.setHours(23, 59, 59, 999)

          const { data: sessions } = await supabase
            .from('time_sessions')
            .select('id')
            .eq('user_id', (requestData as any).user_id)
            .eq('team_id', (requestData as any).team_id)
            .gte('clock_in_at', dateStart.toISOString())
            .lte('clock_in_at', dateEnd.toISOString())
            .order('clock_in_at', { ascending: false })
            .limit(1)

          if (sessions && sessions.length > 0) {
            const sessionId = (sessions[0] as { id: string }).id

            // Combine date and time to create full timestamps
            const breakStartStr = `${breakDate}T${timeFrom}:00`
            const breakEndStr = `${breakDate}T${timeTo}:00`

            // Create the break segment
            const { error: breakError } = await supabase
              .from('break_segments')
              .insert({
                time_session_id: sessionId,
                break_type: breakType,
                break_start_at: new Date(breakStartStr).toISOString(),
                break_end_at: new Date(breakEndStr).toISOString(),
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
                breakStart: breakStartStr,
                breakEnd: breakEndStr,
              })
            }
          } else {
            console.error('[REQUESTS] No time session found for break date:', breakDate)
          }
        }
      }
      // Handle "Break Duration Adjustment"
      else if (requestTypeUpper.includes('BREAK') && requestTypeUpper.includes('ADJUSTMENT')) {
        const breakSegmentId = requestedData.break_segment_id
        const currentDuration = requestedData.current_duration_minutes
        const adjustedDuration = requestedData.adjusted_duration_minutes

        if (breakSegmentId && typeof currentDuration === 'number' && typeof adjustedDuration === 'number') {
          // Get the break segment
          const { data: breakSegment } = await supabase
            .from('break_segments')
            .select('break_start_at, break_end_at')
            .eq('id', breakSegmentId)
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
          }
        }
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
