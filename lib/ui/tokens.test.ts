import { describe, it, expect } from 'vitest'
import { roleBadgeClasses, statusPillClasses } from './tokens'

describe('roleBadgeClasses', () => {
  it('maps admin/superadmin to primary', () => {
    expect(roleBadgeClasses('ADMIN')).toContain('primary')
    expect(roleBadgeClasses('SUPERADMIN')).toContain('primary')
    expect(roleBadgeClasses('admin')).toContain('primary') // case-insensitive
  })

  it('maps manager to emerald and member/unknown to slate', () => {
    expect(roleBadgeClasses('MANAGER')).toContain('emerald')
    expect(roleBadgeClasses('MEMBER')).toContain('slate')
    expect(roleBadgeClasses(null)).toContain('slate')
    expect(roleBadgeClasses(undefined)).toContain('slate')
  })
})

describe('statusPillClasses', () => {
  it('maps status to color', () => {
    expect(statusPillClasses('APPROVED')).toContain('emerald')
    expect(statusPillClasses('REJECTED')).toContain('rose')
    expect(statusPillClasses('PENDING')).toContain('amber')
    expect(statusPillClasses(undefined)).toContain('amber') // default
  })
})
