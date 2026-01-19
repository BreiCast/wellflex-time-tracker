'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TeamManagementProps {
  teamId: string
  userRole: string
}

export default function TeamManagement({ teamId, userRole }: TeamManagementProps) {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'MANAGER' | 'ADMIN'>('MEMBER')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMembers()
  }, [teamId])

  const loadMembers = async () => {
    if (!teamId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch(`/api/teams/${teamId}/members`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (response.ok) {
        setMembers(result.members || [])
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInviteLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_id: teamId,
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invite')
      }

      // Reset form
      setInviteEmail('')
      setInviteRole('MEMBER')
      setShowInviteForm(false)
      
      // Reload members
      loadMembers()
    } catch (err: any) {
      setError(err.message || 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return
    }

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch(`/api/teams/${teamId}/members?user_id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
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

  if (loading) {
    return <div className="text-gray-600">Loading team members...</div>
  }

  const canManage = ['ADMIN', 'MANAGER'].includes(userRole)

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Team Members</h3>
          <p className="text-sm font-bold text-slate-400 mt-1 flex items-center">
            <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
            Manage roles and access for this team
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className={`flex items-center px-6 py-3 rounded-2xl font-black transition-all shadow-lg transform active:scale-95 ${
              showInviteForm 
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
            }`}
          >
            {showInviteForm ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite Member
              </>
            )}
          </button>
        )}
      </div>

      {showInviteForm && canManage && (
        <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h4 className="text-lg font-black text-slate-900 mb-6">Send New Invitation</h4>
          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Assign Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
              >
                <option value="MEMBER">Team Member</option>
                <option value="MANAGER">Manager</option>
                {userRole === 'ADMIN' && <option value="ADMIN">Admin</option>}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviteLoading}
              className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {inviteLoading ? 'SENDING...' : 'SEND INVITE'}
            </button>
          </form>
          {error && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-xl flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-bold">{error}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-slate-400 font-bold text-xl tracking-tight">No team members yet</p>
          </div>
        ) : (
          members.map((member: any) => {
            const user = member.users as any
            return (
              <div
                key={member.id}
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-slate-50/50 rounded-full blur-2xl group-hover:bg-indigo-50/50 transition-colors"></div>
                
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all duration-500 font-black text-xl">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{user?.full_name || 'No Name'}</h4>
                  <p className="text-xs font-bold text-slate-400 mb-4">{user?.email}</p>
                  
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    member.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                    member.role === 'MANAGER' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                      member.role === 'ADMIN' ? 'bg-indigo-500' : member.role === 'MANAGER' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}></span>
                    {member.role}
                  </span>

                  {canManage && userRole === 'ADMIN' && member.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="mt-6 text-xs font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Remove Member
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

