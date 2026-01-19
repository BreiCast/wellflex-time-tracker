'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdminRequestsViewProps {
  teamId: string
}

export default function AdminRequestsView({ teamId }: AdminRequestsViewProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadRequests = useCallback(async () => {
    if (!teamId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: requestData } = await supabase
        .from('requests')
        .select('*, users(email, full_name)')
        .eq('team_id', teamId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })

      if (requestData) {
        setRequests(requestData)
      }
    } catch (error) {
      console.error('Failed to load requests:', error)
    } finally {
      setLoading(false)
    }
  }, [teamId])

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
    return <div className="text-gray-600">Loading requests...</div>
  }

  if (requests.length === 0) {
    return <div className="text-gray-600">No pending requests</div>
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {requests.map((request) => {
        const user = request.users as any
        return (
          <div
            key={request.id}
            className="p-4 border border-gray-200 rounded-lg"
          >
            <div className="mb-2">
              <p className="text-xs text-gray-500">
                From: {user?.full_name || user?.email}
              </p>
              <h3 className="font-semibold mt-1">{request.request_type}</h3>
              <p className="text-sm text-gray-600 mt-1">{request.description}</p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(request.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  const notes = prompt('Review notes (optional):')
                  handleReview(request.id, 'APPROVED', notes || undefined)
                }}
                className="flex-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const notes = prompt('Review notes (optional):')
                  handleReview(request.id, 'REJECTED', notes || undefined)
                }}
                className="flex-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

