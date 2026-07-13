import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/utils/app-url'
import { sendAuthConfirmationEmail } from '@/lib/utils/email'
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
    const existingUser = existingUsers?.users.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in instead.' },
        { status: 400 }
      )
    }

    // Create the (unconfirmed) user and generate a confirmation token WITHOUT
    // triggering Supabase's own email. We send the email ourselves via SMTP so
    // the link stays on the app domain.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { full_name },
      },
    } as any)

    const hashedToken = (data as any)?.properties?.hashed_token

    if (error || !hashedToken) {
      let errorMessage = error?.message || 'Could not create account. Please try again.'
      if (
        errorMessage.toLowerCase().includes('already registered') ||
        errorMessage.toLowerCase().includes('already exists') ||
        (error as any)?.code === 'user_already_exists'
      ) {
        errorMessage = 'An account with this email address already exists. Please sign in instead.'
      }
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // App-hosted confirmation link: clicking it runs verifyOtp on /auth/confirm,
    // which signs the user in.
    const confirmUrl = `${getAppUrl()}/auth/confirm?token_hash=${hashedToken}&type=email`
    const sendResult = await sendAuthConfirmationEmail({ to: email, name: full_name, confirmUrl })

    if (!sendResult.success) {
      console.error('[AUTH] Signup confirmation email failed to send:', sendResult.error)
      return NextResponse.json(
        {
          error:
            'Your account was created, but we could not send the confirmation email. Please use "Resend email".',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ needsConfirmation: true })
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
