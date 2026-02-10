'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CoverageInfo {
  teamId: string
  teamName: string
  working_count: number
  min_working_count: number | null
}

interface ActiveSessionProps {
  session: any
  breakSegment: any
  onSessionUpdate: () => void
}

export default function ActiveSession({ session, breakSegment, onSessionUpdate }: ActiveSessionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingBreakType, setPendingBreakType] = useState<'BREAK' | 'LUNCH' | null>(null)
  const [coverageInfo, setCoverageInfo] = useState<CoverageInfo | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60 * 1000)
    return () => clearInterval(interval)
  }, [])

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

  const checkCoverageAndStartBreak = async (breakType: 'BREAK' | 'LUNCH') => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()

      if (!authSession) {
        throw new Error('Not authenticated')
      }

      // Check coverage before starting break
      const coverageRes = await fetch(`/api/coverage?team_id=${session.team_id}&offset_minutes=${-new Date().getTimezoneOffset()}`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      })

      if (coverageRes.ok) {
        const coverage = await coverageRes.json()
        const hasMin = coverage.min_working_count != null && coverage.min_working_count > 0
        const wouldGoBelowMin = hasMin && coverage.working_count <= coverage.min_working_count

        if (wouldGoBelowMin) {
          // Show confirmation modal instead of starting break immediately
          setCoverageInfo(coverage)
          setPendingBreakType(breakType)
          setShowConfirmModal(true)
          setLoading(false)
          return
        }
      }
      // If coverage check fails or no min set, proceed directly
      await doStartBreak(breakType, authSession.access_token)
    } catch (err: any) {
      setError(err.message || 'Failed to start break')
      setLoading(false)
    }
  }

  const doStartBreak = async (breakType: 'BREAK' | 'LUNCH', accessToken: string) => {
    try {
      const response = await fetch('/api/breaks/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
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
      setShowConfirmModal(false)
      setPendingBreakType(null)
      setCoverageInfo(null)
    }
  }

  const handleConfirmBreak = async () => {
    if (!pendingBreakType) return
    setLoading(true)
    const supabase = createClient()
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) {
      setError('Not authenticated')
      setLoading(false)
      return
    }
    await doStartBreak(pendingBreakType, authSession.access_token)
  }

  const handleCancelBreak = () => {
    setShowConfirmModal(false)
    setPendingBreakType(null)
    setCoverageInfo(null)
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
  const totalSeconds = Math.floor((currentTime.getTime() - clockInTime.getTime()) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formatDuration = () => {
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const breakDurationMinutes = breakSegment
    ? Math.floor((currentTime.getTime() - new Date(breakSegment.break_start_at).getTime()) / (1000 * 60))
    : 0
  const breakDurationLabel = breakSegment
    ? breakDurationMinutes >= 60
      ? `${Math.floor(breakDurationMinutes / 60)}h ${breakDurationMinutes % 60}m`
      : `${breakDurationMinutes}m`
    : ''

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
            <p className="text-sm text-yellow-700 mt-1">
              Duration: {breakDurationLabel}
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
          <p className="text-sm text-gray-600">Start a break</p>
          <button
            onClick={() => checkCoverageAndStartBreak('BREAK')}
            disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Starting...' : '15 min Break'}
          </button>
          <button
            onClick={() => checkCoverageAndStartBreak('LUNCH')}
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

      {/* Coverage confirmation modal */}
      {showConfirmModal && coverageInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Low Team Coverage</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Going on break will leave <strong>{coverageInfo.working_count - 1}</strong> people working
              {coverageInfo.min_working_count != null && (
                <> (minimum is <strong>{coverageInfo.min_working_count}</strong> for {coverageInfo.teamName})</>
              )}.
              Do you want to proceed?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelBreak}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBreak}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? 'Starting...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

