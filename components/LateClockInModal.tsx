'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LateClockInModalProps {
  teamId: string
  scheduledStartTime: string | null
  isOpen: boolean
  onClose: () => void
  onClockInSuccess: () => void
}

export default function LateClockInModal({
  teamId,
  scheduledStartTime,
  isOpen,
  onClose,
  onClockInSuccess,
}: LateClockInModalProps) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!note.trim()) {
      setError('Please provide a note explaining why you are late')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const response = await fetch('/api/time-sessions/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_id: teamId,
          late_note: note.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to clock in')
      }

      // Success - close modal and refresh
      setNote('')
      onClockInSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to clock in')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setNote('')
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900">Late Clock-In</h3>
          <p className="text-sm text-slate-500 mt-1">
            You are clocking in late. Please add a note explaining why.
            {scheduledStartTime && (
              <span className="block mt-1">
                Scheduled start time: {new Date(scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="text-sm font-bold text-rose-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError(null)
              }}
              placeholder="Please explain why you are clocking in late..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900 resize-none"
              rows={4}
              required
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">This note will be saved with your time entry and visible to managers.</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !note.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Clocking In...' : 'Clock In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
