import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { z } from 'zod'

const switchTeamSchema = z.object({
  time_session_id: z.string().uuid(),
  team_id: z.string().uuid(),
})

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
    const { time_session_id, team_id } = switchTeamSchema.parse(body)

    // Verify session belongs to user and is active
    const { data: session } = await supabase
      .from('time_sessions')
      .select('id, clock_out_at, team_id')
      .eq('id', time_session_id)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return NextResponse.json(
        { error: 'Time session not found' },
        { status: 404 }
      )
    }

    if (session.clock_out_at) {
      return NextResponse.json(
        { error: 'Cannot switch teams on completed session' },
        { status: 400 }
      )
    }

    if (session.team_id === team_id) {
      return NextResponse.json(
        { error: 'You are already working on this team' },
        { status: 400 }
      )
    }

    // Verify user is member of new team
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

    // Update team_id
    const { data: updatedSession, error } = await supabase
      .from('time_sessions')
      .update({ team_id })
      .eq('id', time_session_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ session: updatedSession })
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

