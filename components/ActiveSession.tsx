'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ActiveSessionProps {
  session: any
  breakSegment: any
  onSessionUpdate: () => void
}

export default function ActiveSession({ session, breakSegment, onSessionUpdate }: ActiveSessionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClockOut = async () => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      
      if (!authSession) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/time-sessions/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ time_session_id: session.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to clock out')
      }

      onSessionUpdate()
    } catch (err: any) {
      setError(err.message || 'Failed to clock out')
    } finally {
      setLoading(false)
    }
  }

  const handleBreakStart = async (breakType: 'BREAK' | 'LUNCH') => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      
      if (!authSession) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/breaks/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ 
          time_session_id: session.id,
          break_type: breakType,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start break')
      }

      onSessionUpdate()
    } catch (err: any) {
      setError(err.message || 'Failed to start break')
    } finally {
      setLoading(false)
    }
  }

  const handleBreakEnd = async () => {
    if (!breakSegment) return

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      
      if (!authSession) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/breaks/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ break_segment_id: breakSegment.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to end break')
      }

      onSessionUpdate()
    } catch (err: any) {
      setError(err.message || 'Failed to end break')
    } finally {
      setLoading(false)
    }
  }

  const clockInTime = new Date(session.clock_in_at)
  const now = new Date()
  const totalSeconds = Math.floor((now.getTime() - clockInTime.getTime()) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  const formatDuration = () => {
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div>
        <p className="text-sm text-gray-600">Clocked in at:</p>
        <p className="text-lg font-semibold">{clockInTime.toLocaleString()}</p>
      </div>

      <div>
        <p className="text-sm text-gray-600">Duration:</p>
        <p className="text-lg font-semibold font-mono">{formatDuration()}</p>
      </div>

      {breakSegment ? (
        <div>
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              On {breakSegment.break_type === 'LUNCH' ? 'Lunch' : 'Break'} since:
            </p>
            <p className="font-semibold text-yellow-900">
              {new Date(breakSegment.break_start_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleBreakEnd}
            disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
          >
            {loading ? 'Ending break...' : 'End Break'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Start a break:</p>
          <button
            onClick={() => handleBreakStart('BREAK')}
            disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Starting...' : '15 min Break'}
          </button>
          <button
            onClick={() => handleBreakStart('LUNCH')}
            disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
          >
            {loading ? 'Starting...' : '1 hr Lunch'}
          </button>
        </div>
      )}

      <button
        onClick={handleClockOut}
        disabled={loading}
        className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
      >
        {loading ? 'Clocking out...' : 'Clock Out'}
      </button>
    </div>
  )
}

