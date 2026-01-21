import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')
    const teamId = searchParams.get('team_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Validate required parameters
    if (!userId || !teamId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: user_id, team_id, start_date, end_date' },
        { status: 400 }
      )
    }

    const isSuperAdminUser = isSuperAdmin(user)

    // Verify user has permission to view breaks for this user
    if (!isSuperAdminUser) {
      // If requesting own breaks, allow
      if (userId !== user.id) {
        // If requesting other user's breaks, verify user is manager/admin of team
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', user.id)
          .single()

        if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: string }).role)) {
          return NextResponse.json(
            { error: 'Unauthorized to view breaks for this user' },
            { status: 403 }
          )
        }
      }
    }

    // Verify target user is member of team
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single()

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Target user is not a member of this team' },
        { status: 400 }
      )
    }

    // Get time sessions for the user in the date range
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const { data: sessions, error: sessionsError } = await supabase
      .from('time_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .gte('clock_in_at', start.toISOString())
      .lte('clock_in_at', end.toISOString())

    if (sessionsError) {
      return NextResponse.json(
        { error: sessionsError.message },
        { status: 400 }
      )
    }

    const sessionIds = (sessions || []).map(s => s.id)

    if (sessionIds.length === 0) {
      return NextResponse.json({ breaks: [] })
    }

    // Get break segments for these sessions - only completed breaks
    const { data: breaks, error: breaksError } = await supabase
      .from('break_segments')
      .select('id, break_type, break_start_at, break_end_at, time_session_id')
      .in('time_session_id', sessionIds)
      .not('break_end_at', 'is', null)
      .order('break_start_at', { ascending: false })

    if (breaksError) {
      return NextResponse.json(
        { error: breaksError.message },
        { status: 400 }
      )
    }

    // Calculate duration for each break and format response
    const formattedBreaks = (breaks || []).map((breakSeg: any) => {
      const start = new Date(breakSeg.break_start_at)
      const end = new Date(breakSeg.break_end_at)
      const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))

      return {
        id: breakSeg.id,
        break_type: breakSeg.break_type,
        break_start_at: breakSeg.break_start_at,
        break_end_at: breakSeg.break_end_at,
        time_session_id: breakSeg.time_session_id,
        duration_minutes: durationMinutes,
        date: start.toISOString().split('T')[0],
      }
    })

    return NextResponse.json({ breaks: formattedBreaks })
  } catch (error) {
    console.error('Error fetching breaks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
