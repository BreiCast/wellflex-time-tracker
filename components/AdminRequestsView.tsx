'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminRequestsViewProps {
  teamIds: string[] // Array of all team IDs the admin manages
  selectedTeamId?: string // Optional: filter by specific team
}

export default function AdminRequestsView({ teamIds, selectedTeamId }: AdminRequestsViewProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)
  const [reviewNotesByRequest, setReviewNotesByRequest] = useState<Record<string, string>>({})
  const [statusByRequest, setStatusByRequest] = useState<Record<string, string>>({})

  const statusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ] as const

  const getStatusLabel = (status?: string | null) => {
    if (!status) return 'Pending'
    const match = statusOptions.find((option) => option.value === status)
    return match?.label || status
  }

  const getStatusBadgeClasses = (status?: string | null) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-700'
      case 'REJECTED':
        return 'bg-rose-100 text-rose-700'
      case 'IN_PROGRESS':
        return 'bg-sky-100 text-sky-700'
      case 'COMPLETED':
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-amber-100 text-amber-700'
    }
  }

  const getStatusDotClasses = (status?: string | null) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500'
      case 'REJECTED':
        return 'bg-rose-500'
      case 'IN_PROGRESS':
        return 'bg-sky-500'
      case 'COMPLETED':
        return 'bg-purple-500'
      default:
        return 'bg-amber-500 animate-pulse'
    }
  }

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
    setStatusByRequest({})
  }, [selectedTeamId])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  useEffect(() => {
    if (requests.length === 0) {
      setStatusByRequest({})
      return
    }

    setStatusByRequest(() => {
      const next: Record<string, string> = {}
      requests.forEach((request) => {
        next[request.id] = request.status || 'PENDING'
      })
      return next
    })
  }, [requests])

  const handleReview = async (requestId: string, status: string, notes?: string) => {
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
        setExpandedRequestId(null)
      } else {
        alert(result.error || 'Failed to review request')
      }
    } catch (error) {
      alert('Failed to review request')
    }
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
        <p className="text-slate-400 font-bold text-lg tracking-tight">No requests yet</p>
        <p className="text-slate-300 text-xs mt-1">
          {selectedTeamId && selectedTeamId !== ''
            ? 'No requests for the selected team yet.'
            : 'All caught up! No requests have been submitted across your teams.'}
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
        const normalizedStatus = request.status || 'PENDING'
        const selectedStatus = statusByRequest[request.id] || normalizedStatus
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
                <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${getStatusBadgeClasses(normalizedStatus)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-2 ${getStatusDotClasses(normalizedStatus)}`}></span>
                  {getStatusLabel(normalizedStatus)}
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
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Status
                      </label>
                      <select
                        value={selectedStatus}
                        onChange={(event) =>
                          setStatusByRequest((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
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

            <div className="flex flex-col md:flex-row gap-3 mt-auto">
              <button
                onClick={() => {
                  handleReview(request.id, selectedStatus, reviewNotesValue || undefined)
                }}
                className="flex-1 flex items-center justify-center py-3 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 12h16m-8-8v16" />
                </svg>
                Update Status
              </button>
              <button
                type="button"
                onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                className="flex-1 flex items-center justify-center py-3 bg-white border-2 border-slate-100 text-slate-500 text-xs font-black rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all transform active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d={isExpanded ? 'M6 18L18 6M6 6l12 12' : 'M4 12h16m-8-8v16'}
                  />
                </svg>
                {isExpanded ? 'Close' : 'Details'}
              </button>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
