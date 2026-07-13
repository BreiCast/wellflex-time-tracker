import { beforeEach, describe, expect, it, vi } from 'vitest'

const reviewerId = '00000000-0000-0000-0000-000000000001'
const requestId = '00000000-0000-0000-0000-000000000002'
const teamId = '00000000-0000-0000-0000-000000000003'
const requesterId = '00000000-0000-0000-0000-000000000004'
const sessionId = '00000000-0000-0000-0000-000000000005'

type MockState = {
  requests: Record<string, any>
  timeSessions: any[]
  failBreakInsert: boolean
  failAdjustmentInsert: boolean
  requestUpdates: any[]
  breakInserts: any[]
  adjustmentInserts: any[]
}

let state: MockState

class MockQueryBuilder {
  private filters: Record<string, any> = {}
  private action: 'select' | 'insert' | 'update' = 'select'
  private payload: any

  constructor(private table: string) {}

  select() {
    // No-op: select() is chained after update()/insert() to return the affected
    // row, so it must not clobber a pending write action. Reads default to 'select'.
    return this
  }

  insert(payload: any) {
    this.action = 'insert'
    this.payload = payload
    return this
  }

  update(payload: any) {
    this.action = 'update'
    this.payload = payload
    return this
  }

  eq(column: string, value: any) {
    this.filters[column] = value
    return this
  }

  gte() {
    return this
  }

  lte() {
    return this
  }

  order() {
    return this
  }

  limit() {
    return this
  }

  single() {
    return this.execute(true)
  }

  then(resolve: (value: any) => void, reject: (reason?: any) => void) {
    return Promise.resolve(this.execute(false)).then(resolve, reject)
  }

  private execute(single: boolean) {
    if (this.table === 'requests' && this.action === 'select') {
      return { data: state.requests[this.filters.id] ?? null, error: null }
    }

    if (this.table === 'team_members' && this.action === 'select') {
      return { data: { role: 'MANAGER' }, error: null }
    }

    if (this.table === 'time_sessions' && this.action === 'select') {
      return { data: single ? state.timeSessions[0] ?? null : state.timeSessions, error: null }
    }

    if (this.table === 'break_segments' && this.action === 'insert') {
      state.breakInserts.push(this.payload)
      return {
        data: null,
        error: state.failBreakInsert ? { message: 'break insert failed' } : null,
      }
    }

    if (this.table === 'adjustments' && this.action === 'insert') {
      state.adjustmentInserts.push(this.payload)
      return {
        data: null,
        error: state.failAdjustmentInsert ? { message: 'adjustment insert failed' } : null,
      }
    }

    if (this.table === 'requests' && this.action === 'update') {
      state.requestUpdates.push(this.payload)
      const current = state.requests[this.filters.id]
      if (!current || current.status !== this.filters.status) {
        return { data: null, error: { message: 'request update failed' } }
      }
      const updated = { ...current, ...this.payload }
      state.requests[this.filters.id] = updated
      return { data: updated, error: null }
    }

    return { data: null, error: null }
  }
}

const supabase = {
  from: vi.fn((table: string) => new MockQueryBuilder(table)),
}

vi.doMock('@/lib/auth/get-user', () => ({
  getUserFromRequest: vi.fn(async () => ({ id: reviewerId, email: 'manager@example.com' })),
}))

vi.doMock('@/lib/auth/superadmin', () => ({
  isSuperAdmin: vi.fn(() => false),
}))

vi.doMock('@/lib/supabase/server', () => ({
  createServiceSupabaseClient: vi.fn(() => supabase),
}))

vi.doMock('@/lib/utils/email', () => ({
  sendRequestNotificationEmail: vi.fn(),
  sendRequestConfirmationEmail: vi.fn(),
}))

vi.doMock('@/lib/utils/request-notification-recipients', () => ({
  getRequestNotificationRecipientEmails: vi.fn(async () => []),
}))

const { PATCH } = await import('./route')

function patchRequest() {
  return new Request('http://localhost/api/requests', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    body: JSON.stringify({ request_id: requestId, status: 'APPROVED' }),
  }) as any
}

beforeEach(() => {
  state = {
    requests: {},
    timeSessions: [{ id: sessionId }],
    failBreakInsert: false,
    failAdjustmentInsert: false,
    requestUpdates: [],
    breakInserts: [],
    adjustmentInserts: [],
  }
  supabase.from.mockClear()
})

describe('PATCH /api/requests approval correction failures', () => {
  it('does not approve a forgot-break request when break segment insert fails', async () => {
    state.failBreakInsert = true
    state.requests[requestId] = {
      id: requestId,
      user_id: requesterId,
      team_id: teamId,
      status: 'PENDING',
      request_type: 'Forgot to Log Break',
      requested_data: {
        date: '2026-05-12',
        time_from: '12:00',
        time_to: '12:15',
        break_type: 'BREAK',
      },
      time_session_id: null,
    }

    const response = await PATCH(patchRequest())
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain('break/lunch correction could not be inserted')
    expect(state.requests[requestId].status).toBe('PENDING')
    expect(state.requestUpdates).toHaveLength(0)
  })

  it('does not approve a request when adjustment insert fails', async () => {
    state.failAdjustmentInsert = true
    state.requests[requestId] = {
      id: requestId,
      user_id: requesterId,
      team_id: teamId,
      status: 'PENDING',
      request_type: 'Leave Early',
      requested_data: {
        date: '2026-05-12',
        time_from: '15:00',
        time_to: '17:00',
      },
      time_session_id: sessionId,
    }

    const response = await PATCH(patchRequest())
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain('adjustment could not be inserted')
    expect(state.requests[requestId].status).toBe('PENDING')
    expect(state.requestUpdates).toHaveLength(0)
  })
})

describe('PATCH /api/requests applies corrections exactly once', () => {
  it('inserts exactly one break segment when approving a forgot-break request', async () => {
    state.requests[requestId] = {
      id: requestId,
      user_id: requesterId,
      team_id: teamId,
      status: 'PENDING',
      request_type: 'Forgot to Log Break',
      requested_data: {
        date: '2026-05-12',
        time_from: '12:00',
        time_to: '12:15',
        break_type: 'BREAK',
      },
      time_session_id: null,
    }

    const response = await PATCH(patchRequest())

    expect(response.status).toBe(200)
    expect(state.breakInserts).toHaveLength(1)
    expect(state.requests[requestId].status).toBe('APPROVED')
    expect(state.requestUpdates).toHaveLength(1)
  })

  it('inserts exactly one adjustment when approving a leave request', async () => {
    state.requests[requestId] = {
      id: requestId,
      user_id: requesterId,
      team_id: teamId,
      status: 'PENDING',
      request_type: 'Leave Early',
      requested_data: {
        date: '2026-05-12',
        time_from: '15:00',
        time_to: '17:00',
      },
      time_session_id: sessionId,
    }

    const response = await PATCH(patchRequest())

    expect(response.status).toBe(200)
    expect(state.adjustmentInserts).toHaveLength(1)
    expect(state.requests[requestId].status).toBe('APPROVED')
    expect(state.requestUpdates).toHaveLength(1)
  })
})
