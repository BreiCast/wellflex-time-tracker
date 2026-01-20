import type { User } from '@supabase/supabase-js'

const SUPERADMIN_ROLE = 'SUPERADMIN'

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase()

export function isSuperAdmin(user?: User | null) {
  if (!user) return false

  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>

  if (
    userMetadata.superadmin === true ||
    userMetadata.super_admin === true ||
    userMetadata.role === SUPERADMIN_ROLE ||
    appMetadata.role === SUPERADMIN_ROLE
  ) {
    return true
  }

  const email = normalizeEmail(user.email)
  const emailList = (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean)

  return Boolean(email && emailList.includes(email))
}
