'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui'

type EditType = 'TIME_SESSION' | 'BREAK_SEGMENT' | 'NOTE'

interface TimeEntryEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmitted: () => void
  requiresApproval: boolean
  editType: EditType
  target: {
    id: string
    time_session_id?: string
    clock_in_at?: string | null
    clock_out_at?: string | null
    break_start_at?: string | null
    break_end_at?: string | null
    content?: string | null
  }
}

function toLocalInputValue(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function TimeEntryEditModal({
  isOpen,
  onClose,
  onSubmitted,
  requiresApproval,
  editType,
  target,
}: TimeEntryEditModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const initialClockIn = useMemo(() => toLocalInputValue(target.clock_in_at), [target.clock_in_at])
  const initialClockOut = useMemo(() => toLocalInputValue(target.clock_out_at), [target.clock_out_at])
  const initialBreakStart = useMemo(() => toLocalInputValue(target.break_start_at), [target.break_start_at])
  const initialBreakEnd = useMemo(() => toLocalInputValue(target.break_end_at), [target.break_end_at])
  const [clockIn, setClockIn] = useState(initialClockIn)
  const [clockOut, setClockOut] = useState(initialClockOut)
  const [breakStart, setBreakStart] = useState(initialBreakStart)
  const [breakEnd, setBreakEnd] = useState(initialBreakEnd)
  const [content, setContent] = useState(target.content || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const payload: Record<string, any> = {
        edit_type: editType,
        reason: reason.trim() || undefined,
      }

      if (editType === 'TIME_SESSION') {
        payload.time_session_id = target.id
        payload.new_clock_in_at = clockIn ? new Date(clockIn).toISOString() : undefined
        payload.new_clock_out_at = clockOut ? new Date(clockOut).toISOString() : undefined
      } else if (editType === 'BREAK_SEGMENT') {
        payload.break_segment_id = target.id
        payload.new_break_start_at = breakStart ? new Date(breakStart).toISOString() : undefined
        payload.new_break_end_at = breakEnd ? new Date(breakEnd).toISOString() : undefined
      } else if (editType === 'NOTE') {
        payload.note_id = target.id
        payload.new_content = content.trim()
      }

      const response = await fetch('/api/time-entries/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit edit')
      }

      onSubmitted()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to submit edit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} label="Edit time entry" className="bg-white rounded-3xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900">Edit Time Entry</h3>
          <p className="text-sm text-slate-500 mt-1">
            {requiresApproval ? 'This change will require admin approval.' : 'This change will be applied immediately.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="text-sm font-bold text-rose-600">{error}</p>
            </div>
          )}

          {editType === 'TIME_SESSION' && (
            <>
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Clock In</label>
                <input
                  type="datetime-local"
                  value={clockIn}
                  onChange={(e) => setClockIn(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Clock Out</label>
                <input
                  type="datetime-local"
                  value={clockOut}
                  onChange={(e) => setClockOut(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                />
              </div>
            </>
          )}

          {editType === 'BREAK_SEGMENT' && (
            <>
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Break Start</label>
                <input
                  type="datetime-local"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Break End</label>
                <input
                  type="datetime-local"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900"
                />
              </div>
            </>
          )}

          {editType === 'NOTE' && (
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Note</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900 resize-none"
                rows={4}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-900 resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black uppercase tracking-wide hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Submitting…' : requiresApproval ? 'Submit Request' : 'Apply Edit'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
