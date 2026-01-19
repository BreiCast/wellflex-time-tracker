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
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Team Members</h3>
        {canManage && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            {showInviteForm ? 'Cancel' : 'Invite Member'}
          </button>
        )}
      </div>

      {showInviteForm && canManage && (
        <form onSubmit={handleInvite} className="mb-4 p-4 bg-gray-50 rounded-lg">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="MEMBER">Member</option>
                <option value="MANAGER">Manager</option>
                {userRole === 'ADMIN' && <option value="ADMIN">Admin</option>}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviteLoading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {inviteLoading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {members.length === 0 ? (
          <p className="text-gray-600">No team members yet</p>
        ) : (
          members.map((member: any) => {
            const user = member.users as any
            return (
              <div
                key={member.id}
                className="flex justify-between items-center p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium">{user?.full_name || user?.email}</p>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                    member.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                    member.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {member.role}
                  </span>
                </div>
                {canManage && userRole === 'ADMIN' && member.role !== 'ADMIN' && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

