import { NextRequest } from 'next/server'

export function verifyCronBearerToken(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) return false

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.slice('Bearer '.length).trim()
  return token === expectedSecret
}
