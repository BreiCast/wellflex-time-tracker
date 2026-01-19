'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RequestsViewProps {
  userId: string
  teamId: string
}

export default function RequestsView({ userId, teamId }: RequestsViewProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    request_type: '',
    description: '',
  })

  const loadRequests = useCallback(async () => {
    if (!teamId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: requestData } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', userId)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

      if (requestData) {
        setRequests(requestData)
      }
    } catch (error) {
      console.error('Failed to load requests:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, teamId])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamId) return

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_id: teamId,
          request_type: formData.request_type,
          description: formData.description,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setShowForm(false)
        setFormData({ request_type: '', description: '' })
        loadRequests()
      } else {
        alert(result.error || 'Failed to create request')
      }
    } catch (error) {
      alert('Failed to create request')
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading requests...</div>
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'New Request'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Request Type
            </label>
            <input
              type="text"
              required
              value={formData.request_type}
              onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
              placeholder="e.g., Time Correction, Missing Clock Out"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your request..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Submit Request
          </button>
        </form>
      )}

      <div className="space-y-2">
        {requests.length === 0 ? (
          <p className="text-gray-600">No requests yet</p>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{request.request_type}</h3>
                  <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Created: {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    request.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : request.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {request.status}
                </span>
              </div>
              {request.review_notes && (
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Review:</strong> {request.review_notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

