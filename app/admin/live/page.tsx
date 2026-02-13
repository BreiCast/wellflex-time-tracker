'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'

/** API returns these; we map to display status for filters/pills */
type ApiStatus = 'Working' | 'On break' | 'Not working' | 'Unknown'

/** Display status set per design: Working, On break, Away, Offline, Not tracking */
export type DisplayStatus = 'Working' | 'On break' | 'Away' | 'Offline' | 'Not tracking'

type TodaySegmentType = 'work' | 'break'

interface TodaySegment {
  type: TodaySegmentType
  start_at: string
  end_at: string | null
  break_type?: 'BREAK' | 'LUNCH'
  team_id?: string
  team_name?: string
  team_color?: string
}

interface LiveStatusAgent {
  userId: string
  name: string
  teamId: string
  teamName: string
  status: ApiStatus
  teamIds: string[]
  since: string | null
  todayTotalMinutes: number
  break_type?: 'BREAK' | 'LUNCH'
  break_start_at?: string | null
  active_break_duration_minutes?: number
  today_segments?: TodaySegment[]
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'available', label: 'Available now' },
  { value: 'Working', label: 'Working' },
  { value: 'On break', label: 'On break' },
  { value: 'Away', label: 'Away' },
  { value: 'Offline', label: 'Offline' },
  { value: 'Not tracking', label: 'Not tracking' },
]

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'name', label: 'Name' },
  { value: 'active', label: 'Active time today' },
  { value: 'last', label: 'Last activity' },
]

function toLocalDateInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

function shiftDate(dateValue: string, deltaDays: number): string {
  const parsed = new Date(`${dateValue}T12:00:00`)
  parsed.setDate(parsed.getDate() + deltaDays)
  return toLocalDateInputValue(parsed)
}

function formatSelectedDateLabel(dateValue: string): string {
  const d = new Date(`${dateValue}T12:00:00`)
  return d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function apiToDisplayStatus(api: ApiStatus): DisplayStatus {
  if (api === 'Working' || api === 'On break') return api
  if (api === 'Not working') return 'Offline'
  return 'Away'
}

function formatSince(iso: string | null, isOnBreak: boolean): string {
  if (!iso) return isOnBreak ? 'Break in progress' : '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTodayTotal(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function getStatusPillClass(status: DisplayStatus): string {
  const base = 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-black uppercase'
  switch (status) {
    case 'Working':
      return `${base} bg-emerald-500 text-white shadow-sm`
    case 'On break':
      return `${base} bg-amber-500 text-white shadow-sm`
    case 'Away':
      return `${base} bg-blue-100 text-blue-800`
    case 'Offline':
      return `${base} bg-slate-100 text-slate-500`
    case 'Not tracking':
      return `${base} bg-red-50 text-red-700 border-2 border-red-300`
    default:
      return `${base} bg-slate-100 text-slate-400`
  }
}


function formatSegmentDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const minutes = Math.max(0, Math.floor((end - start) / (1000 * 60)))
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

function formatRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso)
  const end = endIso ? new Date(endIso) : new Date()
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function getSegmentVisual(seg: TodaySegment): { className: string; style?: { backgroundColor: string } } {
  if (seg.type === 'break') {
    if (seg.break_type === 'LUNCH') return { className: 'bg-orange-300 border border-orange-400' }
    return { className: 'bg-amber-200 border border-amber-300' }
  }
  if (seg.team_color) {
    return { className: 'border border-slate-400/40', style: { backgroundColor: seg.team_color } }
  }
  return { className: 'bg-slate-300 border border-slate-400/40' }
}

export default function AdminLivePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [agents, setAgents] = useState<LiveStatusAgent[]>([])
  const [coverageByTeam, setCoverageByTeam] = useState<{ teamId: string; teamName: string; total_agents: number; working_count: number; on_break_count: number; min_working_count: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [teamFilter, setTeamFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('status')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateInputValue(new Date()))

  const todayDateValue = useMemo(() => toLocalDateInputValue(new Date()), [])
  const isSelectedDateToday = selectedDate === todayDateValue

  const fetchAgents = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setListLoading(true)
    const params = new URLSearchParams()
    // Send viewer's timezone offset so the API computes day bounds in local time
    params.set('offset_minutes', String(-new Date().getTimezoneOffset()))
    params.set('date', selectedDate)
    if (teamFilter) params.set('team_id', teamFilter)
    if (statusFilter && statusFilter !== 'available' && statusFilter !== 'Not tracking') {
      if (statusFilter === 'Away') params.set('status', 'Unknown')
      else if (statusFilter === 'Offline') params.set('status', 'Not working')
      else params.set('status', statusFilter)
    }
    if (searchQuery.trim()) params.set('search', searchQuery.trim())

    const res = await fetch(`/api/admin/live-status?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (res.ok) {
      setAgents(data.agents ?? [])
      setCoverageByTeam(data.coverage_by_team ?? [])
      setLastUpdated(new Date())
    }
    setListLoading(false)
  }, [teamFilter, statusFilter, searchQuery, selectedDate])

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      const response = await fetch('/api/teams', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const result = await response.json()
      const isSuperAdmin = Boolean(result.is_superadmin)
      const teamList =
        response.ok && result.teams
          ? result.teams
              .filter((t: { role?: string }) => isSuperAdmin || ['MANAGER', 'ADMIN'].includes(t.role))
              .map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
          : []

      setTeams(teamList)
      setLoading(false)
    }

    loadData()
  }, [router])

  useEffect(() => {
    if (!user) return
    fetchAgents()
    const interval = setInterval(fetchAgents, 60 * 1000)
    return () => clearInterval(interval)
  }, [user, fetchAgents])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredAndSortedAgents = useMemo(() => {
    let list = agents.map((a) => ({ ...a, displayStatus: apiToDisplayStatus(a.status) }))
    if (statusFilter === 'available') {
      list = list.filter((a) => a.displayStatus === 'Working' || a.displayStatus === 'On break')
    } else if (statusFilter === 'Not tracking') {
      list = list.filter((a) => a.displayStatus === 'Not tracking')
    } else if (statusFilter && statusFilter !== 'Away' && statusFilter !== 'Offline') {
      list = list.filter((a) => a.displayStatus === statusFilter)
    }
    const cmp = (a: typeof list[0], b: typeof list[0]) => {
      let v = 0
      switch (sortBy) {
        case 'status':
          v = a.displayStatus.localeCompare(b.displayStatus)
          break
        case 'name':
          v = a.name.localeCompare(b.name) || a.teamName.localeCompare(b.teamName)
          break
        case 'active':
          v = a.todayTotalMinutes - b.todayTotalMinutes
          break
        case 'last':
          v = (a.since ? new Date(a.since).getTime() : 0) - (b.since ? new Date(b.since).getTime() : 0)
          break
        default:
          v = 0
      }
      return sortDir === 'asc' ? v : -v
    }
    return [...list].sort(cmp)
  }, [agents, statusFilter, sortBy, sortDir])

  const coverageMap = useMemo(() => {
    const map = new Map<string, { working_count: number; min_working_count: number | null }>()
    for (const c of coverageByTeam) {
      map.set(c.teamId, { working_count: c.working_count, min_working_count: c.min_working_count })
    }
    return map
  }, [coverageByTeam])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-lg font-bold text-slate-600">Loading...</div>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <DashboardNav activeTab="admin" onTabChange={() => {}} userEmail={user?.email} onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 font-bold">You don’t have manager/admin access to any teams.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <DashboardNav
        activeTab="admin"
        onTabChange={(tab) => {
          if (tab === 'tracking') router.push('/tracking')
          else router.push(`/dashboard?tab=${tab}`)
        }}
        userEmail={user?.email}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        {/* Header: title, subtitle, last-updated, refresh */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">Live Status</h1>
            <p className="text-slate-500 font-medium">
              {isSelectedDateToday ? 'Who’s working right now.' : `Historical live status for ${formatSelectedDateLabel(selectedDate)}.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-sm font-bold text-slate-500">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchAgents()}
              disabled={listLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedDate((value) => shiftDate(value, -1))}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Previous day"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="date"
              value={selectedDate}
              max={todayDateValue}
              onChange={(e) => setSelectedDate(e.target.value || todayDateValue)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate((value) => shiftDate(value, 1))}
              disabled={isSelectedDateToday}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              aria-label="Next day"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {!isSelectedDateToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayDateValue)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Back to today
            </button>
          )}
        </div>

        {/* Toolbar: team, status filters, search, sort */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-4 py-2.5 text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer rounded-lg"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value === '' ? 'all' : opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                  statusFilter === opt.value
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 text-sm font-bold text-slate-700 placeholder:text-slate-400 outline-none rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Coverage by team: working count, on break, min working, below-minimum */}
        {coverageByTeam.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-4">
            {(teamFilter ? coverageByTeam.filter((c) => c.teamId === teamFilter) : coverageByTeam).map(
              (c) => {
                const hasMin = c.min_working_count != null && c.min_working_count > 0
                const belowMinimum = hasMin && c.working_count < c.min_working_count!
                const atRisk = hasMin && c.working_count <= c.min_working_count!
                return (
                  <div
                    key={c.teamId}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                      belowMinimum
                        ? 'border-red-300 bg-red-50 text-red-800'
                        : atRisk
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <span className="font-medium text-slate-500">{c.teamName}:</span>{' '}
                    <span className="font-black">{c.working_count}</span> working,{' '}
                    {c.on_break_count} on break
                    {hasMin && (
                      <span className="ml-2 text-slate-500">(min {c.min_working_count})</span>
                    )}
                    {belowMinimum && (
                      <span className="ml-2 text-red-700 font-black">Below minimum</span>
                    )}
                    {!belowMinimum && atRisk && (
                      <span className="ml-2 text-amber-700">At risk</span>
                    )}
                  </div>
                )
              }
            )}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-200 border border-amber-300" />Break</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-orange-300 border border-orange-400" />Lunch</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-slate-300 border border-slate-400/40" />Other</span>
          {Array.from(new Map(filteredAndSortedAgents.flatMap((agent) => (agent.today_segments || [])
            .filter((seg) => seg.type === 'work' && seg.team_id && seg.team_name)
            .map((seg) => [seg.team_id!, { id: seg.team_id!, name: seg.team_name!, color: seg.team_color || '#6366f1' }]))).values()).slice(0, 8).map((team) => (
            <span key={team.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full border border-slate-400/40" style={{ backgroundColor: team.color }} />
              {team.name}
            </span>
          ))}
        </div>

        {/* Content: list of employee rows */}
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          {listLoading ? (
            <div className="py-16 flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : filteredAndSortedAgents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-500 font-bold mb-2">No agents match the current filters.</p>
              <button
                type="button"
                onClick={() => { setStatusFilter(''); setSearchQuery('') }}
                className="text-sm font-bold text-indigo-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredAndSortedAgents.map((agent) => {
                const cov = coverageMap.get(agent.teamId)
                return (
                  <LiveStatusRow
                    key={agent.userId}
                    agent={agent}
                    displayStatus={agent.displayStatus}
                    workingCount={cov?.working_count ?? 0}
                    minWorkingCount={cov?.min_working_count ?? null}
                    displayDate={selectedDate}
                    isSelectedDateToday={isSelectedDateToday}
                  />
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

function formatBreakDuration(minutes: number): string {
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

function LiveStatusRow({
  agent,
  displayStatus,
  workingCount,
  minWorkingCount,
  displayDate,
  isSelectedDateToday,
}: {
  agent: LiveStatusAgent
  displayStatus: DisplayStatus
  workingCount: number
  minWorkingCount: number | null
  displayDate: string
  isSelectedDateToday: boolean
}) {
  const isOnBreak = agent.status === 'On break'
  const sinceLabel = isOnBreak ? (agent.since ? `Break since ${formatSince(agent.since, true)}` : 'Break in progress') : (agent.since ? `Since ${formatSince(agent.since, false)}` : 'Last activity —')
  const isNotTracking = displayStatus === 'Not tracking'
  const breakDuration =
    isOnBreak && (agent.active_break_duration_minutes != null || agent.since)
      ? agent.active_break_duration_minutes != null
        ? formatBreakDuration(agent.active_break_duration_minutes)
        : formatBreakDuration(
            Math.floor((Date.now() - new Date(agent.since!).getTime()) / (1000 * 60))
          )
      : null

  // Show at-risk indicator on break rows when team is at or below minimum
  const showAtRisk =
    isOnBreak &&
    minWorkingCount != null &&
    minWorkingCount > 0 &&
    workingCount <= minWorkingCount

  return (
    <li
      className={`flex flex-wrap items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors ${
        isNotTracking ? 'bg-red-50/50 border-l-4 border-red-300' : ''
      }`}
    >
      {/* 1. Status pill (visually dominant) */}
      <span className={getStatusPillClass(displayStatus)}>
        {displayStatus}
      </span>
      {showAtRisk && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Low coverage
        </span>
      )}

      {/* 2. Identity */}
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-slate-900 truncate" title={agent.name}>
          {agent.name}
        </p>
        <p className="text-sm font-medium text-slate-500">{agent.teamName}{agent.teamIds.length > 1 ? ' · Multiple teams' : ''}</p>
      </div>

      {/* 3. Since / last activity; break duration when On break */}
      <div className="text-sm font-bold text-slate-600 whitespace-nowrap">
        {sinceLabel}
        {breakDuration != null && (
          <span className="ml-1 text-slate-500 font-medium">({breakDuration})</span>
        )}
      </div>

      {/* 4. Today total */}
      <div className="text-sm font-mono font-black text-slate-700">
        {formatTodayTotal(agent.todayTotalMinutes)}
      </div>

      {/* 5. Per-row today timeline with Now indicator */}
      <div className="w-full mt-3 pl-0 sm:pl-0">
        <TodayTimelineStrip
          since={agent.since}
          status={agent.status}
          todaySegments={agent.today_segments}
          displayDate={displayDate}
          isSelectedDateToday={isSelectedDateToday}
        />
      </div>
    </li>
  )
}

/** Compact today strip: vertical "Now" line (auto-updating); work/break blocks from today_segments or single since→now fallback. */
function TodayTimelineStrip({
  since,
  status,
  todaySegments,
  displayDate,
  isSelectedDateToday,
}: {
  since: string | null
  status: ApiStatus
  todaySegments?: TodaySegment[] | null
  displayDate: string
  isSelectedDateToday: boolean
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const startOfDay = useMemo(() => {
    return new Date(displayDate + 'T00:00:00')
  }, [displayDate])
  const endOfDay = useMemo(() => {
    return new Date(displayDate + 'T23:59:59.999')
  }, [displayDate])
  const totalMs = endOfDay.getTime() - startOfDay.getTime()
  const nowOffset = Math.max(0, Math.min(1, (now.getTime() - startOfDay.getTime()) / totalMs))
  const nowTime = now.getTime()

  const useMultiBlock = Array.isArray(todaySegments) && todaySegments.length > 0

  return (
    <div className="relative h-8 rounded-lg bg-slate-100 overflow-hidden">
      {useMultiBlock ? (
        <>
          {todaySegments!.map((seg, i) => {
            const startMs = new Date(seg.start_at).getTime()
            const endMs = seg.end_at
              ? new Date(seg.end_at).getTime()
              : isSelectedDateToday
                ? nowTime
                : endOfDay.getTime()
            const leftPct = Math.max(0, (startMs - startOfDay.getTime()) / totalMs)
            const widthPct = Math.min(1 - leftPct, (endMs - startMs) / totalMs)
            if (widthPct <= 0) return null
            const containsNow = isSelectedDateToday && startMs <= nowTime && nowTime < endMs
            const visual = getSegmentVisual(seg)
            const activityLabel = seg.type === 'break' ? (seg.break_type === 'LUNCH' ? 'Lunch' : 'Break') : 'Work'
            const rangeLabel = formatRange(seg.start_at, seg.end_at)
            const durationLabel = formatSegmentDuration(seg.start_at, seg.end_at)
            const projectLabel = seg.type === 'work' ? (seg.team_name || '—') : null
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 z-0 rounded-sm ${visual.className} ${containsNow ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                style={{
                  left: `${leftPct * 100}%`,
                  width: `${widthPct * 100}%`,
                  ...visual.style,
                }}
                title={`${activityLabel}${projectLabel ? `\nProject: ${projectLabel}` : ''}\n${rangeLabel}, ${durationLabel}`}
              />
            )
          })}
        </>
      ) : (
        (() => {
          const hasCurrentBlock = (status === 'Working' || status === 'On break') && since
          const blockStartPct = hasCurrentBlock
            ? Math.max(0, (new Date(since).getTime() - startOfDay.getTime()) / totalMs)
            : 0
          const blockEndPct = hasCurrentBlock
            ? isSelectedDateToday
              ? nowOffset
              : 1
            : 0
          const blockContainsNow =
            hasCurrentBlock && isSelectedDateToday && blockStartPct <= nowOffset && blockEndPct >= nowOffset
          if (hasCurrentBlock && blockEndPct > blockStartPct) {
            const isOnBreak = status === 'On break'
            return (
              <div
                className={`absolute top-0 bottom-0 z-0 rounded-sm ${
                  isOnBreak ? 'bg-amber-200 border border-amber-300' : 'bg-slate-300 border border-slate-400/40'
                } ${blockContainsNow ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                style={{
                  left: `${blockStartPct * 100}%`,
                  width: `${(blockEndPct - blockStartPct) * 100}%`,
                }}
                title={`${isOnBreak ? 'Break' : 'Work'}\n${formatRange(since!, now.toISOString())}, ${formatSegmentDuration(since!, now.toISOString())}`}
              />
            )
          }
          return null
        })()
      )}
      {isSelectedDateToday && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-10"
          style={{ left: `${nowOffset * 100}%` }}
        >
          <span className="absolute -top-5 left-0 text-[10px] font-bold text-indigo-600 whitespace-nowrap">
            Now
          </span>
        </div>
      )}
      {!useMultiBlock && !((status === 'Working' || status === 'On break') && since) && (
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <span className="text-xs font-medium text-slate-400">No activity today</span>
        </div>
      )}
    </div>
  )
}
