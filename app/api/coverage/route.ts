import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'

export interface CoverageResponse {
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

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceSupabaseClient()

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')

    if (!teamId) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    // Verify user is a member of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 })
    }

    // Get team info including min_working_count
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, min_working_count')
      .eq('id', teamId)
      .single()

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Cast to handle min_working_count which may not be in generated types yet
    const teamData = team as unknown as { id: string; name: string; min_working_count?: number | null }

    // Get all team members
    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)

    if (tmError) {
      return NextResponse.json({ error: tmError.message }, { status: 400 })
    }

    const userIds = (teamMembers || []).map((m: { user_id: string }) => m.user_id)

    if (userIds.length === 0) {
      return NextResponse.json({
        teamId: teamData.id,
        teamName: teamData.name,
        total_agents: 0,
        working_count: 0,
        on_break_count: 0,
        min_working_count: teamData.min_working_count ?? null,
      } satisfies CoverageResponse)
    }

    const { start: todayStart, end: todayEnd } = getTodayUTC()

    // Get today's sessions for these users in this team
    const { data: sessions } = await supabase
      .from('time_sessions')
      .select('id, user_id, clock_in_at, clock_out_at')
      .eq('team_id', teamId)
      .in('user_id', userIds)
      .gte('clock_in_at', todayStart)
      .lte('clock_in_at', todayEnd)

    const sessionIds = (sessions || []).map((s: { id: string }) => s.id)
    let breaks: { time_session_id: string; break_end_at: string | null }[] = []
    if (sessionIds.length > 0) {
      const { data: breakRows } = await supabase
        .from('break_segments')
        .select('time_session_id, break_end_at')
        .in('time_session_id', sessionIds)
      breaks = (breakRows || []) as typeof breaks
    }

    // Compute status for each user in this team
    let workingCount = 0
    let onBreakCount = 0

    for (const userId of userIds) {
      const userSessions = (sessions || []).filter(
        (s: { user_id: string }) => s.user_id === userId
      ) as { id: string; user_id: string; clock_in_at: string; clock_out_at: string | null }[]

      const activeSession = userSessions.find(s => s.clock_out_at == null) || null
      const activeBreak = activeSession
        ? breaks.find(b => b.time_session_id === activeSession.id && b.break_end_at == null)
        : null

      if (activeSession) {
        if (activeBreak) {
          onBreakCount += 1
        } else {
          workingCount += 1
        }
      }
      // else: not working (not counted in working or on_break)
    }

    return NextResponse.json({
      teamId: teamData.id,
      teamName: teamData.name,
      total_agents: userIds.length,
      working_count: workingCount,
      on_break_count: onBreakCount,
      min_working_count: teamData.min_working_count ?? null,
    } satisfies CoverageResponse)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
