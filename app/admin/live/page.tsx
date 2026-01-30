'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'

type LiveStatusValue = 'Working' | 'On break' | 'Not working' | 'Unknown'

interface LiveStatusAgent {
  userId: string
  name: string
  teamId: string
  teamName: string
  status: LiveStatusValue
  since: string | null
  todayTotalMinutes: number
}

function formatSince(iso: string | null): string {
  if (!iso) return '—'
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

export default function AdminLivePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [agents, setAgents] = useState<LiveStatusAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const fetchAgents = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const params = new URLSearchParams()
    if (teamFilter) params.set('team_id', teamFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (searchQuery.trim()) params.set('search', searchQuery.trim())

    const res = await fetch(`/api/admin/live-status?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (res.ok) setAgents(data.agents || [])
  }, [teamFilter, statusFilter, searchQuery])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
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
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Live Status</h1>
          <p className="text-slate-500 font-medium">See who is working right now. Updates every 60 seconds.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
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
          <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer rounded-lg"
            >
              <option value="">All statuses</option>
              <option value="Working">Working</option>
              <option value="On break">On break</option>
              <option value="Not working">Not working</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2.5 text-sm font-bold text-slate-700 placeholder:text-slate-400 outline-none rounded-xl w-56"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                    Since
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                    Today total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                      No agents match the filters.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={`${agent.userId}-${agent.teamId}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-900">{agent.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-600">{agent.teamName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                            agent.status === 'Working'
                              ? 'bg-emerald-100 text-emerald-700'
                              : agent.status === 'On break'
                                ? 'bg-amber-100 text-amber-700'
                                : agent.status === 'Not working'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                        {formatSince(agent.since)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-900 font-mono">
                        {formatTodayTotal(agent.todayTotalMinutes)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
