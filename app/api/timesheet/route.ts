import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
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
    const viewAllMembers = user_id === 'all'
    let targetUserId = user_id && user_id !== 'all' ? user_id : user.id

    // If requesting different user or all members, verify permissions
    if (viewAllMembers || targetUserId !== user.id) {
      if (!team_id) {
        return NextResponse.json(
          { error: 'team_id required when viewing other users or all members' },
          { status: 400 }
        )
      }

      const isSuperAdminUser = isSuperAdmin(user)

      if (!isSuperAdminUser) {
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
    }

    const startDate = new Date(start_date)
    const endDate = new Date(end_date)

    // Enforce maximum date range (90 days) to prevent excessive queries
    const maxDays = 90
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > maxDays) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${maxDays} days. Please select a smaller range.` },
        { status: 400 }
      )
    }

    // If viewing all members, get all team member user IDs
    let targetUserIds: string[] = []
    if (viewAllMembers && team_id) {
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', team_id)
      
      if (teamMembers) {
        targetUserIds = teamMembers.map((tm: any) => tm.user_id)
      }
    } else {
      targetUserIds = [targetUserId]
    }

    // Fetch time sessions for all target users - only select needed columns
    let sessionsQuery = supabase
      .from('time_sessions')
      .select('id, user_id, team_id, clock_in_at, clock_out_at') // Only essential columns
      .in('user_id', targetUserIds)
      .gte('clock_in_at', startDate.toISOString())
      .lte('clock_in_at', endDate.toISOString())
      .order('clock_in_at', { ascending: false }) // Use indexed ordering

    if (team_id) {
      sessionsQuery = sessionsQuery.eq('team_id', team_id)
    }

    const startTime = Date.now()
    const { data: sessions, error: sessionsError } = await sessionsQuery
    const sessionsQueryTime = Date.now() - startTime

    // Fetch user data separately
    let usersData: Record<string, any> = {}
    if (viewAllMembers && sessions && sessions.length > 0) {
      const uniqueUserIds = [...new Set(sessions.map((s: any) => s.user_id))]
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', uniqueUserIds)
      
      if (users) {
        users.forEach((u: any) => {
          usersData[u.id] = u
        })
      }
    }

    if (sessionsError) {
      return NextResponse.json(
        { error: sessionsError.message },
        { status: 400 }
      )
    }

    // Fetch break segments - only if we have sessions
    const sessionIds = sessions?.map(s => s.id) || []
    let breaks: any[] = []
    if (sessionIds.length > 0) {
      const breaksStartTime = Date.now()
      const { data: breaksData, error: breaksError } = await supabase
        .from('break_segments')
        .select('id, time_session_id, break_type, break_start_at, break_end_at') // Only essential columns
        .in('time_session_id', sessionIds)
      
      if (breaksError) {
        return NextResponse.json(
          { error: breaksError.message },
          { status: 400 }
        )
      }
      breaks = breaksData || []
      const breaksQueryTime = Date.now() - breaksStartTime
      console.log(`[PERF] Timesheet breaks query: ${breaksQueryTime}ms, rows: ${breaks.length}`)
    } else {
      breaks = []
    }

    // Fetch adjustments for all target users - only select needed columns
    const adjustmentsStartTime = Date.now()
    let adjustmentsQuery = supabase
      .from('adjustments')
      .select('id, user_id, team_id, adjustment_type, minutes, effective_date') // Only essential columns
      .in('user_id', targetUserIds)
      .gte('effective_date', start_date)
      .lte('effective_date', end_date)

    if (team_id) {
      adjustmentsQuery = adjustmentsQuery.eq('team_id', team_id)
    }

    const { data: adjustments, error: adjustmentsError } = await adjustmentsQuery
    const adjustmentsQueryTime = Date.now() - adjustmentsStartTime

    if (adjustmentsError) {
      return NextResponse.json(
        { error: adjustmentsError.message },
        { status: 400 }
      )
    }

    // Log performance metrics
    console.log(`[PERF] Timesheet query: sessions=${sessionsQueryTime}ms/${sessions?.length || 0}rows, adjustments=${adjustmentsQueryTime}ms/${adjustments?.length || 0}rows, range=${daysDiff}days`)

    // Calculate timesheet - if viewing all members, group by user
    if (viewAllMembers) {
      // Group sessions, breaks, and adjustments by user
      const timesheetsByUser: Record<string, any> = {}
      
      for (const userId of targetUserIds) {
        const userSessions = sessions?.filter((s: any) => s.user_id === userId) || []
        const userSessionIds = userSessions.map((s: any) => s.id)
        const userBreaks = breaks?.filter((b: any) => userSessionIds.includes(b.time_session_id)) || []
        const userAdjustments = adjustments?.filter((a: any) => a.user_id === userId) || []
        
        const userTimesheet = calculateTimesheet(
          userSessions,
          userBreaks,
          userAdjustments,
          startDate,
          endDate
        )
        
        // Add user info to each entry
        const userInfo = usersData[userId] || null
        timesheetsByUser[userId] = {
          user: userInfo,
          timesheet: userTimesheet.map(entry => ({
            ...entry,
            user_id: userId,
            user_name: userInfo?.full_name || userInfo?.email || 'Unknown',
          })),
        }
      }
      
      // Combine all timesheets into one array
      const allEntries: any[] = []
      Object.values(timesheetsByUser).forEach((userData: any) => {
        allEntries.push(...userData.timesheet)
      })
      
      // Sort by date, then by user name
      allEntries.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return a.user_name.localeCompare(b.user_name)
      })
      
      return NextResponse.json({ timesheet: allEntries, viewAllMembers: true })
    } else {
      // Single user view
      const timesheet = calculateTimesheet(
        sessions || [],
        breaks || [],
        adjustments || [],
        startDate,
        endDate
      )
      
      return NextResponse.json({ timesheet, viewAllMembers: false })
    }
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
