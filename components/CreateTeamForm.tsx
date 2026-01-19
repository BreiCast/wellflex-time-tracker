'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CreateTeamFormProps {
  onTeamCreated: () => void
}

export default function CreateTeamForm({ onTeamCreated }: CreateTeamFormProps) {
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: teamName }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create team')
      }

      setTeamName('')
      // Call the callback to reload teams
      onTeamCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-50 rounded-lg">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          required
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team name"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Team'}
        </button>
      </div>
    </form>
  )
}

