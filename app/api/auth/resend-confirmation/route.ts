import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const resendSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    const supabase = createServiceSupabaseClient()
    
    // Resend the confirmation email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`,
      },
    })

    if (error) {
      // Handle specific errors
      let errorMessage = error.message
      
      // If user is already confirmed, provide helpful message
      if (
        error.message?.toLowerCase().includes('already confirmed') ||
        error.message?.toLowerCase().includes('email already confirmed')
      ) {
        return NextResponse.json(
          { error: 'This email is already confirmed. You can sign in instead.' },
          { status: 400 }
        )
      }
      
      // If user doesn't exist
      if (
        error.message?.toLowerCase().includes('user not found') ||
        error.message?.toLowerCase().includes('no user found')
      ) {
        return NextResponse.json(
          { error: 'No account found with this email address. Please sign up first.' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Confirmation email sent successfully'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

