import { beforeEach, describe, expect, it, vi } from 'vitest'

// getAppUrl reads this at call time; set it so links resolve to the app domain.
process.env.NEXT_PUBLIC_APP_URL = 'https://tracker.wellflex.co'

const generateLink = vi.fn()
const listUsers = vi.fn()
const sendAuthConfirmationEmail = vi.fn(async () => ({ success: true }))
const sendPasswordResetEmail = vi.fn(async () => ({ success: true }))

vi.doMock('@/lib/supabase/server', () => ({
  createServiceSupabaseClient: () => ({
    auth: { admin: { generateLink, listUsers } },
  }),
}))

vi.doMock('@/lib/utils/email', () => ({
  sendAuthConfirmationEmail,
  sendPasswordResetEmail,
}))

const { POST: signupPOST } = await import('./signup/route')
const { POST: resendPOST } = await import('./resend-confirmation/route')
const { POST: forgotPOST } = await import('./forgot-password/route')

function jsonRequest(body: any) {
  return new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

beforeEach(() => {
  generateLink.mockReset()
  listUsers.mockReset()
  sendAuthConfirmationEmail.mockClear()
  sendPasswordResetEmail.mockClear()
  sendAuthConfirmationEmail.mockResolvedValue({ success: true })
  sendPasswordResetEmail.mockResolvedValue({ success: true })
  listUsers.mockResolvedValue({ data: { users: [] }, error: null })
})

describe('POST /api/auth/signup', () => {
  it('creates the account and emails a tracker.wellflex.co confirm link', async () => {
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'HASH123' } }, error: null })

    const res = await signupPOST(jsonRequest({ email: 'new@example.com', password: 'secret123', full_name: 'New User' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.needsConfirmation).toBe(true)
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'new@example.com' }))
    expect(sendAuthConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        confirmUrl: 'https://tracker.wellflex.co/auth/confirm?token_hash=HASH123&type=email',
      })
    )
  })

  it('rejects an already-registered email', async () => {
    listUsers.mockResolvedValue({ data: { users: [{ email: 'new@example.com' }] }, error: null })

    const res = await signupPOST(jsonRequest({ email: 'new@example.com', password: 'secret123', full_name: 'New User' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('already exists')
    expect(generateLink).not.toHaveBeenCalled()
    expect(sendAuthConfirmationEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/resend-confirmation', () => {
  it('emails a magic-link confirm URL for an unconfirmed user', async () => {
    listUsers.mockResolvedValue({
      data: { users: [{ email: 'p@example.com', email_confirmed_at: null, user_metadata: { full_name: 'Pat' } }] },
      error: null,
    })
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'H2' } }, error: null })

    const res = await resendPOST(jsonRequest({ email: 'p@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: 'magiclink', email: 'p@example.com' }))
    expect(sendAuthConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmUrl: 'https://tracker.wellflex.co/auth/confirm?token_hash=H2&type=magiclink',
      })
    )
  })

  it('reports already-confirmed users without sending', async () => {
    listUsers.mockResolvedValue({
      data: { users: [{ email: 'p@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }] },
      error: null,
    })

    const res = await resendPOST(jsonRequest({ email: 'p@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('already confirmed')
    expect(sendAuthConfirmationEmail).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown email', async () => {
    const res = await resendPOST(jsonRequest({ email: 'ghost@example.com' }))
    expect(res.status).toBe(404)
    expect(sendAuthConfirmationEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/forgot-password', () => {
  it('emails a tracker.wellflex.co recovery link', async () => {
    generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'H3' } }, error: null })

    const res = await forgotPOST(jsonRequest({ email: 'user@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: 'recovery', email: 'user@example.com' }))
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        resetUrl: 'https://tracker.wellflex.co/reset-password?token_hash=H3&type=recovery',
      })
    )
  })

  it('does not reveal whether an email exists (no enumeration)', async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: 'User not found' } })

    const res = await forgotPOST(jsonRequest({ email: 'ghost@example.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })
})
