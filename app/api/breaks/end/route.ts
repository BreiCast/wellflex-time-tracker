import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { breakEndSchema } from '@/lib/validations/schemas'
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
    const { break_segment_id } = breakEndSchema.parse(body)

    // Verify break belongs to user's session
    const { data: breakSegment } = await supabase
      .from('break_segments')
      .select('id, break_end_at, time_session_id')
      .eq('id', break_segment_id)
      .single()

    if (!breakSegment) {
      return NextResponse.json(
        { error: 'Break segment not found' },
        { status: 404 }
      )
    }

    const breakSeg = breakSegment as { id: string; break_end_at: string | null; time_session_id: string }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('time_sessions')
      .select('user_id')
      .eq('id', breakSeg.time_session_id)
      .single()

    if (!session || !('user_id' in session) || (session as { user_id: string }).user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (breakSeg.break_end_at) {
      return NextResponse.json(
        { error: 'Break already ended' },
        { status: 400 }
      )
    }

    const updateResult = await (supabase
      .from('break_segments') as any)
      .update({ break_end_at: new Date().toISOString() })
      .eq('id', break_segment_id)
      .select()
      .single()
    
    const { data: updatedBreak, error } = updateResult

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ break_segment: updatedBreak })
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

