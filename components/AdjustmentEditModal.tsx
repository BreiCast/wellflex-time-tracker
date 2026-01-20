'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdjustmentEditModalProps {
  adjustment: {
    id: string
    adjustment_type: 'ADD_TIME' | 'SUBTRACT_TIME' | 'OVERRIDE'
    minutes: number
    effective_date: string
    description: string | null
  }
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

export default function AdjustmentEditModal({
  adjustment,
  isOpen,
  onClose,
  onUpdated,
}: AdjustmentEditModalProps) {
  const [formData, setFormData] = useState({
    adjustment_type: adjustment.adjustment_type,
    minutes: adjustment.minutes,
    effective_date: adjustment.effective_date,
    description: adjustment.description || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && adjustment) {
      setFormData({
        adjustment_type: adjustment.adjustment_type,
        minutes: adjustment.minutes,
        effective_date: adjustment.effective_date,
        description: adjustment.description || '',
      })
      setError(null)
    }
  }, [isOpen, adjustment])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      const response = await fetch(`/api/adjustments/${adjustment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok) {
        onUpdated()
        onClose()
      } else {
        setError(result.error || 'Failed to update adjustment')
      }
    } catch (err) {
      console.error('Error updating adjustment:', err)
      setError('Failed to update adjustment')
    } finally {
      setLoading(false)
    }
  }

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(Math.abs(minutes) / 60)
    const mins = Math.abs(minutes) % 60
    const sign = minutes < 0 ? '-' : ''
    return `${sign}${hours}:${mins.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900">Edit Adjustment</h3>
          <p className="text-sm text-slate-500 mt-1">Update adjustment details</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="text-sm font-bold text-rose-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Adjustment Type
            </label>
            <select
              value={formData.adjustment_type}
              onChange={(e) => setFormData({ ...formData, adjustment_type: e.target.value as any })}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-900"
              required
            >
              <option value="ADD_TIME">Add Time</option>
              <option value="SUBTRACT_TIME">Subtract Time</option>
              <option value="OVERRIDE">Override</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Minutes
            </label>
            <input
              type="number"
              value={formData.minutes}
              onChange={(e) => setFormData({ ...formData, minutes: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono text-slate-900"
              required
              min={-9999}
              max={9999}
            />
            <p className="text-xs text-slate-500 mt-1">
              Current: {formatMinutes(formData.minutes)}
            </p>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Effective Date
            </label>
            <input
              type="date"
              value={formData.effective_date}
              onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-slate-900 resize-none"
              rows={3}
              placeholder="Optional description..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-black hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
