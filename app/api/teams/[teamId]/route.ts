import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { z } from 'zod'

const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const { teamId } = params
    const body = await request.json()
    const { name, color } = updateTeamSchema.parse(body)

    const isSuperAdminUser = isSuperAdmin(user)

    if (!isSuperAdminUser) {
      // Check if user is ADMIN of the team
      const { data: member } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!member || (member as { role: 'MEMBER' | 'MANAGER' | 'ADMIN' }).role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only team admins can update team details' },
          { status: 403 }
        )
      }
    }

    // Build update object
    const updateData: any = { updated_at: new Date().toISOString() }
    
    if (name !== undefined) {
      // Check for duplicate team name (excluding current team)
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('name', name.trim())
        .neq('id', teamId)
        .maybeSingle()

      if (existingTeam) {
        return NextResponse.json(
          { error: 'A team with this name already exists. Please choose a different name.' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }
    
    if (color !== undefined) {
      updateData.color = color
    }

    // Update team
    const { data: team, error } = await (supabase
      .from('teams') as any)
      .update(updateData)
      .eq('id', teamId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ team })
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const { teamId } = params

    const isSuperAdminUser = isSuperAdmin(user)

    if (!isSuperAdminUser) {
      // Check if user is ADMIN of the team
      const { data: member } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!member || (member as { role: 'MEMBER' | 'MANAGER' | 'ADMIN' }).role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only team admins can delete teams' },
          { status: 403 }
        )
      }
    }

    // Check if team has other members
    const { data: allMembers, error: membersError } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)

    if (membersError) {
      return NextResponse.json(
        { error: membersError.message },
        { status: 400 }
      )
    }

    if (allMembers && allMembers.length > 1) {
      return NextResponse.json(
        { error: 'Cannot delete team with other members. Please remove all members first.' },
        { status: 400 }
      )
    }

    // Delete team (cascade will handle team_members)
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: 'Team deleted successfully' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
