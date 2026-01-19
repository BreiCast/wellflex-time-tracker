import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { createAdjustmentSchema } from '@/lib/validations/schemas'
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
    const { request_id, user_id, team_id, time_session_id, adjustment_type, minutes, effective_date, description } = createAdjustmentSchema.parse(body)

    // Verify user is manager/admin of team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .single()

    if (!teamMember || !['MANAGER', 'ADMIN'].includes(teamMember.role)) {
      return NextResponse.json(
        { error: 'Only managers and admins can create adjustments' },
        { status: 403 }
      )
    }

    // Verify target user is member of team
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user_id)
      .single()

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Target user is not a member of this team' },
        { status: 403 }
      )
    }

    // If request_id provided, verify it's approved
    if (request_id) {
      const { data: request } = await supabase
        .from('requests')
        .select('status')
        .eq('id', request_id)
        .single()

      if (!request || request.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'Request must be approved before creating adjustment' },
          { status: 400 }
        )
      }
    }

    const { data: adjustment, error } = await supabase
      .from('adjustments')
      .insert({
        request_id: request_id || null,
        user_id,
        team_id,
        time_session_id: time_session_id || null,
        adjustment_type,
        minutes,
        effective_date,
        description: description || null,
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

    return NextResponse.json({ adjustment })
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

