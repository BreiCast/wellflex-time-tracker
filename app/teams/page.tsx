'use client'

import { useEffect, useState, useCallback } from 'react'
import React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'
import ScheduleManager from '@/components/ScheduleManager'

interface Team {
  id: string
  name: string
  color?: string
  created_at: string
  role: 'MEMBER' | 'MANAGER' | 'ADMIN'
}

export default function TeamsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [userRole, setUserRole] = useState<string>('MEMBER')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Create team state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#6366f1')
  const [creating, setCreating] = useState(false)
  
  // Edit team state - store full team data to avoid confusion
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [updating, setUpdating] = useState(false)
  
  // Schedule management state
  const [selectedTeamForSchedule, setSelectedTeamForSchedule] = useState<string | null>(null)

  const loadSchedules = async () => {
    // This is just a placeholder - schedules are loaded in ScheduleManager component
    // But we can use this to trigger a refresh if needed
  }
  
  // Delete team state
  const [deletingTeam, setDeletingTeam] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadTeams = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      router.push('/login')
      return
    }

    setError('')
    try {
      // Load user's teams directly from team_members
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name, color, created_at)')
        .eq('user_id', session.user.id)

      if (teamError) {
        console.error('Error loading teams:', teamError)
        setError(`Failed to load teams: ${teamError.message}`)
        return
      }

      if (teamMembers && teamMembers.length > 0) {
        const hasManagementRole = teamMembers.some((tm: any) => tm.role === 'ADMIN' || tm.role === 'MANAGER')
        setUserRole(hasManagementRole ? 'ADMIN' : 'MEMBER')

        const teamList = teamMembers
          .filter((tm: any) => tm.teams)
          .map((tm: any) => ({
            id: tm.team_id,
            name: tm.teams.name,
            color: tm.teams.color || '#6366f1',
            created_at: tm.teams.created_at,
            role: tm.role,
          }))
        setTeams(teamList)
        console.log('Loaded teams:', teamList)
      } else {
        setTeams([])
        console.log('No teams found for user:', session.user.id)
      }
    } catch (error: any) {
      console.error('Error in loadTeams:', error)
      setError(`Failed to load teams: ${error.message || 'Unknown error'}`)
    }
  }, [router])

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)
      await loadTeams()
      setLoading(false)
    }

    loadData()
  }, [router, loadTeams])

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: newTeamName, color: newTeamColor }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create team')
      }

      setNewTeamName('')
      setNewTeamColor('#6366f1')
      setShowCreateForm(false)
      setSuccess('Team created successfully!')
      await loadTeams()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
    } finally {
      setCreating(false)
    }
  }

  const handleStartEdit = (team: Team) => {
    // Store the full team object to ensure we're editing the correct team
    setEditingTeam({ ...team })
    setError('')
  }

  const handleCancelEdit = () => {
    setEditingTeam(null)
  }

  const handleUpdateTeam = async (teamId: string) => {
    if (!editingTeam) return
    
    setError('')
    setSuccess('')
    setUpdating(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: editingTeam.name, color: editingTeam.color || '#6366f1' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update team')
      }

      setEditingTeam(null)
      setSuccess('Team updated successfully!')
      await loadTeams()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update team')
    } finally {
      setUpdating(false)
    }
  }

  const handleStartDelete = (teamId: string) => {
    setDeletingTeam(teamId)
    setError('')
  }

  const handleCancelDelete = () => {
    setDeletingTeam(null)
  }

  const handleDeleteTeam = async (teamId: string) => {
    setError('')
    setDeleting(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete team')
      }

      setDeletingTeam(null)
      setSuccess('Team deleted successfully!')
      await loadTeams()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete team')
    } finally {
      setDeleting(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        activeTab="teams"
        onTabChange={(tab) => {
          if (tab === 'tracking') {
            router.push('/tracking')
          } else {
            router.push(`/dashboard?tab=${tab}`)
          }
        }}
        userEmail={user?.email}
        userRole={userRole}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Teams Management</h1>
            <p className="mt-1 text-slate-500 font-medium">Create and manage teams, members, and schedules.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadTeams}
              className="group p-3 bg-white text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
              title="Refresh Teams"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className={`flex items-center px-6 py-3 rounded-2xl font-black transition-all shadow-lg transform active:scale-95 ${
                showCreateForm 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {showCreateForm ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Team
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-xl flex items-center shadow-sm animate-in slide-in-from-top duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-bold">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-8 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-xl flex items-center shadow-sm animate-in slide-in-from-top duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-bold">{success}</span>
          </div>
        )}

        {/* Create Team Form */}
        {showCreateForm && (
          <div className="mb-8 bg-white shadow-lg rounded-3xl p-8 border border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Create New Team/Client</h2>
            <form onSubmit={handleCreateTeam} className="space-y-6">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Wellflex, Aclarian, Acme Corp"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">Team Color</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="color"
                    value={newTeamColor}
                    onChange={(e) => setNewTeamColor(e.target.value)}
                    className="w-20 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newTeamColor}
                    onChange={(e) => setNewTeamColor(e.target.value)}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono font-bold"
                    placeholder="#6366f1"
                  />
                  <div 
                    className="w-12 h-12 rounded-xl border-2 border-slate-200 shadow-sm"
                    style={{ backgroundColor: newTeamColor }}
                  ></div>
                </div>
                <p className="mt-2 text-xs text-slate-400 font-medium">Choose a color to easily identify this team in your dashboard</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg transition-all"
                >
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-8 py-3 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Teams List */}
        {teams.length === 0 ? (
          <div className="bg-white shadow-sm rounded-[3rem] p-16 text-center border border-slate-100">
            <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-slate-400 font-bold text-xl mb-8 leading-relaxed">You are not a member of any teams yet.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-10 py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all transform hover:-translate-y-1"
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] rounded-[3rem] overflow-hidden border border-slate-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-50">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Team Name</th>
                    <th className="px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Your Role</th>
                    <th className="px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Created</th>
                    <th className="px-10 py-6 text-right text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teams.map((team) => (
                    <React.Fragment key={team.id}>
                      <tr className="group hover:bg-slate-50/80 transition-all duration-200">
                        <td className="px-10 py-8 whitespace-nowrap">
                          {editingTeam && editingTeam.id === team.id ? (
                            <div className="space-y-4 max-w-xs animate-in fade-in zoom-in-95 duration-300">
                              <input
                                type="text"
                                value={editingTeam.name}
                                onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                                autoFocus
                              />
                              <div className="flex items-center space-x-3">
                                <input
                                  type="color"
                                  value={editingTeam.color || '#6366f1'}
                                  onChange={(e) => setEditingTeam({ ...editingTeam, color: e.target.value })}
                                  className="w-12 h-10 rounded-lg border-2 border-slate-200 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={editingTeam.color || '#6366f1'}
                                  onChange={(e) => setEditingTeam({ ...editingTeam, color: e.target.value })}
                                  pattern="^#[0-9A-Fa-f]{6}$"
                                  className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg font-mono text-xs font-black text-slate-500"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-4">
                              <div 
                                className="w-5 h-5 rounded-lg shadow-sm border-2 border-white ring-1 ring-slate-100"
                                style={{ backgroundColor: team.color || '#6366f1' }}
                              ></div>
                              <div className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{team.name}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-10 py-8 whitespace-nowrap">
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                            team.role === 'ADMIN' 
                              ? 'bg-indigo-100 text-indigo-700'
                              : team.role === 'MANAGER'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                               team.role === 'ADMIN' ? 'bg-indigo-500' : team.role === 'MANAGER' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}></span>
                            {team.role}
                          </span>
                        </td>
                        <td className="px-10 py-8 whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-400">
                            {new Date(team.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-10 py-8 whitespace-nowrap text-right">
                          {editingTeam && editingTeam.id === team.id ? (
                            <div className="flex justify-end gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                              <button
                                onClick={() => handleUpdateTeam(team.id)}
                                disabled={updating}
                                className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
                              >
                                {updating ? 'SAVING...' : 'SAVE CHANGES'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={updating}
                                className="px-5 py-2.5 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                              >
                                CANCEL
                              </button>
                            </div>
                          ) : deletingTeam === team.id ? (
                            <div className="flex justify-end items-center gap-4 animate-in fade-in slide-in-from-right-2 duration-300">
                              <span className="text-xs font-black text-rose-600 uppercase tracking-wider">Are you sure?</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteTeam(team.id)}
                                  disabled={deleting}
                                  className="px-5 py-2.5 bg-rose-600 text-white text-xs font-black rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all disabled:opacity-50"
                                >
                                  {deleting ? 'DELETING...' : 'CONFIRM DELETE'}
                                </button>
                                <button
                                  onClick={handleCancelDelete}
                                  disabled={deleting}
                                  className="px-5 py-2.5 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                                >
                                  CANCEL
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                              {team.role === 'ADMIN' && (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(team)}
                                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                    title="Edit Team"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleStartDelete(team.id)}
                                    className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                    title="Delete Team"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedTeamForSchedule(selectedTeamForSchedule === team.id ? null : team.id)}
                                className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 px-4 ${
                                  selectedTeamForSchedule === team.id 
                                  ? 'bg-amber-600 text-white' 
                                  : 'bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white'
                                }`}
                                title="Work Schedule"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-black uppercase tracking-widest">{selectedTeamForSchedule === team.id ? 'Close' : 'Schedule'}</span>
                              </button>
                              <button
                                onClick={() => router.push(`/dashboard?tab=teams&team=${team.id}`)}
                                className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-2 px-4"
                                title="Team Members"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <span className="text-xs font-black uppercase tracking-widest">Members</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {selectedTeamForSchedule === team.id && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={4} className="px-10 py-10 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-900/5 border border-slate-100 relative overflow-hidden">
                              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-50/50 rounded-full blur-3xl"></div>
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                  <div>
                                    <h3 className="text-2xl font-black text-slate-900 flex items-center">
                                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl mr-3 shadow-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      Work Schedule for {team.name}
                                    </h3>
                                    <p className="text-slate-500 mt-2 font-bold max-w-2xl">Configure your weekly work availability for this client. This helps track your progress against scheduled hours.</p>
                                  </div>
                                  <button 
                                    onClick={() => setSelectedTeamForSchedule(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <div className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-100">
                                  <ScheduleManager 
                                    teamId={team.id}
                                    userRole={userRole as 'MEMBER' | 'MANAGER' | 'ADMIN'}
                                    onScheduleUpdated={async () => {
                                      await loadSchedules()
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

