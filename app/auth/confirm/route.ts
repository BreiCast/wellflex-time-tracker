import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (token_hash && type) {
    const supabase = createServiceSupabaseClient()

    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    })

    if (!error) {
      // Get the user after verification
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Ensure user record exists (trigger should create it, but check just in case)
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
      }

      // Redirect to dashboard
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // If verification failed, redirect to login with error
  return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
}

