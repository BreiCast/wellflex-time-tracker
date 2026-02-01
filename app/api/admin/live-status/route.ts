import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'

export type LiveStatusValue = 'Working' | 'On break' | 'Not working' | 'Unknown'

export type TodaySegmentType = 'work' | 'break'

export interface TodaySegment {
  type: TodaySegmentType
  start_at: string
  end_at: string | null
  break_type?: 'BREAK' | 'LUNCH'
}

export interface LiveStatusAgent {
  userId: string
  name: string
  teamId: string
  teamName: string
  status: LiveStatusValue
  since: string | null
  todayTotalMinutes: number
  break_type?: 'BREAK' | 'LUNCH'
  break_start_at?: string | null
  active_break_duration_minutes?: number
  today_segments: TodaySegment[]
}

export interface CoverageByTeam {
  teamId: string
  teamName: string
  total_agents: number
  working_count: number
  on_break_count: number
  min_working_count: number | null
}

function getTodayUTC(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  return { start: start.toISOString(), end: end.toISOString() }
}

type SessionRow = { id: string; clock_in_at: string; clock_out_at: string | null }
type BreakRow = { time_session_id: string; break_type: 'BREAK' | 'LUNCH'; break_start_at: string; break_end_at: string | null }

function buildTodaySegments(
  userSessions: SessionRow[],
  allBreaks: BreakRow[],
  nowIso: string
): TodaySegment[] {
  const segments: TodaySegment[] = []
  const sortedSessions = [...userSessions].sort(
    (a, b) => new Date(a.clock_in_at).getTime() - new Date(b.clock_in_at).getTime()
  )
  for (const sess of sortedSessions) {
    const sessionBreaks = allBreaks
      .filter(b => b.time_session_id === sess.id)
      .sort((a, b) => new Date(a.break_start_at).getTime() - new Date(b.break_start_at).getTime())
    const clockOut = sess.clock_out_at ?? nowIso
    let prevEnd = sess.clock_in_at
    for (const b of sessionBreaks) {
      if (new Date(b.break_start_at).getTime() <= new Date(prevEnd).getTime()) continue
      const workEnd = b.break_start_at
      segments.push({ type: 'work', start_at: prevEnd, end_at: workEnd })
      const breakEnd = b.break_end_at ?? nowIso
      segments.push({
        type: 'break',
        start_at: b.break_start_at,
        end_at: b.break_end_at,
        break_type: b.break_type,
      })
      prevEnd = breakEnd
    }
    if (new Date(prevEnd).getTime() < new Date(clockOut).getTime()) {
      segments.push({ type: 'work', start_at: prevEnd, end_at: clockOut })
    }
  }
  return segments.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceSupabaseClient()
    const isSuperAdminUser = isSuperAdmin(user)
    let teamIds: string[] = []

    if (isSuperAdminUser) {
      const { data: teams, error } = await supabase.from('teams').select('id')
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      teamIds = (teams || []).map((t: { id: string }) => t.id)
    } else {
      const { data: members, error } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .in('role', ['MANAGER', 'ADMIN'])
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      teamIds = (members || []).map((m: { team_id: string }) => m.team_id)
    }

    if (teamIds.length === 0) {
      return NextResponse.json({ agents: [] })
    }

    const { searchParams } = new URL(request.url)
    const filterTeamId = searchParams.get('team_id') || ''
    const filterStatus = searchParams.get('status') || ''
    const filterSearch = (searchParams.get('search') || '').trim().toLowerCase()

    const teamIdsToUse = filterTeamId ? [filterTeamId].filter(id => teamIds.includes(id)) : teamIds
    if (teamIdsToUse.length === 0) {
      return NextResponse.json({ agents: [] })
    }

    const { start: todayStart, end: todayEnd } = getTodayUTC()

    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('user_id, team_id, teams(id, name, min_working_count)')
      .in('team_id', teamIdsToUse)

    if (tmError) return NextResponse.json({ error: tmError.message }, { status: 400 })

    const byUserAndTeam = new Map<string, { teamId: string; teamName: string }>()
    const teamMinWorking = new Map<string, number | null>()
    const userIds = new Set<string>()
    for (const row of teamMembers || []) {
      // Cast via unknown to handle min_working_count which may not be in generated types yet
      const tm = row as unknown as { user_id: string; team_id: string; teams: { id: string; name: string; min_working_count?: number | null } | null }
      userIds.add(tm.user_id)
      byUserAndTeam.set(`${tm.user_id}:${tm.team_id}`, {
        teamId: tm.team_id,
        teamName: (tm.teams && tm.teams.name) || 'Unknown',
      })
      if (tm.teams && !teamMinWorking.has(tm.team_id)) {
        teamMinWorking.set(tm.team_id, tm.teams.min_working_count ?? null)
      }
    }

    if (userIds.size === 0) return NextResponse.json({ agents: [] })

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', Array.from(userIds))

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 })

    const userMap = new Map<string, { full_name: string | null; email: string }>()
    for (const u of users || []) {
      const us = u as { id: string; full_name: string | null; email: string }
      userMap.set(us.id, { full_name: us.full_name, email: us.email })
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('time_sessions')
      .select('id, user_id, team_id, clock_in_at, clock_out_at')
      .in('user_id', Array.from(userIds))
      .gte('clock_in_at', todayStart)
      .lte('clock_in_at', todayEnd)

    if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 400 })

    const sessionIds = (sessions || []).map((s: { id: string }) => s.id)
    let breaks: { time_session_id: string; break_type: 'BREAK' | 'LUNCH'; break_start_at: string; break_end_at: string | null }[] = []
    if (sessionIds.length > 0) {
      const { data: breakRows } = await supabase
        .from('break_segments')
        .select('time_session_id, break_type, break_start_at, break_end_at')
        .in('time_session_id', sessionIds)
      breaks = (breakRows || []) as typeof breaks
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const agents: LiveStatusAgent[] = []

    for (const row of teamMembers || []) {
      const tm = row as unknown as { user_id: string; team_id: string; teams: { id: string; name: string } | null }
      const userId = tm.user_id
      const teamId = tm.team_id
      const teamName = (tm.teams && tm.teams.name) || 'Unknown'
      const userInfo = userMap.get(userId)
      const name = (userInfo?.full_name || userInfo?.email || 'Unknown').trim()

      if (filterSearch && !name.toLowerCase().includes(filterSearch)) continue

      const userSessions = (sessions || []).filter(
        (s: { user_id: string; team_id: string }) => s.user_id === userId && s.team_id === teamId
      ) as { id: string; user_id: string; team_id: string; clock_in_at: string; clock_out_at: string | null }[]

      const activeSession = userSessions.find(s => s.clock_out_at == null) || null
      const activeBreakRow = activeSession
        ? breaks.find(
            b => b.time_session_id === activeSession.id && b.break_end_at == null
          ) as BreakRow | undefined
        : null

      let status: LiveStatusValue = 'Not working'
      let since: string | null = null

      if (activeSession) {
        if (activeBreakRow) {
          status = 'On break'
          since = activeBreakRow.break_start_at
        } else {
          status = 'Working'
          since = activeSession.clock_in_at
        }
      } else {
        const closedToday = userSessions.filter(s => s.clock_out_at != null)
        if (closedToday.length > 0) {
          const sorted = closedToday.sort(
            (a, b) => new Date(b.clock_out_at!).getTime() - new Date(a.clock_out_at!).getTime()
          )
          since = sorted[0].clock_out_at
        }
      }

      let todayTotalMinutes = 0
      for (const sess of userSessions) {
        const clockIn = new Date(sess.clock_in_at).getTime()
        const clockOut = sess.clock_out_at ? new Date(sess.clock_out_at).getTime() : now.getTime()
        const sessionMinutes = Math.floor((clockOut - clockIn) / (1000 * 60))
        const sessionBreaks = breaks.filter(b => b.time_session_id === sess.id && b.break_end_at != null)
        let breakMinutes = 0
        for (const b of sessionBreaks) {
          breakMinutes += Math.floor(
            (new Date(b.break_end_at!).getTime() - new Date(b.break_start_at).getTime()) / (1000 * 60)
          )
        }
        todayTotalMinutes += Math.max(0, sessionMinutes - breakMinutes)
      }

      if (filterStatus && status !== filterStatus) continue

      const today_segments = buildTodaySegments(
        userSessions as SessionRow[],
        breaks as BreakRow[],
        nowIso
      )

      const agent: LiveStatusAgent = {
        userId,
        name,
        teamId,
        teamName,
        status,
        since,
        todayTotalMinutes,
        today_segments,
      }
      if (status === 'On break' && activeBreakRow && since) {
        agent.break_type = activeBreakRow.break_type
        agent.break_start_at = since
        agent.active_break_duration_minutes = Math.floor(
          (now.getTime() - new Date(since).getTime()) / (1000 * 60)
        )
      }
      agents.push(agent)
    }

    const coverage_by_team: CoverageByTeam[] = []
    const teamCoverageMap = new Map<string, { teamName: string; total: number; working: number; onBreak: number }>()
    for (const a of agents) {
      const cur = teamCoverageMap.get(a.teamId) ?? { teamName: a.teamName, total: 0, working: 0, onBreak: 0 }
      cur.total += 1
      if (a.status === 'Working') cur.working += 1
      if (a.status === 'On break') cur.onBreak += 1
      teamCoverageMap.set(a.teamId, cur)
    }
    for (const [teamId, data] of teamCoverageMap) {
      coverage_by_team.push({
        teamId,
        teamName: data.teamName,
        total_agents: data.total,
        working_count: data.working,
        on_break_count: data.onBreak,
        min_working_count: teamMinWorking.get(teamId) ?? null,
      })
    }

    return NextResponse.json({ agents, coverage_by_team })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
