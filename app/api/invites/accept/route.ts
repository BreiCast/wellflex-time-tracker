import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url))
  }

  const supabase = createServiceSupabaseClient()

  // Verify the invite token
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: type as any,
    token_hash,
  })

  if (verifyError) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url))
  }

  // Get the user after verification
  const { data: { user } } = await supabase.auth.getUser()

  if (user && user.user_metadata?.team_id && user.user_metadata?.role) {
    // Create user record if it doesn't exist
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingUser) {
      await supabase.from('users').insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || null,
      } as any)
    }

    // Add user to team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: user.user_metadata.team_id,
        user_id: user.id,
        role: user.user_metadata.role,
      } as any)

    if (memberError && !memberError.message.includes('duplicate')) {
      console.error('Error adding user to team:', memberError)
    }
  }

  // Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url))
}

