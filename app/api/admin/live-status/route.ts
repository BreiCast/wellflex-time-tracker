import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { getDayBounds } from '@/lib/utils/date'

export type LiveStatusValue = 'Working' | 'On break' | 'Not working' | 'Unknown'

export type TodaySegmentType = 'work' | 'break'

export interface TodaySegment {
  type: TodaySegmentType
  start_at: string
  end_at: string | null
  break_type?: 'BREAK' | 'LUNCH'
  team_id?: string
  team_name?: string
  team_color?: string
}

export interface LiveStatusAgent {
  userId: string
  name: string
  teamId: string
  teamName: string
  teamIds: string[]
  status: LiveStatusValue
  since: string | null
  active_session_id?: string | null
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

// getTodayUTC removed – now using shared getTodayBounds from @/lib/utils/date

type SessionRow = {
  id: string
  user_id: string
  team_id: string | null
  clock_in_at: string
  clock_out_at: string | null
}
type BreakRow = { time_session_id: string; break_type: 'BREAK' | 'LUNCH'; break_start_at: string; break_end_at: string | null }
type TeamMeta = { name: string; color: string }

function buildTodaySegments(
  userSessions: SessionRow[],
  allBreaks: BreakRow[],
  teamMetaById: Map<string, TeamMeta>,
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
      const teamMeta = sess.team_id ? teamMetaById.get(sess.team_id) : undefined
      segments.push({
        type: 'work',
        start_at: prevEnd,
        end_at: workEnd,
        team_id: sess.team_id ?? undefined,
        team_name: teamMeta?.name,
        team_color: teamMeta?.color,
      })
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
      const teamMeta = sess.team_id ? teamMetaById.get(sess.team_id) : undefined
      segments.push({
        type: 'work',
        start_at: prevEnd,
        end_at: clockOut,
        team_id: sess.team_id ?? undefined,
        team_name: teamMeta?.name,
        team_color: teamMeta?.color,
      })
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
    const offsetMinutes = parseInt(searchParams.get('offset_minutes') || '0', 10) || 0

    const teamIdsToUse = filterTeamId ? [filterTeamId].filter(id => teamIds.includes(id)) : teamIds
    if (teamIdsToUse.length === 0) {
      return NextResponse.json({ agents: [] })
    }

    const targetDate = searchParams.get('date')
    const { start: dayStart, end: dayEnd } = getDayBounds(targetDate, offsetMinutes)

    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('user_id, team_id, teams(id, name, color, min_working_count)')
      .in('team_id', teamIdsToUse)

    if (tmError) return NextResponse.json({ error: tmError.message }, { status: 400 })

    const teamMetaById = new Map<string, TeamMeta>()
    const teamMinWorking = new Map<string, number | null>()
    const userIds = new Set<string>()
    const teamIdsByUser = new Map<string, Set<string>>()
    for (const row of teamMembers || []) {
      // Cast via unknown to handle properties that may not be in generated types yet
      const tm = row as unknown as {
        user_id: string
        team_id: string
        teams: { id: string; name: string; color?: string | null; min_working_count?: number | null } | null
      }
      userIds.add(tm.user_id)
      if (!teamIdsByUser.has(tm.user_id)) teamIdsByUser.set(tm.user_id, new Set())
      teamIdsByUser.get(tm.user_id)!.add(tm.team_id)

      if (!teamMetaById.has(tm.team_id)) {
        teamMetaById.set(tm.team_id, {
          name: (tm.teams && tm.teams.name) || 'Unknown',
          color: tm.teams?.color || '#6366f1',
        })
      }
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
      .in('team_id', teamIdsToUse)
      .gte('clock_in_at', dayStart)
      .lte('clock_in_at', dayEnd)

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

    const allSessions = (sessions || []) as SessionRow[]

    for (const userId of userIds) {
      const userTeamIds = Array.from(teamIdsByUser.get(userId) || [])
      const userInfo = userMap.get(userId)
      const name = (userInfo?.full_name || userInfo?.email || 'Unknown').trim()

      if (filterSearch && !name.toLowerCase().includes(filterSearch)) continue

      const userSessions = allSessions.filter((s) => s.user_id === userId)

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

      const teamMinutes = new Map<string, number>()
      for (const sess of userSessions) {
        if (!sess.team_id) continue
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
        const workedMinutes = Math.max(0, sessionMinutes - breakMinutes)
        teamMinutes.set(sess.team_id, (teamMinutes.get(sess.team_id) || 0) + workedMinutes)
      }

      const primaryTeamId = (() => {
        if (activeSession?.team_id) return activeSession.team_id
        if (teamMinutes.size > 0) {
          return [...teamMinutes.entries()].sort((a, b) => b[1] - a[1])[0][0]
        }
        return userTeamIds
          .sort((a, b) => (teamMetaById.get(a)?.name || '').localeCompare(teamMetaById.get(b)?.name || ''))[0] || ''
      })()

      const primaryTeamName = teamMetaById.get(primaryTeamId)?.name || 'Unknown'

      const today_segments = buildTodaySegments(
        userSessions,
        breaks as BreakRow[],
        teamMetaById,
        nowIso
      )

      const agent: LiveStatusAgent = {
        userId,
        name,
        teamId: primaryTeamId,
        teamName: primaryTeamName,
        teamIds: userTeamIds,
        status,
        since,
        active_session_id: activeSession?.id ?? null,
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
    for (const teamId of teamIdsToUse) {
      const teamName = teamMetaById.get(teamId)?.name || 'Unknown'
      const teamAgents = agents.filter(a => a.teamIds.includes(teamId))
      const workingCount = teamAgents.filter(a => a.status === 'Working').length
      const onBreakCount = teamAgents.filter(a => a.status === 'On break').length
      coverage_by_team.push({
        teamId,
        teamName,
        total_agents: teamAgents.length,
        working_count: workingCount,
        on_break_count: onBreakCount,
        min_working_count: teamMinWorking.get(teamId) ?? null,
      })
    }

    return NextResponse.json({ agents, coverage_by_team })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
