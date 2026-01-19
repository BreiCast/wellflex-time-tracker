import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { z } from 'zod'

const inviteSchema = z.object({
  team_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['MEMBER', 'MANAGER', 'ADMIN']).default('MEMBER'),
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
    const { team_id, email, role } = inviteSchema.parse(body)

    // Verify user is admin/manager of team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .single()

    const memberRole = (teamMember as { role: 'MEMBER' | 'MANAGER' | 'ADMIN' } | null)?.role
    if (!teamMember || !memberRole || !['ADMIN', 'MANAGER'].includes(memberRole)) {
      return NextResponse.json(
        { error: 'Only admins and managers can send invites' },
        { status: 403 }
      )
    }

    // Check if user already exists in public.users
    let { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()
    
    let existingUserData: { id: string } | null = existingUser as { id: string } | null

    // If not in public.users, check auth.users and create record
    if (!existingUser) {
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const authUser = authUsers?.users.find((u: any) => u.email === email)
      
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

        existingUserData = (newUser as { id: string } | null) || { id: authUser.id }
      }
    }

    if (existingUserData) {
      // User exists - check if already a member
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team_id)
        .eq('user_id', existingUserData.id)
        .single()

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this team' },
          { status: 400 }
        )
      }

      // Add directly to team
      const { data: member, error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id,
          user_id: existingUserData.id,
          role,
        } as any)
        .select()
        .single()

      if (memberError) {
        return NextResponse.json(
          { error: memberError.message },
          { status: 400 }
        )
      }

      return NextResponse.json({ 
        success: true,
        message: 'User added to team',
        member 
      })
    }

    // User doesn't exist - send invite via Supabase Auth
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          team_id,
          role,
          invited_by: user.id,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/accept-invite`,
      }
    )

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invite sent successfully',
      user: inviteData.user 
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

