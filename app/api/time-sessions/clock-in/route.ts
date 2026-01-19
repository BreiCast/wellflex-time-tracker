import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { clockInSchema } from '@/lib/validations/schemas'
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

    // Check for active session
    const { data: activeSession } = await supabase
      .from('time_sessions')
      .select('id')
      .eq('user_id', user.id)
      .is('clock_out_at', null)
      .single()

    if (activeSession) {
      return NextResponse.json(
        { error: 'You already have an active time session' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { team_id } = clockInSchema.parse(body)

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

    // Create time session
    const { data: session, error } = await supabase
      .from('time_sessions')
      .insert({
        user_id: user.id,
        team_id,
        clock_in_at: new Date().toISOString(),
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

    return NextResponse.json({ session })
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

