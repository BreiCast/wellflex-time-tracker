import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { z } from 'zod'

const addMemberSchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(['MEMBER', 'MANAGER', 'ADMIN']).default('MEMBER'),
})

export async function GET(
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
      // Verify user is member of team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!teamMember) {
        return NextResponse.json(
          { error: 'You are not a member of this team' },
          { status: 403 }
        )
      }
    }

    // Get all team members
    const { data: members, error } = await supabase
      .from('team_members')
      .select('id, user_id, role, users(id, email, full_name)')
      .eq('team_id', teamId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ members })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const { user_id, email, role } = addMemberSchema.parse(body)

    const isSuperAdminUser = isSuperAdmin(user)

    if (!isSuperAdminUser) {
      // Verify user is admin/manager of team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!teamMember || !['ADMIN', 'MANAGER'].includes((teamMember as { role: 'MEMBER' | 'MANAGER' | 'ADMIN' }).role)) {
        return NextResponse.json(
          { error: 'Only admins and managers can add members' },
          { status: 403 }
        )
      }
    }

    let targetUserId = user_id

    // If email provided, find or create user
    if (email && !targetUserId) {
      // Check if user exists in public.users
      let { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single() as { data: { id: string } | null }

      // If not in public.users, check auth.users and create record
      if (!existingUser) {
        const { data: authUsers } = await supabase.auth.admin.listUsers()
        const authUser = authUsers?.users.find((u: any) => u.email === email) as any
        
        if (authUser) {
          // User exists in auth but not in public.users - create the record
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email!,
              full_name: authUser.user_metadata?.full_name || null,
            } as any)
            .select('id')
            .single()

          if (createError && !createError.message.includes('duplicate')) {
            return NextResponse.json(
              { error: `Failed to create user record: ${createError.message}` },
              { status: 400 }
            )
          }

          existingUser = (newUser ? (newUser as { id: string }) : { id: authUser.id }) as { id: string } | null
        }
      }

      if (existingUser) {
        targetUserId = existingUser.id
      } else {
        // User doesn't exist yet - they'll need to sign up first
        return NextResponse.json(
          { error: 'User not found. Please invite them via email invite instead.' },
          { status: 404 }
        )
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Either user_id or email must be provided' },
        { status: 400 }
      )
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 400 }
      )
    }

    // Verify user exists in public.users before adding to team
    const { data: userCheck } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .single()

    if (!userCheck) {
      // Try to create user record from auth.users
      const { data: authUser } = await supabase.auth.admin.getUserById(targetUserId)
      
      if (authUser?.user) {
        await supabase.from('users').insert({
          id: authUser.user.id,
          email: authUser.user.email!,
          full_name: authUser.user.user_metadata?.full_name || null,
        } as any)
      } else {
        return NextResponse.json(
          { error: 'User not found in system' },
          { status: 404 }
        )
      }
    }

    // Add member
    const { data: member, error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: targetUserId,
        role,
      } as any)
      .select('id, user_id, role, users(id, email, full_name)')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ member })
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
    
    // Support both query param (legacy) and body (new)
    const { searchParams } = new URL(request.url)
    let userId = searchParams.get('user_id')
    let membershipId: string | null = null
    
    // Try to get from body if not in query params
    if (!userId) {
      try {
        const body = await request.json()
        userId = body.user_id || null
        membershipId = body.membership_id || null
      } catch {
        // Body might be empty, that's okay
      }
    }

    if (!userId && !membershipId) {
      return NextResponse.json(
        { error: 'user_id or membership_id is required' },
        { status: 400 }
      )
    }

    const isSuperAdminUser = isSuperAdmin(user)

    if (!isSuperAdminUser) {
      // Verify user is admin of team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!teamMember || (teamMember as { role: 'MEMBER' | 'MANAGER' | 'ADMIN' }).role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only admins can remove members' },
          { status: 403 }
        )
      }
    }

    // Don't allow removing yourself - check by membership_id or user_id
    if (membershipId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('id', membershipId)
        .single()
      
      if (membership && (membership as { user_id: string }).user_id === user.id) {
        return NextResponse.json(
          { error: 'You cannot remove yourself from the team' },
          { status: 400 }
        )
      }
    } else if (userId === user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the team' },
        { status: 400 }
      )
    }

    // Remove member - use membership_id if provided, otherwise use user_id
    let deleteQuery = supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
    
    if (membershipId) {
      deleteQuery = deleteQuery.eq('id', membershipId)
    } else {
      deleteQuery = deleteQuery.eq('user_id', userId!)
    }
    
    const { error } = await deleteQuery

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const { user_id, membership_id, role } = z.object({
      user_id: z.string().uuid().optional(),
      membership_id: z.string().uuid().optional(),
      role: z.enum(['MEMBER', 'MANAGER', 'ADMIN']),
    }).refine((data) => data.user_id || data.membership_id, {
      message: 'user_id or membership_id is required',
    }).parse(body)

    const isSuperAdminUser = isSuperAdmin(user)

    if (!isSuperAdminUser) {
      // Verify requesting user is admin of team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!teamMember || (teamMember as { role: 'MEMBER' | 'MANAGER' | 'ADMIN' }).role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only admins can change member roles' },
          { status: 403 }
        )
      }
    }

    // Update role
    let updateQuery = supabase
      .from('team_members')
      .update({ role } as any)
      .eq('team_id', teamId)    if (membership_id) {
      updateQuery = updateQuery.eq('id', membership_id)
    } else {
      updateQuery = updateQuery.eq('user_id', user_id!)
    }

    const { data: updatedMember, error } = await updateQuery
      .select('id, user_id, role, users(id, email, full_name)')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ member: updatedMember })
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