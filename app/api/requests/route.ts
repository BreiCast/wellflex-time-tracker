import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { createRequestSchema, reviewRequestSchema } from '@/lib/validations/schemas'
import { sendRequestNotificationEmail, sendRequestConfirmationEmail } from '@/lib/utils/email'
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
      if (userResult.data && teamResult.data) {
        const userData = userResult.data as { email: string; full_name: string | null }
        const teamData = teamResult.data as { name: string }
        const userName = userData.full_name || userData.email
        
        // Send notification to admins
        await sendRequestNotificationEmail(
          request_type,
          userName,
          userData.email,
          teamData.name,
          description,
          requested_data?.date,
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
          requested_data?.date,
          requested_data?.time_from,
          requested_data?.time_to
        )
      }
    }).catch(err => {
      console.error('Error sending emails:', err)
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

    // Get request and verify user is manager/admin of team
    const { data: requestData } = await supabase
      .from('requests')
      .select('id, team_id, status')
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

