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
    
    const isSuperAdminUser = isSuperAdmin(user)
    let teamIds: string[] = []

    if (isSuperAdminUser) {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')

      if (teamsError) {
        return NextResponse.json(
          { error: 'Failed to load teams', details: teamsError.message },
          { status: 400 }
        )
      }

      teamIds = teams?.map((team: any) => team.id) || []
    } else {
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .in('role', ['MANAGER', 'ADMIN'])

      if (teamError) {
        return NextResponse.json(
          { error: 'Failed to load teams', details: teamError.message },
          { status: 400 }
        )
      }

      teamIds = teamMembers?.map((tm: any) => tm.team_id) || []
    }

    if (teamIds.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    // Get all pending requests from those teams - limit to last 90 days and 100 results
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    const startTime = Date.now()
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select(`
        id,
        user_id,
        team_id,
        request_type,
        description,
        status,
        requested_data,
        created_at,
        reviewed_at,
        review_notes,
        users!requests_user_id_fkey(email, full_name),
        teams(id, name, color)
      `) // Only essential columns
      .in('team_id', teamIds)
      .or('status.eq.PENDING,status.is.null')
      .gte('created_at', ninetyDaysAgo.toISOString()) // Only recent requests
      .order('created_at', { ascending: false })
      .limit(100) // Limit results to prevent large payloads

    if (requestsError) {
      return NextResponse.json(
        { error: 'Failed to load requests', details: requestsError.message },
        { status: 400 }
      )
    }

    const queryTime = Date.now() - startTime
    console.log(`[PERF] Admin requests query: ${queryTime}ms, rows: ${requests?.length || 0}`)

    return NextResponse.json({ 
      requests: requests || [],
      teamIds: teamIds // For debugging
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
