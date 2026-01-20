import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'

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
    
    // Check if user is ADMIN in any team
    const { data: adminTeams, error: adminCheckError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .eq('role', 'ADMIN')
      .limit(1)

    if (adminCheckError) {
      return NextResponse.json(
        { error: 'Failed to check admin status', details: adminCheckError.message },
        { status: 400 }
      )
    }

    // If user is ADMIN in any team, they can see all teams
    // Otherwise, only show teams where they are MANAGER or ADMIN
    let teamIds: string[] = []

    if (adminTeams && adminTeams.length > 0) {
      // User is ADMIN - get all teams
      const { data: allTeams, error: allTeamsError } = await supabase
        .from('teams')
        .select('id')

      if (allTeamsError) {
        return NextResponse.json(
          { error: 'Failed to load teams', details: allTeamsError.message },
          { status: 400 }
        )
      }

      teamIds = allTeams?.map(t => t.id) || []
    } else {
      // User is only MANAGER - get only their teams
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

      if (!teamMembers || teamMembers.length === 0) {
        return NextResponse.json({ requests: [] })
      }

      teamIds = teamMembers.map(tm => tm.team_id)
    }

    // Get all pending requests from those teams
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select(`
        *,
        users(email, full_name),
        teams(id, name, color)
      `)
      .in('team_id', teamIds)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })

    if (requestsError) {
      return NextResponse.json(
        { error: 'Failed to load requests', details: requestsError.message },
        { status: 400 }
      )
    }

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

