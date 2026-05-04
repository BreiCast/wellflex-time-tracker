export type RecoveryPayload =
  | { kind: 'otp'; tokenHash: string }
  | { kind: 'code'; code: string }
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'invalid'; reason: string }

/**
 * Parse Supabase recovery payload from URL query/hash.
 * Supports:
 * - ?token_hash=...&type=recovery
 * - ?code=...
 * - #access_token=...&refresh_token=...&type=recovery
 */
export function parseRecoveryPayloadFromUrl(urlString: string): RecoveryPayload {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return { kind: 'invalid', reason: 'Invalid URL' }
  }

  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const code = url.searchParams.get('code')

  if (tokenHash && type === 'recovery') {
    return { kind: 'otp', tokenHash }
  }

  if (code) {
    return { kind: 'code', code }
  }

  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  if (hash) {
    const hashParams = new URLSearchParams(hash)
    const hashType = hashParams.get('type')
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (hashType === 'recovery' && accessToken && refreshToken) {
      return { kind: 'session', accessToken, refreshToken }
    }
  }

  return { kind: 'invalid', reason: 'Missing recovery payload' }
}
