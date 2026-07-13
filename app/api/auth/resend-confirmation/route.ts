import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/utils/app-url'
import { sendAuthConfirmationEmail } from '@/lib/utils/email'
import { z } from 'zod'

const resendSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    const supabase = createServiceSupabaseClient()

    // Look up the user to give clear feedback for "already confirmed" / "no account".
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!existingUser) {
      return NextResponse.json(
        { error: 'No account found with this email address. Please sign up first.' },
        { status: 404 }
      )
    }

    if ((existingUser as any).email_confirmed_at) {
      return NextResponse.json(
        { error: 'This email is already confirmed. You can sign in instead.' },
        { status: 400 }
      )
    }

    // Generate a magic link (confirms the email and signs the user in on click)
    // and send it ourselves via SMTP so the link stays on the app domain.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    } as any)

    const hashedToken = (data as any)?.properties?.hashed_token

    if (error || !hashedToken) {
      return NextResponse.json(
        { error: error?.message || 'Could not resend confirmation email. Please try again.' },
        { status: 400 }
      )
    }

    const confirmUrl = `${getAppUrl()}/auth/confirm?token_hash=${hashedToken}&type=magiclink`
    const sendResult = await sendAuthConfirmationEmail({
      to: email,
      name: (existingUser as any).user_metadata?.full_name || null,
      confirmUrl,
    })

    if (!sendResult.success) {
      console.error('[AUTH] Resend confirmation email failed to send:', sendResult.error)
      return NextResponse.json(
        { error: 'Could not send the confirmation email. Please try again shortly.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Confirmation email sent successfully',
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
