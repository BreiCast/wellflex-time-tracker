'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
  color?: string
}

interface TeamSwitcherProps {
  activeSessionId: string
  currentTeamId: string
  teams: Team[]
  onTeamSwitched: () => void
}

export default function TeamSwitcher({ activeSessionId, currentTeamId, teams, onTeamSwitched }: TeamSwitcherProps) {
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')

  const handleSwitchTeam = async (newTeamId: string) => {
    if (newTeamId === currentTeamId) return

    setSwitching(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/time-sessions/switch-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          time_session_id: activeSessionId,
          team_id: newTeamId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to switch team')
      }

      onTeamSwitched()
    } catch (err: any) {
      setError(err.message || 'Failed to switch team')
    } finally {
      setSwitching(false)
    }
  }

  const availableTeams = teams.filter(t => t.id !== currentTeamId)
  const currentTeam = teams.find(t => t.id === currentTeamId)

  if (availableTeams.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg text-sm font-semibold">
          {error}
        </div>
      )}
      
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Current Team</p>
            <div className="flex items-center space-x-3">
              <div 
                className="w-4 h-4 rounded-full shadow-sm border border-white/50"
                style={{ backgroundColor: currentTeam?.color || '#6366f1' }}
              ></div>
              <p className="text-lg font-black text-slate-900">{currentTeam?.name || 'Unknown'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Switch To</p>
            <p className="text-xs text-slate-500 font-bold">Another Client</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {availableTeams.map((team) => (
            <button
              key={team.id}
              onClick={() => handleSwitchTeam(team.id)}
              disabled={switching}
              className="group flex items-center px-5 py-3 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-lg transition-all duration-300 disabled:opacity-50"
              style={{ 
                borderColor: switching ? undefined : team.color || '#6366f1',
                borderWidth: '2px'
              }}
            >
              <div 
                className="w-3 h-3 rounded-full mr-3 shadow-sm"
                style={{ backgroundColor: team.color || '#6366f1' }}
              ></div>
              <span className="font-black text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">
                {team.name}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

