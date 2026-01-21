import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { clockOutSchema } from '@/lib/validations/schemas'
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

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('time_sessions')
      .select('id, clock_out_at')
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

