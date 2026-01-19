'use client'

import { useEffect, useState } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Create team state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#6366f1')
  const [creating, setCreating] = useState(false)
  
  // Edit team state
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [editTeamColor, setEditTeamColor] = useState('#6366f1')
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

  const loadTeams = async () => {
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
  }

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
  }, [router])

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
    setEditingTeam(team.id)
    setEditTeamName(team.name)
    setEditTeamColor(team.color || '#6366f1')
    setError('')
  }

  const handleCancelEdit = () => {
    setEditingTeam(null)
    setEditTeamName('')
    setEditTeamColor('#6366f1')
  }

  const handleUpdateTeam = async (teamId: string) => {
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
        body: JSON.stringify({ name: editTeamName, color: editTeamColor }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update team')
      }

      setEditingTeam(null)
      setEditTeamName('')
      setEditTeamColor('#6366f1')
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
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Teams Management</h1>
          <div className="flex gap-2">
            <button
              onClick={loadTeams}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {showCreateForm ? 'Cancel' : '+ Create Team'}
          </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
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
                    pattern="^#[0-9A-F]{6}$"
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
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-500 text-lg mb-4">You are not a member of any teams yet.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Your Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map((team) => (
                  <React.Fragment key={team.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingTeam === team.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editTeamName}
                              onChange={(e) => setEditTeamName(e.target.value)}
                              className="w-full px-3 py-2 border-2 border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                              autoFocus
                            />
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={editTeamColor}
                                onChange={(e) => setEditTeamColor(e.target.value)}
                                className="w-12 h-8 rounded-lg border border-slate-300 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={editTeamColor}
                                onChange={(e) => setEditTeamColor(e.target.value)}
                                pattern="^#[0-9A-F]{6}$"
                                className="flex-1 px-2 py-1 border border-slate-300 rounded-lg font-mono text-xs"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-4 h-4 rounded-full shadow-sm border border-white/50"
                              style={{ backgroundColor: team.color || '#6366f1' }}
                            ></div>
                            <div className="text-sm font-bold text-gray-900">{team.name}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          team.role === 'ADMIN' 
                            ? 'bg-purple-100 text-purple-800'
                            : team.role === 'MANAGER'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {team.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(team.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingTeam === team.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleUpdateTeam(team.id)}
                              disabled={updating}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              {updating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={updating}
                              className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : deletingTeam === team.id ? (
                          <div className="flex justify-end gap-2">
                            <span className="text-sm text-red-600 mr-2">Delete this team?</span>
                            <button
                              onClick={() => handleDeleteTeam(team.id)}
                              disabled={deleting}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              {deleting ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button
                              onClick={handleCancelDelete}
                              disabled={deleting}
                              className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            {team.role === 'ADMIN' && (
                              <>
                                <button
                                  onClick={() => handleStartEdit(team)}
                                  className="px-3 py-1.5 text-xs font-black text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleStartDelete(team.id)}
                                  className="px-3 py-1.5 text-xs font-black text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setSelectedTeamForSchedule(selectedTeamForSchedule === team.id ? null : team.id)}
                              className="px-3 py-1.5 text-xs font-black text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              {selectedTeamForSchedule === team.id ? 'Hide' : 'Schedule'}
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard?tab=teams&team=${team.id}`)}
                              className="px-3 py-1.5 text-xs font-black text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              Members
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {selectedTeamForSchedule === team.id && (
                      <tr>
                        <td colSpan={4} className="px-6 py-6 bg-slate-50">
                          <div className="bg-white rounded-2xl p-6 border border-slate-200">
                            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Work Schedule for {team.name}
                            </h3>
                            <p className="text-sm text-slate-500 mb-6 font-medium">Set your weekly schedule for this team. For example: Monday 8:00 AM - 2:00 PM for Wellflex, then 2:00 PM - 5:00 PM for Aclarian.</p>
                            <ScheduleManager 
                              teamId={team.id} 
                              onScheduleUpdated={async () => {
                                await loadSchedules()
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

