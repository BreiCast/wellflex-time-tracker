/**
 * Base URL for building user-facing links (email confirmation, password reset,
 * invites). Must be set to https://tracker.wellflex.co in production via the
 * NEXT_PUBLIC_APP_URL environment variable. Falls back to localhost for local
 * development, and warns loudly if it is missing in production so auth links do
 * not silently point at localhost.
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[AUTH] NEXT_PUBLIC_APP_URL is not set in production; auth links will fall back to http://localhost:3000.'
      )
    }
    return 'http://localhost:3000'
  }
  return raw.replace(/\/+$/, '')
}
