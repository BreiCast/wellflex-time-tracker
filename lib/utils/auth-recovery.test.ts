import { describe, expect, it } from 'vitest'
import { parseRecoveryPayloadFromUrl } from './auth-recovery'

describe('parseRecoveryPayloadFromUrl', () => {
  it('parses token_hash recovery payload', () => {
    const parsed = parseRecoveryPayloadFromUrl(
      'https://tracker.wellflex.co/reset-password?token_hash=abc123&type=recovery'
    )
    expect(parsed).toEqual({ kind: 'otp', tokenHash: 'abc123' })
  })

  it('parses PKCE code payload', () => {
    const parsed = parseRecoveryPayloadFromUrl(
      'https://tracker.wellflex.co/reset-password?code=pkceCodeValue'
    )
    expect(parsed).toEqual({ kind: 'code', code: 'pkceCodeValue' })
  })

  it('parses access and refresh tokens from hash fragment', () => {
    const parsed = parseRecoveryPayloadFromUrl(
      'https://tracker.wellflex.co/reset-password#access_token=at123&refresh_token=rt456&type=recovery'
    )
    expect(parsed).toEqual({
      kind: 'session',
      accessToken: 'at123',
      refreshToken: 'rt456',
    })
  })

  it('rejects links with no supported recovery payload', () => {
    const parsed = parseRecoveryPayloadFromUrl('https://tracker.wellflex.co/reset-password')
    expect(parsed.kind).toBe('invalid')
  })
})
