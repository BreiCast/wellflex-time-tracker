'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AdminRequestsView from '@/components/AdminRequestsView'
import TimesheetView from '@/components/TimesheetView'
import TeamManagement from '@/components/TeamManagement'
import DashboardNav from '@/components/DashboardNav'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
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

      // Load user's teams where they are manager/admin
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name)')
        .eq('user_id', session.user.id)
        .in('role', ['MANAGER', 'ADMIN'])

      if (teamMembers) {
        const teamList = teamMembers.map((tm: any) => ({
          id: tm.team_id,
          name: tm.teams.name,
          role: tm.role,
        }))
        setTeams(teamList)
        if (teamList.length > 0 && !selectedTeam) {
          setSelectedTeam(teamList[0].id)
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
                <h1 className="text-xl font-bold">Time Tracker - Admin</h1>
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
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Control Panel</h1>
            <p className="mt-1 text-slate-500 font-medium">Manage team requests, timesheets, and configurations.</p>
          </div>
          <div className="w-full md:w-72 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-4 py-2.5 bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] rounded-[3rem] p-10 border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-[1.25rem] shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-slate-900">Pending Requests</h2>
              </div>
              <AdminRequestsView teamId={selectedTeam} />
            </div>

            <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] rounded-[3rem] p-10 border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-[1.25rem] shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-slate-900">Team Timesheets</h2>
              </div>
              <TimesheetView teamId={selectedTeam} />
            </div>
          </div>

          <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] rounded-[3rem] p-10 border border-slate-100">
            <TeamManagement 
              teamId={selectedTeam} 
              userRole={teams.find(t => t.id === selectedTeam)?.role || 'MEMBER'} 
            />
          </div>
        </div>
      </main>
    </div>
  )
}

