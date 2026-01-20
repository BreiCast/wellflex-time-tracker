import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'

export async function GET(request: NextRequest) {
  try {
    const admin = await getUserFromRequest(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', admin.id)
      .in('role', ['MANAGER', 'ADMIN'])

    if (teamError) {
      return NextResponse.json(
        { error: 'Failed to load teams', details: teamError.message },
        { status: 400 }
      )
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({ members: [] })
    }

    const teamIds = teamMembers.map(tm => tm.team_id)

    // Get all members from those teams with their user info and team info
    const { data: allMembers, error: membersError } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        team_id,
        users(id, email, full_name),
        teams(id, name, color)
      `)
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })

    if (membersError) {
      return NextResponse.json(
        { error: 'Failed to load members', details: membersError.message },
        { status: 400 }
      )
    }

    // Group members by user_id to show all teams each user belongs to
    const membersByUser: Record<string, any> = {}
    
    allMembers?.forEach((member: any) => {
      const userId = member.user_id
      if (!membersByUser[userId]) {
        membersByUser[userId] = {
          user_id: userId,
          user: member.users,
          teams: [],
          roles: [],
        }
      }
      membersByUser[userId].teams.push({
        team_id: member.team_id,
        team_name: member.teams?.name,
        team_color: member.teams?.color,
        role: member.role,
        membership_id: member.id,
      })
      if (!membersByUser[userId].roles.includes(member.role)) {
        membersByUser[userId].roles.push(member.role)
      }
    })

    // Convert to array
    const membersList = Object.values(membersByUser)

    return NextResponse.json({ 
      members: membersList,
      teamIds: teamIds // For debugging
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
