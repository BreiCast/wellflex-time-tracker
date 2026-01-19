import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { breakStartSchema } from '@/lib/validations/schemas'
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
    const { time_session_id, break_type } = breakStartSchema.parse(body)

    // Verify session belongs to user and is active
    const { data: session } = await supabase
      .from('time_sessions')
      .select('id, clock_out_at, clock_in_at')
      .eq('id', time_session_id)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return NextResponse.json(
        { error: 'Time session not found' },
        { status: 404 }
      )
    }

    const sessionData = session as { id: string; clock_out_at: string | null; clock_in_at: string }
    if (sessionData.clock_out_at) {
      return NextResponse.json(
        { error: 'Cannot start break on completed session' },
        { status: 400 }
      )
    }

    // Check for active break
    const { data: activeBreak } = await supabase
      .from('break_segments')
      .select('id')
      .eq('time_session_id', time_session_id)
      .is('break_end_at', null)
      .maybeSingle()

    if (activeBreak) {
      return NextResponse.json(
        { error: 'You already have an active break' },
        { status: 400 }
      )
    }

    // Check daily limits for break types
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    // Get all breaks for today (completed or active) for this user across all sessions
    const { data: todaySessions } = await supabase
      .from('time_sessions')
      .select('id')
      .eq('user_id', user.id)
      .gte('clock_in_at', todayStart.toISOString())
      .lt('clock_in_at', todayEnd.toISOString())

    const sessionIds = (todaySessions as Array<{ id: string }> | null)?.map(s => s.id) || []

    if (sessionIds.length > 0) {
      const { data: todayBreaks } = await supabase
        .from('break_segments')
        .select('break_type, break_end_at')
        .in('time_session_id', sessionIds)
        .gte('break_start_at', todayStart.toISOString())
        .lt('break_start_at', todayEnd.toISOString())

      if (todayBreaks) {
        const breaks = todayBreaks as Array<{ break_type: 'BREAK' | 'LUNCH'; break_end_at: string | null }>
        if (break_type === 'LUNCH') {
          // Check if lunch already taken today (completed breaks only)
          const lunchCount = breaks.filter(b => b.break_type === 'LUNCH' && b.break_end_at !== null).length
          if (lunchCount >= 1) {
            return NextResponse.json(
              { error: 'You have already taken your lunch break today (limit: 1 lunch per day)' },
              { status: 400 }
            )
          }
        } else if (break_type === 'BREAK') {
          // Check if 2 breaks already taken today (completed breaks only)
          const breakCount = breaks.filter(b => b.break_type === 'BREAK' && b.break_end_at !== null).length
          if (breakCount >= 2) {
            return NextResponse.json(
              { error: 'You have already taken 2 breaks today (limit: 2 breaks per day)' },
              { status: 400 }
            )
          }
        }
      }
    }

    const { data: breakSegment, error } = await supabase
      .from('break_segments')
      .insert({
        time_session_id,
        break_type,
        break_start_at: new Date().toISOString(),
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

    return NextResponse.json({ break_segment: breakSegment })
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

