import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { calculateTimesheet } from '@/lib/utils/timesheet'
import { getBusinessDayBounds } from '@/lib/utils/date'
import { z } from 'zod'

const getTimesheetTotalsSchema = z.object({
  user_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

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
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    }

    const { user_id: targetUserId, start_date, end_date } = getTimesheetTotalsSchema.parse(params)

    let allowedTeamIds: string[] | null = null

    // If requesting another user, verify requester is admin/manager of at least one team the target is in
    if (targetUserId !== user.id) {
      const isSuperAdminUser = isSuperAdmin(user)
      if (!isSuperAdminUser) {
        const { data: targetTeams } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', targetUserId)

        const targetTeamIds = (targetTeams || []).map((t: any) => t.team_id)
        if (targetTeamIds.length === 0) {
          return NextResponse.json(
            { error: 'User is not in any team' },
            { status: 404 }
          )
        }

        const { data: requesterRoles } = await supabase
          .from('team_members')
          .select('team_id, role')
          .eq('user_id', user.id)
          .in('team_id', targetTeamIds)

        const allowed = (requesterRoles || [])
          .filter((r: any) => r.role === 'MANAGER' || r.role === 'ADMIN')
          .map((r: any) => r.team_id)

        if (allowed.length === 0) {
          return NextResponse.json(
            { error: 'Only managers and admins can view other users timesheet totals' },
            { status: 403 }
          )
        }

        allowedTeamIds = allowed
      }
    }

    // Query window uses Colombia business-day bounds so evening sessions that
    // land on the next UTC day are still fetched for the correct local date.
    const rangeStart = getBusinessDayBounds(start_date).start
    const rangeEnd = getBusinessDayBounds(end_date).end

    const startDate = new Date(`${start_date}T00:00:00.000Z`)
    const endDate = new Date(`${end_date}T00:00:00.000Z`)

    const maxDays = 90
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > maxDays) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${maxDays} days. Please select a smaller range.` },
        { status: 400 }
      )
    }

    let sessionsQuery = supabase
      .from('time_sessions')
      .select('id, user_id, team_id, clock_in_at, clock_out_at, created_at, created_by')
      .eq('user_id', targetUserId)
      .gte('clock_in_at', rangeStart)
      .lte('clock_in_at', rangeEnd)
      .order('clock_in_at', { ascending: false })

    if (allowedTeamIds) {
      sessionsQuery = sessionsQuery.in('team_id', allowedTeamIds)
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) {
      return NextResponse.json(
        { error: sessionsError.message },
        { status: 400 }
      )
    }

    const sessionIds = (sessions || []).map((s: any) => s.id)
    let breaks: any[] = []
    let notes: any[] = []

    if (sessionIds.length > 0) {
      const { data: breaksData, error: breaksError } = await supabase
        .from('break_segments')
        .select('id, time_session_id, break_type, break_start_at, break_end_at')
        .in('time_session_id', sessionIds)

      if (breaksError) {
        return NextResponse.json(
          { error: breaksError.message },
          { status: 400 }
        )
      }
      breaks = breaksData || []

      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, time_session_id, content, created_at, created_by')
        .in('time_session_id', sessionIds)

      if (!notesError) {
        notes = notesData || []
      }
    }

    let adjustmentsQuery = supabase
      .from('adjustments')
      .select('id, user_id, team_id, adjustment_type, minutes, effective_date, created_at, created_by, description, request_id, time_session_id')
      .eq('user_id', targetUserId)
      .gte('effective_date', start_date)
      .lte('effective_date', end_date)

    if (allowedTeamIds) {
      adjustmentsQuery = adjustmentsQuery.in('team_id', allowedTeamIds)
    }

    const { data: adjustments, error: adjustmentsError } = await adjustmentsQuery

    if (adjustmentsError) {
      return NextResponse.json(
        { error: adjustmentsError.message },
        { status: 400 }
      )
    }

    const entries = calculateTimesheet(
      sessions || [],
      breaks,
      notes,
      adjustments || [],
      start_date,
      end_date
    )

    const totalWorkMinutes = entries.reduce((sum, e) => sum + e.workMinutes, 0)
    const totalAdjustments = entries.reduce((sum, e) => sum + e.adjustedMinutes, 0)
    const daysWorked = entries.filter((e) => e.workMinutes > 0).length

    return NextResponse.json({
      totalWorkMinutes,
      totalAdjustments,
      daysWorked,
    })
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
