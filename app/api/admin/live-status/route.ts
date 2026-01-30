import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'

export type LiveStatusValue = 'Working' | 'On break' | 'Not working' | 'Unknown'

export interface LiveStatusAgent {
  userId: string
  name: string
  teamId: string
  teamName: string
  status: LiveStatusValue
  since: string | null
  todayTotalMinutes: number
}

function getTodayUTC(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  return { start: start.toISOString(), end: end.toISOString() }
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
      .select('user_id, team_id, teams(id, name)')
      .in('team_id', teamIdsToUse)

    if (tmError) return NextResponse.json({ error: tmError.message }, { status: 400 })

    const byUserAndTeam = new Map<string, { teamId: string; teamName: string }>()
    const userIds = new Set<string>()
    for (const row of teamMembers || []) {
      const tm = row as { user_id: string; team_id: string; teams: { id: string; name: string } | null }
      userIds.add(tm.user_id)
      byUserAndTeam.set(`${tm.user_id}:${tm.team_id}`, {
        teamId: tm.team_id,
        teamName: (tm.teams && tm.teams.name) || 'Unknown',
      })
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
    let breaks: { time_session_id: string; break_start_at: string; break_end_at: string | null }[] = []
    if (sessionIds.length > 0) {
      const { data: breakRows } = await supabase
        .from('break_segments')
        .select('time_session_id, break_start_at, break_end_at')
        .in('time_session_id', sessionIds)
      breaks = (breakRows || []) as typeof breaks
    }

    const now = new Date()
    const agents: LiveStatusAgent[] = []

    for (const row of teamMembers || []) {
      const tm = row as { user_id: string; team_id: string; teams: { id: string; name: string } | null }
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
      const activeBreak = activeSession
        ? breaks.find(
            b => b.time_session_id === activeSession.id && b.break_end_at == null
          )
        : null

      let status: LiveStatusValue = 'Not working'
      let since: string | null = null

      if (activeSession) {
        if (activeBreak) {
          status = 'On break'
          since = activeBreak.break_start_at
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

      agents.push({
        userId,
        name,
        teamId,
        teamName,
        status,
        since,
        todayTotalMinutes,
      })
    }

    return NextResponse.json({ agents })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
