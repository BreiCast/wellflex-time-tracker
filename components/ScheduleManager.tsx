'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Schedule {
  id: string
  team_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  teams?: {
    id: string
    name: string
    color?: string
  }
}

interface ScheduleManagerProps {
  teamId: string
  userId?: string // Optional: if provided, manage this user's schedule (admin only)
  userRole?: 'MEMBER' | 'MANAGER' | 'ADMIN' | 'SUPERADMIN' // User's role to determine permissions
  onScheduleUpdated?: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ScheduleManager({ teamId, userId, userRole = 'MEMBER', onScheduleUpdated }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [targetUserId, setTargetUserId] = useState<string | null>(userId || null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)

  // Load current user ID and team members (for admin mode)
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setCurrentUserId(session.user.id)
        
        // If admin and no userId provided, load team members
        if ((userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SUPERADMIN') && !userId) {
          const response = await fetch(`/api/teams/${teamId}/members`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          })
          const result = await response.json()
          const members = response.ok ? result.members || [] : []

          if (members) {
            const memberList = members.map((m: any) => ({
              id: m.user_id,
              name: m.users?.full_name || m.users?.email,
              email: m.users?.email,
            }))
            setTeamMembers(memberList)
            // Default to current user if no target user set
            if (!targetUserId) {
              setTargetUserId(session.user.id)
              setSelectedUser(memberList.find(m => m.id === session.user.id) || memberList[0])
            }
          }
        } else {
          // Regular user or specific userId provided
          setTargetUserId(userId || session.user.id)
        }
      }
    }
    init()
  }, [teamId, userId, userRole, targetUserId])

  const loadSchedules = useCallback(async () => {
    if (!targetUserId) return

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return

    // Use admin API if managing another user's schedule
    const isManagingOtherUser = targetUserId !== session.user.id && (userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SUPERADMIN')
    
    if (isManagingOtherUser) {
      // Use admin endpoint to get another user's schedules
      const response = await fetch(`/api/admin/schedules?team_id=${teamId}&user_id=${targetUserId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()
      if (response.ok) {
        setSchedules(result.schedules || [])
      }
    } else {
      // Regular user endpoint
      const response = await fetch(`/api/schedules?team_id=${teamId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()
      if (response.ok) {
        setSchedules(result.schedules || [])
      }
    }
    setLoading(false)
  }, [teamId, targetUserId, userRole])

  useEffect(() => {
    if (targetUserId) {
      loadSchedules()
    }
  }, [targetUserId, loadSchedules])

  const handleSaveSchedule = async (dayOfWeek: number) => {
    if (!targetUserId) return
    
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) throw new Error('Not authenticated')

      const isManagingOtherUser = targetUserId !== session.user.id && (userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SUPERADMIN')
      
      // Use admin endpoint if managing another user's schedule
      const endpoint = isManagingOtherUser ? '/api/admin/schedules' : '/api/schedules'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: targetUserId,
          team_id: teamId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          is_active: true,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save schedule')
      }

      setEditingDay(null)
      await loadSchedules()
      onScheduleUpdated?.()
    } catch (error: any) {
      alert(error.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Delete this schedule?')) return

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) throw new Error('Not authenticated')

      const isManagingOtherUser = targetUserId !== session.user.id && (userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SUPERADMIN')
      const endpoint = isManagingOtherUser ? `/api/admin/schedules?id=${scheduleId}` : `/api/schedules?id=${scheduleId}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete schedule')
      }

      await loadSchedules()
      onScheduleUpdated?.()
    } catch (error: any) {
      alert(error.message || 'Failed to delete schedule')
    }
  }

  const handleUserChange = (newUserId: string) => {
    setTargetUserId(newUserId)
    setSelectedUser(teamMembers.find(m => m.id === newUserId))
    setSchedules([])
    setLoading(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading schedule...</p>
      </div>
    )
  }

  const isAdminMode = (userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SUPERADMIN') && !userId && teamMembers.length > 0
  const isManagingOtherUser = targetUserId && currentUserId && targetUserId !== currentUserId

  return (
    <div className="space-y-4">
      {/* User Selector for Admins */}
      {isAdminMode && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 mb-6">
          <label className="block text-xs font-black text-indigo-700 uppercase tracking-widest mb-2">
            Manage Schedule For
          </label>
          <select
            value={targetUserId || ''}
            onChange={(e) => handleUserChange(e.target.value)}
            className="w-full px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700"
          >
            {teamMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.name} {member.id === currentUserId ? '(You)' : ''}
              </option>
            ))}
          </select>
          {isManagingOtherUser && selectedUser && (
            <p className="mt-2 text-xs font-bold text-indigo-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Managing schedule for {selectedUser.name}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
      {DAYS.map((day, index) => {
        const schedule = schedules.find(s => s.day_of_week === index)
        const isEditing = editingDay === index

        if (isEditing) {
          return (
            <div key={index} className="p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
              <div className="flex items-center justify-between mb-3">
                <span className="font-black text-slate-700">{day}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveSchedule(index)}
                    disabled={saving}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-black rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingDay(null)}
                    className="px-4 py-1.5 bg-slate-200 text-slate-700 text-xs font-black rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Start</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">End</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>
            </div>
          )
        }

        return (
          <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-black text-slate-700 w-24">{day}</span>
              {schedule ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-600">
                    {schedule.start_time} - {schedule.end_time}
                  </span>
                  <button
                    onClick={() => handleDeleteSchedule(schedule.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                    title="Delete schedule"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-bold italic">No schedule</span>
              )}
            </div>
            <button
              onClick={() => {
                if (schedule) {
                  setStartTime(schedule.start_time)
                  setEndTime(schedule.end_time)
                }
                setEditingDay(index)
              }}
              className="px-3 py-1.5 text-xs font-black text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              {schedule ? 'Edit' : 'Add'}
            </button>
          </div>
        )
      })}
      </div>
    </div>
  )
}
