/**
 * Shared UI tokens and pure class mappers. Keeping the class logic here (rather
 * than duplicated inline across components) means role/status colors live in one
 * place and can be unit-tested.
 */

/** Join truthy class name fragments (tiny clsx-style helper; no dependency). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Default team color when a team has none set (was the `#6366f1` literal). */
export const DEFAULT_TEAM_COLOR = '#6366f1'

export type TeamRole = 'MEMBER' | 'MANAGER' | 'ADMIN' | 'SUPERADMIN'
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** Badge classes for a team role. ADMIN/SUPERADMIN = primary, MANAGER = emerald, else slate. */
export function roleBadgeClasses(role: string | null | undefined): string {
  switch ((role || '').toUpperCase()) {
    case 'ADMIN':
    case 'SUPERADMIN':
      return 'bg-primary-50 text-primary-700'
    case 'MANAGER':
      return 'bg-emerald-50 text-emerald-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

/** Pill classes for a request status. */
export function statusPillClasses(status: string | null | undefined): string {
  switch ((status || '').toUpperCase()) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-700'
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700'
    case 'PENDING':
    default:
      return 'bg-amber-50 text-amber-700'
  }
}
