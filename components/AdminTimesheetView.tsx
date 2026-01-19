'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminTimesheetViewProps {
  teamId: string
}

export default function AdminTimesheetView({ teamId }: AdminTimesheetViewProps) {
  const [members, setMembers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMembers()
  }, [teamId])

  const loadMembers = async () => {
    if (!teamId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: memberData } = await supabase
        .from('team_members')
        .select('user_id, users(id, email, full_name)')
        .eq('team_id', teamId)

      if (memberData) {
        const memberList = memberData.map((m: any) => ({
          id: m.user_id,
          email: m.users?.email,
          full_name: m.users?.full_name,
        }))
        setMembers(memberList)
        if (memberList.length > 0 && !selectedUserId) {
          setSelectedUserId(memberList[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load members:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading members...</div>
  }

  if (members.length === 0) {
    return <div className="text-gray-600">No team members</div>
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Team Member
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name || member.email}
            </option>
          ))}
        </select>
      </div>
      {selectedUserId && (
        <div className="mt-4">
          <TimesheetView userId={selectedUserId} teamId={teamId} />
        </div>
      )}
    </div>
  )
}

function TimesheetView({ userId, teamId }: { userId: string; teamId: string }) {
  const [timesheet, setTimesheet] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadTimesheet()
  }, [userId, teamId, startDate, endDate])

  const loadTimesheet = async () => {
    if (!teamId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch(
        `/api/timesheet?user_id=${userId}&team_id=${teamId}&start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      const result = await response.json()

      if (response.ok) {
        setTimesheet(result.timesheet || [])
      }
    } catch (error) {
      console.error('Failed to load timesheet:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading timesheet...</div>
  }

  if (timesheet.length === 0) {
    return <div className="text-gray-600">No timesheet data</div>
  }

  const totalWorkMinutes = timesheet.reduce((sum, entry) => sum + entry.workMinutes, 0)

  return (
    <div>
      <div className="mb-4 flex gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="text-sm">
        <div className="font-semibold mb-2">
          Total: {Math.floor(totalWorkMinutes / 60)}h {totalWorkMinutes % 60}m
        </div>
        <div className="space-y-1">
          {timesheet.slice(0, 5).map((entry) => (
            <div key={entry.date} className="flex justify-between text-xs">
              <span>{new Date(entry.date).toLocaleDateString()}</span>
              <span>{Math.floor(entry.workMinutes / 60)}h {entry.workMinutes % 60}m</span>
            </div>
          ))}
          {timesheet.length > 5 && (
            <div className="text-xs text-gray-500">...and {timesheet.length - 5} more</div>
          )}
        </div>
      </div>
    </div>
  )
}

