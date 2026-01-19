import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { createRequestSchema, reviewRequestSchema } from '@/lib/validations/schemas'
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

    const { data: request, error } = await supabase
      .from('requests')
      .insert({
        user_id: user.id,
        team_id,
        time_session_id: time_session_id || null,
        request_type,
        description,
        requested_data: requested_data || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ request })
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
    const { data: request } = await supabase
      .from('requests')
      .select('id, team_id, status')
      .eq('id', request_id)
      .single()

    if (!request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request already reviewed' },
        { status: 400 }
      )
    }

    // Verify user is manager/admin
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', request.team_id)
      .eq('user_id', user.id)
      .single()

    if (!teamMember || !['MANAGER', 'ADMIN'].includes(teamMember.role)) {
      return NextResponse.json(
        { error: 'Only managers and admins can review requests' },
        { status: 403 }
      )
    }

    const { data: updatedRequest, error } = await supabase
      .from('requests')
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

