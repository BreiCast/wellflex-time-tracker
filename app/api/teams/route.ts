import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { z } from 'zod'

const createTeamSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
})

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
    const { name, color } = createTeamSchema.parse(body)

    // Check for duplicate team name
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle()

    if (existingTeam) {
      return NextResponse.json(
        { error: 'A team with this name already exists. Please choose a different name.' },
        { status: 400 }
      )
    }

    // Ensure user exists in public.users before creating team
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingUser) {
      // Get user from auth to create public.users record
      const { data: authUser } = await supabase.auth.admin.getUserById(user.id)
      
      if (authUser?.user) {
        await supabase.from('users').insert({
          id: authUser.user.id,
          email: authUser.user.email!,
          full_name: authUser.user.user_metadata?.full_name || null,
        } as any)
      } else {
        return NextResponse.json(
          { error: 'User record not found. Please try logging out and back in.' },
          { status: 400 }
        )
      }
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ name, color: color || '#6366f1' } as any)
      .select()
      .single()

    if (teamError) {
      return NextResponse.json(
        { error: teamError.message },
        { status: 400 }
      )
    }

    // Verify user exists in public.users before adding to team
    const { data: userCheck } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!userCheck) {
      // Rollback team creation
      await supabase.from('teams').delete().eq('id', team.id)
      return NextResponse.json(
        { error: 'User record not found in database. Please contact support.' },
        { status: 400 }
      )
    }

    // Add creator as admin
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'ADMIN',
      } as any)

    if (memberError) {
      // Rollback team creation
      await supabase.from('teams').delete().eq('id', team.id)
      return NextResponse.json(
        { error: `Failed to add you to team: ${memberError.message}` },
        { status: 400 }
      )
    }

    // Verify the team_member was created
    const { data: verifyMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', user.id)
      .single()

    if (!verifyMember) {
      // Rollback team creation
      await supabase.from('teams').delete().eq('id', team.id)
      return NextResponse.json(
        { error: 'Team created but failed to add you as member. Team has been removed.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      team,
      message: 'Team created successfully and you have been added as admin'
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

    if (isSuperAdminUser) {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      const superTeams = teams?.map((team: any) => ({
        ...team,
        role: 'SUPERADMIN',
      })) || []

      return NextResponse.json({ teams: superTeams, is_superadmin: true })
    }

    // Get user's teams
    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select('team_id, role, teams(*)')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const teams = teamMembers?.map((tm: any) => ({
      ...tm.teams,
      role: tm.role,
    })) || []

    return NextResponse.json({ teams, is_superadmin: false })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
