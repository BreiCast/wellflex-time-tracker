import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { clockOutSchema } from '@/lib/validations/schemas'
import { isSuperAdmin } from '@/lib/auth/superadmin'
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
    const { time_session_id } = clockOutSchema.parse(body)

    // Load target session and verify permissions
    const { data: session } = await supabase
      .from('time_sessions')
      .select('id, user_id, team_id, clock_out_at')
      .eq('id', time_session_id)
      .single()

    if (!session) {
      return NextResponse.json(
        { error: 'Time session not found' },
        { status: 404 }
      )
    }

    const targetSession = session as {
      id: string
      user_id: string
      team_id: string | null
      clock_out_at: string | null
    }

    const canClockOutOwnSession = targetSession.user_id === user.id
    let canManageTargetSession = false

    if (!canClockOutOwnSession) {
      if (isSuperAdmin(user)) {
        canManageTargetSession = true
      } else if (targetSession.team_id) {
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', targetSession.team_id)
          .eq('user_id', user.id)
          .single()

        const role = (teamMember as { role?: string } | null)?.role
        canManageTargetSession = role === 'ADMIN' || role === 'MANAGER'
      }

      if (!canManageTargetSession) {
        return NextResponse.json(
          { error: 'Only managers and admins can clock out other users on their team' },
          { status: 403 }
        )
      }
    }

    if (targetSession.clock_out_at) {
      return NextResponse.json(
        { error: 'Session already clocked out' },
        { status: 400 }
      )
    }

    const { data: updatedSession, error } = await supabase
      .from('time_sessions')
      .update({ clock_out_at: new Date().toISOString() })
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
