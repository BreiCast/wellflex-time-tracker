'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RequestDetailModal from './RequestDetailModal'

interface AdminRequestsViewProps {
  teamIds: string[] // Array of all team IDs the admin manages
  selectedTeamId?: string // Optional: filter by specific team
}

export default function AdminRequestsView({ teamIds, selectedTeamId }: AdminRequestsViewProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)
  const [reviewNotesByRequest, setReviewNotesByRequest] = useState<Record<string, string>>({})

  const loadRequests = useCallback(async () => {
    if (!teamIds || teamIds.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setLoading(false)
        return
      }

      // Use API route with service role to bypass RLS issues
      const teamIdsToQuery = selectedTeamId && selectedTeamId !== '' ? [selectedTeamId] : teamIds
      
      const response = await fetch('/api/admin/requests', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Failed to load requests:', result.error, result.details)
        setRequests([])
      } else {
        // Filter by selected team if needed
        let filteredRequests = result.requests || []
        if (selectedTeamId && selectedTeamId !== '') {
          filteredRequests = filteredRequests.filter((req: any) => req.team_id === selectedTeamId)
        }
        
        console.log('Loaded requests:', {
          total: result.requests?.length || 0,
          filtered: filteredRequests.length,
          teamIds: result.teamIds,
          selectedTeamId,
        })
        
        setRequests(filteredRequests)
      }
    } catch (error) {
      console.error('Failed to load requests:', error)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [teamIds, selectedTeamId])

  useEffect(() => {
    setReviewNotesByRequest({})
    setExpandedRequestId(null)
  }, [selectedTeamId])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleReview = async (requestId: string, status: 'APPROVED' | 'REJECTED', notes?: string) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch('/api/requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          request_id: requestId,
          status,
          review_notes: notes || '',
        }),
      })

      const result = await response.json()

      if (response.ok) {
        loadRequests()
        setIsModalOpen(false)
        setSelectedRequestId(null)
        setExpandedRequestId(null)
        
        // Dispatch event to refresh timesheet if request was approved
        if (status === 'APPROVED') {
          window.dispatchEvent(new CustomEvent('requestApproved', { 
            detail: { requestId, status } 
          }))
        }
      } else {
        alert(result.error || 'Failed to review request')
      }
    } catch (error) {
      alert('Failed to review request')
    }
  }

  const handleOpenRequest = (requestId: string) => {
    setSelectedRequestId(requestId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRequestId(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading requests...</p>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="py-12 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-slate-400 font-bold text-lg tracking-tight">No pending requests</p>
        <p className="text-slate-300 text-xs mt-1">
          {selectedTeamId && selectedTeamId !== ''
            ? 'No pending requests for the selected team.' 
            : 'All caught up! No time corrections need review across all teams.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {(!selectedTeamId || selectedTeamId === '') && teamIds.length > 1 && (
        <div className="mb-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
          <p className="text-xs font-black text-indigo-700 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Showing requests from all {teamIds.length} teams you manage
          </p>
        </div>
      )}
      <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-2 custom-scrollbar">
        {requests.map((request) => {
        const user = request.users as any
        const isExpanded = expandedRequestId === request.id
        const reviewNotesValue = reviewNotesByRequest[request.id] || ''
        return (
          <div
            key={request.id}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-indigo-900/5 transition-all duration-300 group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-lg shadow-sm border border-indigo-100/50">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{user?.full_name || 'No Name'}</p>
                <p className="text-xs font-bold text-slate-400 truncate">{user?.email}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Date</span>
                <span className="text-xs font-black text-slate-500 whitespace-nowrap bg-slate-50 px-2.5 py-1 rounded-lg">
                  {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {request.request_type}
                </h4>
                {request.teams && (
                  <span 
                    className="inline-flex items-center px-3 py-1 rounded-xl text-white text-[10px] font-black border shadow-sm"
                    style={{ 
                      backgroundColor: (request.teams as any)?.color || '#6366f1',
                      borderColor: (request.teams as any)?.color || '#6366f1'
                    }}
                  >
                    {(request.teams as any)?.name || 'Unknown Team'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                  Pending Review
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50/60 px-3 py-1 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  {isExpanded ? 'Hide details' : 'View details'}
                </button>
              </div>

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

              <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100 italic">
                "{request.description}"
              </p>

              {isExpanded && (
                <div className="mt-6 space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Request type</p>
                      <p className="text-sm font-bold text-slate-700">{request.request_type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submitted</p>
                      <p className="text-sm font-bold text-slate-700">
                        {new Date(request.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team</p>
                      <p className="text-sm font-bold text-slate-700">{(request.teams as any)?.name || 'Unknown Team'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Requester</p>
                      <p className="text-sm font-bold text-slate-700">{user?.full_name || user?.email || 'Unknown User'}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Admin comment (optional)
                    </label>
                    <textarea
                      rows={3}
                      value={reviewNotesValue}
                      onChange={(event) =>
                        setReviewNotesByRequest((prev) => ({
                          ...prev,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Add context for the requester (e.g., needs documentation, dates confirmed)."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-auto">
              <button
                onClick={() => handleOpenRequest(request.id)}
                className="flex items-center justify-center px-4 py-3 bg-indigo-50 text-indigo-600 text-xs font-black rounded-xl hover:bg-indigo-100 border border-indigo-200 transition-all transform active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                OPEN
              </button>
              <button
                onClick={() => {
                  handleReview(request.id, 'APPROVED', reviewNotesValue || undefined)
                }}
                className="flex-1 flex items-center justify-center py-3 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all transform active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                APPROVE
              </button>
              <button
                onClick={() => {
                  handleReview(request.id, 'REJECTED', reviewNotesValue || undefined)
                }}
                className="flex-1 flex items-center justify-center py-3 bg-white border-2 border-rose-100 text-rose-600 text-xs font-black rounded-xl hover:bg-rose-50 hover:border-rose-200 transition-all transform active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
                REJECT
              </button>
            </div>
          </div>
        )
      })}
      </div>
      <RequestDetailModal
        requestId={selectedRequestId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRequestUpdated={loadRequests}
      />
    </div>
  )
}
