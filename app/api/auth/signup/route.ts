import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1, 'Full name is required').max(255),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name } = signupSchema.parse(body)

    const supabase = createServiceSupabaseClient()
    
    // Check if user already exists before attempting signup
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in instead.' },
        { status: 400 }
      )
    }

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`,
      },
    })

    if (error) {
      // Handle specific Supabase errors
      let errorMessage = error.message
      
      // Check for duplicate email errors (Supabase may return different error codes)
      if (
        error.message?.toLowerCase().includes('already registered') ||
        error.message?.toLowerCase().includes('user already exists') ||
        error.message?.toLowerCase().includes('email address is already') ||
        error.code === 'user_already_exists'
      ) {
        errorMessage = 'An account with this email address already exists. Please sign in instead.'
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    // Note: User record will be created after email confirmation
    // via the auth callback handler

    return NextResponse.json({ 
      user: data.user,
      needsConfirmation: !data.session 
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

