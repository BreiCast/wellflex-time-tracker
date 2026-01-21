'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateBreakDurationDifference, getBreakAdjustmentType } from '@/lib/utils/request-helpers'

interface BreakAdjustmentModalProps {
  breakSegment: {
    id: string
    break_type: 'BREAK' | 'LUNCH'
    break_start_at: string
    break_end_at: string
    duration_minutes: number
    date: string
    user_id: string
  } | null
  teamId: string
  isOpen: boolean
  onClose: () => void
  onRequestCreated: () => void
}

export default function BreakAdjustmentModal({
  breakSegment,
  teamId,
  isOpen,
  onClose,
  onRequestCreated,
}: BreakAdjustmentModalProps) {
  const [formData, setFormData] = useState({
    adjusted_duration_hours: 0,
    adjusted_duration_minutes: 0,
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && breakSegment) {
      const hours = Math.floor(breakSegment.duration_minutes / 60)
      const minutes = breakSegment.duration_minutes % 60
      setFormData({
        adjusted_duration_hours: hours,
        adjusted_duration_minutes: minutes,
        description: '',
      })
      setError(null)
    }
  }, [isOpen, breakSegment])

  if (!isOpen || !breakSegment) return null

  const currentDuration = breakSegment.duration_minutes
  const adjustedDuration = formData.adjusted_duration_hours * 60 + formData.adjusted_duration_minutes
  const difference = Math.abs(calculateBreakDurationDifference(currentDuration, adjustedDuration))
  const adjustmentType = getBreakAdjustmentType(currentDuration, adjustedDuration)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (adjustedDuration <= 0) {
      setError('Adjusted duration must be greater than 0')
      return
    }

    if (adjustedDuration === currentDuration) {
      setError('Adjusted duration must be different from current duration')
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

      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_id: teamId,
          request_type: 'Break Duration Adjustment',
          description: formData.description || `Adjust ${breakSegment.break_type.toLowerCase()} break duration from ${Math.floor(currentDuration / 60)}h ${currentDuration % 60}m to ${formData.adjusted_duration_hours}h ${formData.adjusted_duration_minutes}m`,
          requested_data: {
            break_segment_id: breakSegment.id,
            current_duration_minutes: currentDuration,
            adjusted_duration_minutes: adjustedDuration,
          },
        }),
      })

      const result = await response.json()

      if (response.ok) {
        onRequestCreated()
        onClose()
      } else {
        setError(result.error || 'Failed to create break adjustment request')
      }
    } catch (err) {
      console.error('Error creating break adjustment request:', err)
      setError('Failed to create break adjustment request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900">Adjust Break Duration</h3>
          <p className="text-sm text-slate-500 mt-1">Request to adjust break duration</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Current Break Info */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Current Break</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                  breakSegment.break_type === 'LUNCH' 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {breakSegment.break_type}
                </span>
                <span className="text-sm font-bold text-slate-700">
                  {new Date(breakSegment.break_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(breakSegment.break_end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-lg font-black text-slate-900">
                Current Duration: {Math.floor(currentDuration / 60)}h {currentDuration % 60}m
              </div>
            </div>
          </div>

          {/* Adjusted Duration Input */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
              Adjusted Duration <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="number"
                  min="0"
                  max="23"
                  required
                  value={formData.adjusted_duration_hours}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value) || 0
                    setFormData({ ...formData, adjusted_duration_hours: hours })
                  }}
                  className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                  placeholder="Hours"
                />
                <p className="text-xs text-slate-400 mt-1 ml-1">Hours</p>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="59"
                  required
                  value={formData.adjusted_duration_minutes}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value) || 0
                    setFormData({ ...formData, adjusted_duration_minutes: minutes })
                  }}
                  className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                  placeholder="Minutes"
                />
                <p className="text-xs text-slate-400 mt-1 ml-1">Minutes</p>
              </div>
            </div>
          </div>

          {/* Difference Display */}
          {difference > 0 && (
            <div className={`rounded-2xl p-4 border ${
              adjustmentType === 'SUBTRACT_TIME' 
                ? 'bg-amber-50 border-amber-200' 
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <p className="text-sm font-bold text-slate-900">
                Adjustment: {adjustmentType === 'SUBTRACT_TIME' ? '-' : '+'}{Math.floor(difference / 60)}h {difference % 60}m
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {adjustmentType === 'SUBTRACT_TIME' 
                  ? 'This will reduce the break time, adding to work time'
                  : 'This will increase the break time, reducing work time'}
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
              Description <span className="text-slate-300 font-normal">(Optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Reason for adjustment (e.g., forgot to end break, system issue, etc.)"
              rows={3}
              className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-rose-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || adjustedDuration === currentDuration || adjustedDuration <= 0}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating Request...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
