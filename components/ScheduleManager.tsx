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
  onScheduleUpdated?: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ScheduleManager({ teamId, onScheduleUpdated }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [saving, setSaving] = useState(false)

  const loadSchedules = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return

    const response = await fetch(`/api/schedules?team_id=${teamId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    const result = await response.json()
    if (response.ok) {
      setSchedules(result.schedules || [])
    }
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const handleSaveSchedule = async (dayOfWeek: number) => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
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

      const response = await fetch(`/api/schedules?id=${scheduleId}`, {
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

  if (loading) {
    return <div className="text-sm text-slate-400">Loading schedule...</div>
  }

  return (
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
  )
}

