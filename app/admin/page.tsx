'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminRequestsView from '@/components/AdminRequestsView'
import TimesheetView from '@/components/TimesheetView'
import AdminMembersView from '@/components/AdminMembersView'
import DashboardNav from '@/components/DashboardNav'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'requests' | 'timesheets' | 'members'>('requests')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name)')
        .eq('user_id', session.user.id)
        .in('role', ['MANAGER', 'ADMIN'])

      const teamList: any[] = teamMembers
        ? teamMembers.map((tm: any) => ({
            id: tm.team_id,
            name: tm.teams.name,
            role: tm.role,
          }))
        : []

      if (teamList.length > 0) {
        setTeams(teamList)
        // Default to "All Teams" (empty string) to show all requests
        if (!selectedTeam) {
          setSelectedTeam('')
        }
      }

      setLoading(false)
    }

    loadData()
  }, [router, selectedTeam])

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
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold font-wetrack">wetrack - Admin</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Member View
                </button>
                <span className="text-sm text-gray-700">{user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">You don't have manager/admin access to any teams.</p>
            </div>
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
          if (tab === 'tracking') {
            router.push('/tracking')
          } else {
            router.push(`/dashboard?tab=${tab}`)
          }
        }}
        userEmail={user?.email}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Admin Control Panel</h1>
          <p className="text-slate-500 font-medium">Manage team requests, timesheets, and members.</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 inline-flex">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${
              activeTab === 'requests'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pending Requests
            </div>
          </button>
          <button
            onClick={() => setActiveTab('timesheets')}
            className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${
              activeTab === 'timesheets'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Timesheets
            </div>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${
              activeTab === 'members'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Members
            </div>
          </button>
        </div>

        {/* Team Selector (for requests and timesheets) */}
        {(activeTab === 'requests' || activeTab === 'timesheets') && (
          <div className="mb-6 w-full md:w-80 bg-white p-1.5 rounded-2xl shadow-sm border-2 border-slate-200 hover:border-indigo-300 transition-colors">
            <div className="flex items-center gap-2 px-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
              >
                <option value="">All Teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-10">
          {activeTab === 'requests' && (
            <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] rounded-[3rem] p-10 border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-[1.25rem] shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-slate-900">Pending Requests</h2>
              </div>
              <AdminRequestsView 
                teamIds={teams.map(t => t.id)} 
                selectedTeamId={selectedTeam}
              />
            </div>
          )}

          {activeTab === 'timesheets' && (
            <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] rounded-[3rem] p-10 border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-[1.25rem] shadow-sm border border-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Team Timesheets</h2>
                    {selectedTeam && selectedTeam !== '' && (
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        {teams.find(t => t.id === selectedTeam)?.name || 'Selected Team'}
                      </p>
                    )}
                    {(!selectedTeam || selectedTeam === '') && (
                      <p className="text-xs font-bold text-amber-600 mt-1 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Select a team to view timesheet
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <TimesheetView teamId={selectedTeam} />
            </div>
          )}

          {activeTab === 'members' && (
            <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] rounded-[3rem] p-10 border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-[1.25rem] shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">All Members</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">Manage members across all your teams</p>
                </div>
              </div>
              <AdminMembersView teamIds={teams.map(t => t.id)} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
