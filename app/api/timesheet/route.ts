import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { getTimesheetSchema } from '@/lib/validations/schemas'
import { calculateTimesheet } from '@/lib/utils/timesheet'
import { z } from 'zod'

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

    const { searchParams } = new URL(request.url)
    const params = {
      user_id: searchParams.get('user_id') || undefined,
      team_id: searchParams.get('team_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    }

    const { user_id, team_id, start_date, end_date } = getTimesheetSchema.parse(params)

    // Determine target user_id
    let targetUserId = user_id || user.id

    // If requesting different user, verify permissions
    if (targetUserId !== user.id) {
      if (!team_id) {
        return NextResponse.json(
          { error: 'team_id required when viewing other users' },
          { status: 400 }
        )
      }

      // Verify user is manager/admin of team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', team_id)
        .eq('user_id', user.id)
        .single()

      if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: 'MEMBER' | 'MANAGER' | 'ADMIN' }).role)) {
        return NextResponse.json(
          { error: 'Only managers and admins can view other users timesheets' },
          { status: 403 }
        )
      }
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    // Fetch time sessions
    let sessionsQuery = supabase
      .from('time_sessions')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('clock_in_at', startDate.toISOString())
      .lte('clock_in_at', endDate.toISOString())

    if (team_id) {
      sessionsQuery = sessionsQuery.eq('team_id', team_id)
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) {
      return NextResponse.json(
        { error: sessionsError.message },
        { status: 400 }
      )
    }

    // Fetch break segments
    const sessionIds = sessions?.map(s => s.id) || []
    let breaksQuery = supabase
      .from('break_segments')
      .select('*')
      .in('time_session_id', sessionIds)

    const { data: breaks, error: breaksError } = await breaksQuery

    if (breaksError) {
      return NextResponse.json(
        { error: breaksError.message },
        { status: 400 }
      )
    }

    // Fetch adjustments
    let adjustmentsQuery = supabase
      .from('adjustments')
      .select('*')
      .eq('user_id', targetUserId)
      .gte('effective_date', start_date)
      .lte('effective_date', end_date)

    if (team_id) {
      adjustmentsQuery = adjustmentsQuery.eq('team_id', team_id)
    }

    const { data: adjustments, error: adjustmentsError } = await adjustmentsQuery

    if (adjustmentsError) {
      return NextResponse.json(
        { error: adjustmentsError.message },
        { status: 400 }
      )
    }

    // Calculate timesheet
    const timesheet = calculateTimesheet(
      sessions || [],
      breaks || [],
      adjustments || [],
      startDate,
      endDate
    )

    return NextResponse.json({ timesheet })
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

