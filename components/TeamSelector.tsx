'use client'

interface TeamSelectorProps {
  teams: Array<{ id: string; name: string }>
  selectedTeam: string
  onTeamChange: (teamId: string) => void
  onCreateTeam?: () => void
}

export default function TeamSelector({ teams, selectedTeam, onTeamChange, onCreateTeam }: TeamSelectorProps) {
  if (teams.length === 0) {
    return (
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-indigo-800 text-sm font-medium mb-3 text-left">You are not a member of any teams yet.</p>
        {onCreateTeam && (
          <button
            onClick={onCreateTeam}
            className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-all"
          >
            Create Your First Team
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <select
        value={selectedTeam}
        onChange={(e) => onTeamChange(e.target.value)}
        className="block w-full px-4 py-2.5 bg-transparent border-none text-slate-900 text-sm font-bold focus:ring-0 focus:outline-none cursor-pointer appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: `right 0.5rem center`,
          backgroundRepeat: `no-repeat`,
          backgroundSize: `1.5em 1.5em`,
          paddingRight: `2.5rem`
        }}
      >
        <option value="" disabled className="text-slate-400">Select your team...</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id} className="font-sans font-medium py-2">
            {team.name}
          </option>
        ))}
      </select>
    </div>
  )
}

