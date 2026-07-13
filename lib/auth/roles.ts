export type TeamRole = 'MEMBER' | 'MANAGER' | 'ADMIN'

export interface RoleAssigner {
  isSuperAdmin: boolean
  /** The requester's role on the target team, or null if not a member. */
  teamRole: TeamRole | null
}

/**
 * Whether a requester may assign `targetRole` when adding or inviting a member.
 *
 * Only ADMINs and superadmins may grant elevated roles (MANAGER or ADMIN).
 * MANAGERs may add plain MEMBERs only — this keeps invite/add-member consistent
 * with role changes (PATCH), which are already ADMIN-only, and closes the
 * privilege-escalation path where a manager could mint an admin.
 */
export function canAssignRole(requester: RoleAssigner, targetRole: TeamRole): boolean {
  if (requester.isSuperAdmin) return true
  if (requester.teamRole === 'ADMIN') return true
  return targetRole === 'MEMBER'
}
