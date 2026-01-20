'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'
import ScheduleManager from '@/components/ScheduleManager'

export default function AdminSchedulesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<'MEMBER' | 'MANAGER' | 'ADMIN' | 'SUPERADMIN'>('MEMBER')

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Check if user is admin/manager
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name)')
        .eq('user_id', session.user.id)
        .in('role', ['MANAGER', 'ADMIN'])

      if (!teamMembers || teamMembers.length === 0) {
        router.push('/dashboard')
        return
      }

      const role = teamMembers[0].role as 'MEMBER' | 'MANAGER' | 'ADMIN' | 'SUPERADMIN'
      setUserRole(role)

      const teamList = teamMembers.map((tm: any) => ({
        id: tm.team_id,
        name: tm.teams.name,
      }))
      setTeams(teamList)

      if (teamList.length > 0) {
        setSelectedTeam(teamList[0].id)
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  useEffect(() => {
    if (!selectedTeam) return

    const loadMembers = async () => {
      const supabase = createClient()
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id, users(id, email, full_name)')
        .eq('team_id', selectedTeam)

      if (teamMembers) {
        const memberList = teamMembers.map((tm: any) => ({
          id: tm.user_id,
          name: tm.users?.full_name || tm.users?.email,
          email: tm.users?.email,
        }))
        setMembers(memberList)

        if (memberList.length > 0 && !selectedUser) {
          setSelectedUser(memberList[0].id)
        }
      }
    }

    loadMembers()
  }, [selectedTeam, selectedUser])

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

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <DashboardNav
        activeTab="schedules"
        onTabChange={() => {}}
        userEmail={user?.email}
        userRole={userRole}
        onLogout={handleLogout}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">User Schedules</h1>
          <p className="text-slate-500 font-bold text-sm">Set weekday hours and break expectations for team members</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value)
                  setSelectedUser('')
                }}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Member</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {members.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedTeam && selectedUser && (
          <ScheduleManager
            teamId={selectedTeam}
            userId={selectedUser}
            userRole={userRole}
            onScheduleUpdated={() => {}}
          />
        )}
      </div>
    </div>
  )
}
