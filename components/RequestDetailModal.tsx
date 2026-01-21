'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RequestDetailModalProps {
  requestId: string | null
  isOpen: boolean
  onClose: () => void
  onRequestUpdated?: () => void
}

interface Comment {
  id: string
  content: string
  created_at: string
  created_by: string
  users: {
    email: string
    full_name: string | null
  }
}

interface RequestDetail {
  id: string
  request_type: string
  description: string
  status: string
  requested_data: any
  created_at: string
  reviewed_at: string | null
  review_notes: string | null
  users: {
    email: string
    full_name: string | null
  }
  teams: {
    id: string
    name: string
    color: string
  }
  reviewed_by_user: {
    email: string
    full_name: string | null
  } | null
}

export default function RequestDetailModal({
  requestId,
  isOpen,
  onClose,
  onRequestUpdated,
}: RequestDetailModalProps) {
  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const loadRequestDetails = useCallback(async () => {
    if (!requestId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch(`/api/requests/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (response.ok) {
        setRequest(result.request)
        setComments(result.comments || [])
      } else {
        console.error('Failed to load request:', result.error)
        alert(result.error || 'Failed to load request details')
      }
    } catch (error) {
      console.error('Error loading request:', error)
      alert('Failed to load request details')
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    if (isOpen && requestId) {
      loadRequestDetails()
    } else {
      setRequest(null)
      setComments([])
      setCommentText('')
    }
  }, [isOpen, requestId, loadRequestDetails])

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestId || !commentText.trim()) return

    setSubmittingComment(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch(`/api/requests/${requestId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          content: commentText.trim(),
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setCommentText('')
        // Reload comments
        await loadRequestDetails()
        if (onRequestUpdated) {
          onRequestUpdated()
        }
      } else {
        console.error('Failed to add comment:', {
          status: response.status,
          error: result.error,
          details: result.details,
          hint: result.hint
        })
        const errorMsg = result.details 
          ? `${result.error}: ${result.details}${result.hint ? ` (${result.hint})` : ''}`
          : result.error || 'Failed to add comment'
        alert(errorMsg)
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('Failed to add comment. Please check the console for details.')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-2xl font-black text-slate-900">Request Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading...</p>
            </div>
          ) : request ? (
            <>
              {/* Request Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                      request.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                        request.status === 'APPROVED' ? 'bg-emerald-500' :
                        request.status === 'REJECTED' ? 'bg-rose-500' :
                        'bg-amber-500 animate-pulse'
                      }`}></span>
                      {request.status}
                    </span>
                    <span 
                      className="inline-flex items-center px-3 py-1 rounded-xl text-white text-[10px] font-black border shadow-sm"
                      style={{ 
                        backgroundColor: request.teams?.color || '#6366f1',
                        borderColor: request.teams?.color || '#6366f1'
                      }}
                    >
                      {request.teams?.name || 'Unknown Team'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-300 uppercase tracking-widest">
                    {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-indigo-600 uppercase tracking-widest mb-2">
                    {request.request_type}
                  </h3>
                  
                  {/* Break Duration Adjustment Details */}
                  {request.request_type.toUpperCase().includes('BREAK') && request.request_type.toUpperCase().includes('ADJUSTMENT') && request.requested_data && typeof request.requested_data === 'object' && request.requested_data.break_segment_id && (
                    <div className="mb-4 p-4 bg-blue-50/50 border border-blue-200 rounded-2xl">
                      <p className="text-xs font-black uppercase tracking-widest text-blue-700 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Break Adjustment Details
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Current Duration</p>
                          <p className="text-lg font-black text-slate-900">
                            {request.requested_data.current_duration_minutes 
                              ? `${Math.floor(request.requested_data.current_duration_minutes / 60)}h ${request.requested_data.current_duration_minutes % 60}m`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Adjusted Duration</p>
                          <p className="text-lg font-black text-indigo-600">
                            {request.requested_data.adjusted_duration_minutes 
                              ? `${Math.floor(request.requested_data.adjusted_duration_minutes / 60)}h ${request.requested_data.adjusted_duration_minutes % 60}m`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Adjustment</p>
                          <p className={`text-lg font-black ${
                            (request.requested_data.current_duration_minutes || 0) > (request.requested_data.adjusted_duration_minutes || 0)
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}>
                            {request.requested_data.current_duration_minutes && request.requested_data.adjusted_duration_minutes
                              ? (() => {
                                  const diff = Math.abs(request.requested_data.current_duration_minutes - request.requested_data.adjusted_duration_minutes)
                                  const sign = request.requested_data.current_duration_minutes > request.requested_data.adjusted_duration_minutes ? '-' : '+'
                                  return `${sign}${Math.floor(diff / 60)}h ${diff % 60}m`
                                })()
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Forgot to Log Break Details */}
                  {request.request_type.toUpperCase().includes('FORGOT') && (request.request_type.toUpperCase().includes('BREAK') || request.request_type.toUpperCase().includes('LUNCH')) && request.requested_data && typeof request.requested_data === 'object' && request.requested_data.date && (
                    <div className="mb-4 p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl">
                      <p className="text-xs font-black uppercase tracking-widest text-indigo-700 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Break Details
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</p>
                          <p className="text-sm font-bold text-slate-700">
                            {request.requested_data.date 
                              ? new Date(request.requested_data.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Time</p>
                          <p className="text-sm font-bold text-slate-700">
                            {request.requested_data.time_from && request.requested_data.time_to
                              ? `${request.requested_data.time_from} - ${request.requested_data.time_to}`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Break Type</p>
                          <p className="text-sm font-bold text-slate-700">
                            {request.requested_data.break_type || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {request.requested_data && (typeof request.requested_data === 'object') && (request.requested_data.date_from || request.requested_data.date_to || request.requested_data.date || request.requested_data.time_from || request.requested_data.time_to || request.requested_data.time) && (
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      {(request.requested_data.date_from || request.requested_data.date_to || request.requested_data.date) && (
                        <div className="flex items-center text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {request.requested_data.date_from && request.requested_data.date_to
                            ? (() => {
                                const fromDate = new Date(request.requested_data.date_from + 'T00:00:00')
                                const toDate = new Date(request.requested_data.date_to + 'T00:00:00')
                                const fromStr = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: fromDate.getFullYear() !== toDate.getFullYear() ? 'numeric' : undefined })
                                const toStr = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                return fromDate.getTime() === toDate.getTime() ? fromStr : `${fromStr} - ${toStr}`
                              })()
                            : request.requested_data.date
                            ? new Date(request.requested_data.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : request.requested_data.date_from
                            ? new Date(request.requested_data.date_from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : request.requested_data.date_to
                            ? new Date(request.requested_data.date_to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : null
                          }
                        </div>
                      )}
                      {(request.requested_data.time_from || request.requested_data.time_to || request.requested_data.time) && (
                        <div className="flex items-center text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50/50 px-3 py-1.5 rounded-xl border border-amber-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {request.requested_data.time_from && request.requested_data.time_to 
                            ? `${request.requested_data.time_from} - ${request.requested_data.time_to}`
                            : request.requested_data.time || (request.requested_data.time_from || request.requested_data.time_to)
                          }
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                      "{request.description}"
                    </p>
                  </div>

                  <div className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                    Requested by: {request.users?.full_name || request.users?.email || 'Unknown'}
                  </div>

                  {request.reviewed_at && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                        Admin Feedback
                        {request.reviewed_by_user && (
                          <span className="ml-2 text-slate-300 normal-case">
                            by {request.reviewed_by_user.full_name || request.reviewed_by_user.email}
                          </span>
                        )}
                      </p>
                      {request.review_notes && (
                        <p className="text-sm font-bold text-slate-600 italic mt-2">"{request.review_notes}"</p>
                      )}
                      <p className="text-xs font-bold text-slate-400 mt-2">
                        {new Date(request.reviewed_at).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Comments ({comments.length})
                </h4>

                {/* Comments List */}
                <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                  {comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-sm font-bold">No comments yet</p>
                      <p className="text-xs mt-1">Be the first to comment!</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black text-xs shadow-sm border border-indigo-100/50">
                              {(comment.users?.full_name || comment.users?.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900">
                                {comment.users?.full_name || comment.users?.email || 'Unknown'}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400">
                                {new Date(comment.created_at).toLocaleString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="space-y-3">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || submittingComment}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                  >
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm font-bold">Failed to load request</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
