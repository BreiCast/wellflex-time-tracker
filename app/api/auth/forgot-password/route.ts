import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/utils/app-url'
import { sendPasswordResetEmail } from '@/lib/utils/email'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    const supabase = createServiceSupabaseClient()

    // Generate a recovery link and send it ourselves via SMTP so the link stays
    // on the app domain. generateLink errors if the user does not exist; we
    // swallow that and always return success to avoid leaking which emails are
    // registered (user enumeration).
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
    } as any)

    const hashedToken = (data as any)?.properties?.hashed_token

    if (error || !hashedToken) {
      const message = error?.message?.toLowerCase() || ''
      if (message && !message.includes('not found') && !message.includes('no user')) {
        // A real, unexpected failure — log it but still return a generic response.
        console.error('[AUTH] Failed to generate recovery link:', error?.message)
      }
      return NextResponse.json({ success: true })
    }

    const resetUrl = `${getAppUrl()}/reset-password?token_hash=${hashedToken}&type=recovery`
    const sendResult = await sendPasswordResetEmail({ to: email, resetUrl })

    if (!sendResult.success) {
      console.error('[AUTH] Password reset email failed to send:', sendResult.error)
    }

    return NextResponse.json({ success: true })
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
