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
              <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100 italic">
                "{request.description}"
              </p>
            </div>

            <div className="flex gap-3 mt-auto">
              <button
                onClick={() => {
                  const notes = prompt('Review notes (optional):')
                  handleReview(request.id, 'APPROVED', notes || undefined)
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
                  const notes = prompt('Review notes (optional):')
                  handleReview(request.id, 'REJECTED', notes || undefined)
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
    </div>
  )
}

