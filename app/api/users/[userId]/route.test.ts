import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminId = '00000000-0000-0000-0000-0000000000a1'
const targetId = '00000000-0000-0000-0000-0000000000b2'

type State = {
  adminTeamIds: string[] // teams where the requester is ADMIN
  targetTeamIds: string[] // teams the target user belongs to
  isSuper: boolean
}
let state: State

class MockQB {
  private filters: Record<string, any> = {}
  private inFilter?: { col: string; vals: any[] }
  private action: 'select' | 'update' = 'select'
  constructor(private table: string) {}
  select() { return this }
  update() { this.action = 'update'; return this }
  eq(col: string, val: any) { this.filters[col] = val; return this }
  in(col: string, vals: any[]) { this.inFilter = { col, vals }; return this }
  limit() { return this }
  maybeSingle() { return this.execSingle() }
  single() { return this.execSingle() }
  then(resolve: (v: any) => void, reject: (r?: any) => void) {
    return Promise.resolve(this.execList()).then(resolve, reject)
  }

  private execSingle() {
    // Shared-membership check: target user's memberships intersected with admin teams
    if (this.table === 'team_members' && this.filters.user_id === targetId && this.inFilter) {
      const shared = state.targetTeamIds.some((t) => this.inFilter!.vals.includes(t))
      return { data: shared ? { id: 'membership-1' } : null, error: null }
    }
    if (this.table === 'users' && this.action === 'select') {
      return { data: { id: targetId }, error: null }
    }
    return { data: null, error: null }
  }

  private execList() {
    // Admin teams lookup
    if (this.table === 'team_members' && this.filters.role === 'ADMIN' && this.filters.user_id === adminId) {
      return { data: state.adminTeamIds.map((id) => ({ team_id: id })), error: null }
    }
    if (this.table === 'users' && this.action === 'update') {
      return { data: null, error: null }
    }
    return { data: null, error: null }
  }
}

const supabase = {
  from: vi.fn((t: string) => new MockQB(t)),
  auth: { admin: { updateUserById: vi.fn(async () => ({ error: null })) } },
}

vi.doMock('@/lib/auth/get-user', () => ({
  getUserFromRequest: vi.fn(async () => ({ id: adminId, email: 'admin@example.com' })),
}))
vi.doMock('@/lib/auth/superadmin', () => ({
  isSuperAdmin: vi.fn(() => state.isSuper),
}))
vi.doMock('@/lib/supabase/server', () => ({
  createServiceSupabaseClient: () => supabase,
}))

const { PATCH } = await import('./route')

function patchReq() {
  return new Request('http://localhost/api/users/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
    body: JSON.stringify({ full_name: 'New Name' }),
  }) as any
}

beforeEach(() => {
  state = { adminTeamIds: ['team-A'], targetTeamIds: ['team-A'], isSuper: false }
  supabase.from.mockClear()
})

describe('PATCH /api/users/[userId] authorization', () => {
  it('allows an admin to rename a user who shares one of their teams', async () => {
    const res = await PATCH(patchReq(), { params: { userId: targetId } })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('forbids renaming a user on a team the requester does not administer', async () => {
    state.targetTeamIds = ['team-B'] // no overlap with admin's team-A
    const res = await PATCH(patchReq(), { params: { userId: targetId } })
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toContain('teams you administer')
  })

  it('forbids a non-admin entirely', async () => {
    state.adminTeamIds = []
    const res = await PATCH(patchReq(), { params: { userId: targetId } })
    expect(res.status).toBe(403)
  })
})
