import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { z } from 'zod'

const updateUserNameSchema = z.object({
  full_name: z.string().min(1).max(255),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await getUserFromRequest(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const { userId } = params
    const body = await request.json()
    const { full_name } = updateUserNameSchema.parse(body)

    // Verify admin is actually an admin of at least one team
    const { data: adminTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', admin.id)
      .eq('role', 'ADMIN')
      .limit(1)

    if (!adminTeams || adminTeams.length === 0) {
      return NextResponse.json(
        { error: 'Only admins can update user names' },
        { status: 403 }
      )
    }

    // Verify the user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update public.users table
    const { error: updateError } = await supabase
      .from('users')
      .update({ full_name } as any)
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update user name', details: updateError.message },
        { status: 400 }
      )
    }

    // Also update auth.users metadata
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          full_name: full_name,
        },
      }
    )

    if (authUpdateError) {
      console.error('Failed to update auth user metadata:', authUpdateError)
      // Don't fail the request if auth update fails, the public.users update succeeded
    }

    return NextResponse.json({ 
      success: true,
      message: 'User name updated successfully'
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

