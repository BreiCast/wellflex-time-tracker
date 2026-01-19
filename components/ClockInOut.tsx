'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ClockInOutProps {
  teamId: string
  onSessionStart: () => void
}

export default function ClockInOut({ teamId, onSessionStart }: ClockInOutProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClockIn = async () => {
    if (!teamId) {
      setError('Please select a team')
      return
    }

    setLoading(true)
    setError('')

    try {
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
    <div>
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
    </div>
  )
}

