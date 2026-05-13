import { describe, expect, it } from 'vitest'
import {
  isTimeEntryEditValidationError,
  validateBreakSegmentEdit,
  validateTimeSessionEdit,
} from './time-entry-edit-validation'

type TableData = Record<string, any[]>

class FakeQuery {
  private filters: Array<{ field: string; value: any; op: 'eq' | 'neq' }> = []

  constructor(private tables: TableData, private tableName: string) {}

  select() {
    return this
  }

  eq(field: string, value: any) {
    this.filters.push({ field, value, op: 'eq' })
    return this
  }

  neq(field: string, value: any) {
    this.filters.push({ field, value, op: 'neq' })
    return this
  }

  async single() {
    return { data: this.rows()[0] ?? null, error: null }
  }

  then(resolve: (value: { data: any[]; error: null }) => unknown) {
    return Promise.resolve({ data: this.rows(), error: null }).then(resolve)
  }

  private rows() {
    return (this.tables[this.tableName] || [])
      .map((row) => this.withJoins(row))
      .filter((row) => this.matches(row))
  }

  private withJoins(row: any) {
    if (this.tableName !== 'break_segments') return { ...row }

    const session = this.tables.time_sessions.find((timeSession) => timeSession.id === row.time_session_id)
    return {
      ...row,
      time_sessions: session
        ? {
            user_id: session.user_id,
            team_id: session.team_id,
            clock_in_at: session.clock_in_at,
            clock_out_at: session.clock_out_at,
          }
        : null,
    }
  }

  private getField(row: any, field: string) {
    return field.split('.').reduce((current, segment) => current?.[segment], row)
  }

  private matches(row: any) {
    return this.filters.every(({ field, value, op }) => {
      const actual = this.getField(row, field)
      return op === 'eq' ? actual === value : actual !== value
    })
  }
}

function createSupabase(tables: TableData) {
  return {
    from(tableName: string) {
      return new FakeQuery(tables, tableName)
    },
  }
}

describe('time entry edit validation', () => {
  it('rejects time session edits that overlap another session for the same user and team', async () => {
    const supabase = createSupabase({
      time_sessions: [
        {
          id: 'session-1',
          user_id: 'user-1',
          team_id: 'team-1',
          clock_in_at: '2026-05-13T09:00:00.000Z',
          clock_out_at: '2026-05-13T12:00:00.000Z',
        },
        {
          id: 'session-2',
          user_id: 'user-1',
          team_id: 'team-1',
          clock_in_at: '2026-05-13T12:30:00.000Z',
          clock_out_at: '2026-05-13T17:00:00.000Z',
        },
        {
          id: 'session-other-team',
          user_id: 'user-1',
          team_id: 'team-2',
          clock_in_at: '2026-05-13T11:00:00.000Z',
          clock_out_at: '2026-05-13T13:00:00.000Z',
        },
      ],
    })

    const result = await validateTimeSessionEdit(supabase, {
      timeSessionId: 'session-1',
      newClockOutAt: '2026-05-13T13:00:00.000Z',
    })

    expect(isTimeEntryEditValidationError(result)).toBe(true)
    expect(result).toMatchObject({
      error: 'Time session overlaps another session for this user and team',
      status: 400,
    })
  })

  it('rejects break edits outside the parent session bounds', async () => {
    const supabase = createSupabase({
      time_sessions: [
        {
          id: 'session-1',
          user_id: 'user-1',
          team_id: 'team-1',
          clock_in_at: '2026-05-13T09:00:00.000Z',
          clock_out_at: '2026-05-13T17:00:00.000Z',
        },
      ],
      break_segments: [
        {
          id: 'break-1',
          time_session_id: 'session-1',
          break_start_at: '2026-05-13T12:00:00.000Z',
          break_end_at: '2026-05-13T12:30:00.000Z',
        },
      ],
    })

    const startsBeforeClockIn = await validateBreakSegmentEdit(supabase, {
      breakSegmentId: 'break-1',
      newBreakStartAt: '2026-05-13T08:59:00.000Z',
    })
    const endsAfterClockOut = await validateBreakSegmentEdit(supabase, {
      breakSegmentId: 'break-1',
      newBreakEndAt: '2026-05-13T17:01:00.000Z',
    })

    expect(startsBeforeClockIn).toMatchObject({
      error: 'Break cannot start before clock in',
      status: 400,
    })
    expect(endsAfterClockOut).toMatchObject({
      error: 'Break cannot end after clock out',
      status: 400,
    })
  })

  it('rejects break edits that overlap sibling break segments', async () => {
    const supabase = createSupabase({
      time_sessions: [
        {
          id: 'session-1',
          user_id: 'user-1',
          team_id: 'team-1',
          clock_in_at: '2026-05-13T09:00:00.000Z',
          clock_out_at: '2026-05-13T17:00:00.000Z',
        },
      ],
      break_segments: [
        {
          id: 'break-1',
          time_session_id: 'session-1',
          break_start_at: '2026-05-13T12:00:00.000Z',
          break_end_at: '2026-05-13T12:15:00.000Z',
        },
        {
          id: 'break-2',
          time_session_id: 'session-1',
          break_start_at: '2026-05-13T12:30:00.000Z',
          break_end_at: '2026-05-13T13:00:00.000Z',
        },
      ],
    })

    const result = await validateBreakSegmentEdit(supabase, {
      breakSegmentId: 'break-1',
      newBreakEndAt: '2026-05-13T12:45:00.000Z',
    })

    expect(isTimeEntryEditValidationError(result)).toBe(true)
    expect(result).toMatchObject({
      error: 'Break segment overlaps another break for this time session',
      status: 400,
    })
  })
})
