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

    const teamIds = teamMembers.map(tm => tm.team_id)

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
