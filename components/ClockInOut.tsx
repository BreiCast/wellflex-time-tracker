'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LateClockInModal from './LateClockInModal'

interface ClockInOutProps {
  teamId: string
  onSessionStart: () => void
}

export default function ClockInOut({ teamId, onSessionStart }: ClockInOutProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLateModalOpen, setIsLateModalOpen] = useState(false)
  const [scheduledStartTime, setScheduledStartTime] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
      }
    }
    init()
  }, [])

  const checkIfLate = async (): Promise<{ isLate: boolean; scheduledStart: Date | null }> => {
    if (!teamId || !user) {
      return { isLate: false, scheduledStart: null }
    }

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { isLate: false, scheduledStart: null }

      const now = new Date()
      const dayOfWeek = now.getDay()

      const { data: schedule } = await supabase
        .from('schedules')
        .select('start_time')
        .eq('user_id', user.id)
        .eq('team_id', teamId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single()

      if (!schedule) {
        return { isLate: false, scheduledStart: null }
      }

      const [startHour, startMin] = schedule.start_time.split(':').map(Number)
      const scheduledStart = new Date(now)
      scheduledStart.setHours(startHour, startMin, 0, 0)

      const isLate = now > scheduledStart

      return { isLate, scheduledStart }
    } catch (err) {
      console.error('Error checking if late:', err)
      return { isLate: false, scheduledStart: null }
    }
  }

  const handleClockIn = async () => {
    if (!teamId) {
      setError('Please select a team')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Check if user is late
      const { isLate, scheduledStart } = await checkIfLate()

      if (isLate && scheduledStart) {
        // Show modal for late clock-in
        setScheduledStartTime(scheduledStart.toISOString())
        setIsLateModalOpen(true)
        setLoading(false)
        return
      }

      // Not late - proceed with normal clock-in
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/time-sessions/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ team_id: teamId }),
      })

      const result = await response.json()

      if (!response.ok) {
        // If API says we're late, show modal
        if (result.isLate) {
          setScheduledStartTime(null)
          setIsLateModalOpen(true)
          setLoading(false)
          return
        }
        throw new Error(result.error || 'Failed to clock in')
      }

      onSessionStart()
    } catch (err: any) {
      setError(err.message || 'Failed to clock in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <button
        onClick={handleClockIn}
        disabled={loading || !teamId}
        className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
      >
        {loading ? 'Clocking in...' : 'Clock In'}
      </button>
      <LateClockInModal
        teamId={teamId}
        scheduledStartTime={scheduledStartTime}
        isOpen={isLateModalOpen}
        onClose={() => {
          setIsLateModalOpen(false)
          setScheduledStartTime(null)
        }}
        onClockInSuccess={onSessionStart}
      />
    </>
  )
}

