'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminMembersViewProps {
  teamIds: string[]
}

export default function AdminMembersView({ teamIds }: AdminMembersViewProps) {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [updatingName, setUpdatingName] = useState(false)
  const [filterTeam, setFilterTeam] = useState<string>('')
  const [teams, setTeams] = useState<any[]>([])

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch('/api/admin/members', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (response.ok) {
        setMembers(result.members || [])
        
        // Extract unique teams for filter
        const uniqueTeams: Record<string, { id: string; name: string; color?: string }> = {}
        result.members?.forEach((member: any) => {
          member.teams?.forEach((team: any) => {
            if (!uniqueTeams[team.team_id]) {
              uniqueTeams[team.team_id] = {
                id: team.team_id,
                name: team.team_name,
                color: team.team_color,
              }
            }
          })
        })
        setTeams(Object.values(uniqueTeams))
      } else {
        setError(result.error || 'Failed to load members')
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const getUserId = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    }
    getUserId()
    loadMembers()
  }, [loadMembers])

  const handleStartEditName = (userId: string, currentName: string) => {
    setEditingName(userId)
    setEditNameValue(currentName || '')
    setError('')
  }

  const handleCancelEditName = () => {
    setEditingName(null)
    setEditNameValue('')
  }

  const handleUpdateName = async (userId: string) => {
    if (!editNameValue.trim()) {
      setError('Name cannot be empty')
      return
    }

    setUpdatingName(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: editNameValue.trim(),
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setEditingName(null)
        setEditNameValue('')
        loadMembers()
      } else {
        setError(result.error || 'Failed to update name')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update name')
    } finally {
      setUpdatingName(false)
    }
  }

  const handleUpdateRole = async (membershipId: string, teamId: string, newRole: 'MEMBER' | 'MANAGER' | 'ADMIN') => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          membership_id: membershipId,
          role: newRole,
        }),
      })

      if (response.ok) {
        loadMembers()
      } else {
        const result = await response.json()
        alert(result.error || 'Failed to update role')
      }
    } catch (error) {
      alert('Failed to update role')
    }
  }

  const handleRemoveMember = async (membershipId: string, teamId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this team?`)) return

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          membership_id: membershipId,
        }),
      })

      if (response.ok) {
        loadMembers()
      } else {
        const result = await response.json()
        alert(result.error || 'Failed to remove member')
      }
    } catch (error) {
      alert('Failed to remove member')
    }
  }

  const filteredMembers = filterTeam
    ? members.filter(member => 
        member.teams.some((team: any) => team.team_id === filterTeam)
      )
    : members

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading members...</p>
      </div>
    )
  }

  if (error && !members.length) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-xl">
        <p className="text-sm font-bold">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-xl flex items-center animate-in fade-in slide-in-from-top-2 duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      {/* Filter by Team */}
      {teams.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
            Filter by Team
          </label>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700"
          >
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Members List */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-slate-400 font-bold text-sm">No members found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member: any) => {
            const user = member.user
            const isCurrentUser = member.user_id === currentUserId

            return (
              <div
                key={member.user_id}
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-slate-50/50 rounded-full blur-2xl group-hover:bg-indigo-50/50 transition-colors"></div>
                
                <div className="relative z-10">
                  {/* User Avatar and Name */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all duration-500 font-black text-xl flex-shrink-0">
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingName === member.user_id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 text-sm"
                            placeholder="Enter name"
                            autoFocus
                            disabled={updatingName}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateName(member.user_id)}
                              disabled={updatingName || !editNameValue.trim()}
                              className="px-3 py-1 bg-emerald-600 text-white text-xs font-black rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all"
                            >
                              {updatingName ? 'SAVING...' : 'SAVE'}
                            </button>
                            <button
                              onClick={handleCancelEditName}
                              disabled={updatingName}
                              className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-black rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-all"
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-900 text-lg leading-tight truncate">
                              {user?.full_name || 'No Name'}
                            </h4>
                            {!isCurrentUser && (
                              <button
                                onClick={() => handleStartEditName(member.user_id, user?.full_name || '')}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Edit Name"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-400 truncate">{user?.email}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Teams and Roles */}
                  <div className="space-y-3">
                    {member.teams.map((teamInfo: any) => (
                      <div key={teamInfo.membership_id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {teamInfo.team_color && (
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: teamInfo.team_color }}
                              ></div>
                            )}
                            <span className="text-sm font-black text-slate-700 truncate">{teamInfo.team_name}</span>
                          </div>
                          {!isCurrentUser && (
                            <select
                              value={teamInfo.role}
                              onChange={(e) => handleUpdateRole(teamInfo.membership_id, teamInfo.team_id, e.target.value as any)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer ${
                                teamInfo.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                                teamInfo.role === 'MANAGER' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <option value="MEMBER">Member</option>
                              <option value="MANAGER">Manager</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                          )}
                        </div>
                        {!isCurrentUser && (
                          <button
                            onClick={() => handleRemoveMember(teamInfo.membership_id, teamInfo.team_id, user?.full_name || user?.email || 'this user')}
                            className="text-xs font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Remove from team
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

