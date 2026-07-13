import { describe, it, expect } from 'vitest'
import { canAssignRole } from './roles'

describe('canAssignRole', () => {
  it('lets superadmins assign any role', () => {
    for (const role of ['MEMBER', 'MANAGER', 'ADMIN'] as const) {
      expect(canAssignRole({ isSuperAdmin: true, teamRole: null }, role)).toBe(true)
    }
  })

  it('lets team admins assign any role', () => {
    for (const role of ['MEMBER', 'MANAGER', 'ADMIN'] as const) {
      expect(canAssignRole({ isSuperAdmin: false, teamRole: 'ADMIN' }, role)).toBe(true)
    }
  })

  it('lets managers assign MEMBER only', () => {
    expect(canAssignRole({ isSuperAdmin: false, teamRole: 'MANAGER' }, 'MEMBER')).toBe(true)
    expect(canAssignRole({ isSuperAdmin: false, teamRole: 'MANAGER' }, 'MANAGER')).toBe(false)
    expect(canAssignRole({ isSuperAdmin: false, teamRole: 'MANAGER' }, 'ADMIN')).toBe(false)
  })

  it('does not let plain members or non-members assign elevated roles', () => {
    expect(canAssignRole({ isSuperAdmin: false, teamRole: 'MEMBER' }, 'ADMIN')).toBe(false)
    expect(canAssignRole({ isSuperAdmin: false, teamRole: null }, 'MANAGER')).toBe(false)
  })
})
