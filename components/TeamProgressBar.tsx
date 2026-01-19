'use client'

interface TeamProgressBarProps {
  teamName: string
  teamColor: string
  currentMinutes: number
  scheduledMinutes: number
  showLabel?: boolean
}

export default function TeamProgressBar({ 
  teamName, 
  teamColor, 
  currentMinutes, 
  scheduledMinutes,
  showLabel = true 
}: TeamProgressBarProps) {
  const percentage = scheduledMinutes > 0 
    ? Math.min((currentMinutes / scheduledMinutes) * 100, 100)
    : 0

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: teamColor }}
            ></div>
            <span className="text-sm font-black text-slate-700">{teamName}</span>
          </div>
          <div className="text-xs font-bold text-slate-500">
            <span className="text-slate-700">{formatTime(currentMinutes)}</span>
            {scheduledMinutes > 0 && (
              <span className="text-slate-400"> / {formatTime(scheduledMinutes)}</span>
            )}
          </div>
        </div>
      )}
      
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out relative"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: teamColor,
            boxShadow: `0 0 10px ${teamColor}40`
          }}
        >
          {percentage >= 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          )}
        </div>
      </div>
      
      {scheduledMinutes > 0 && (
        <div className="mt-1 text-xs font-bold text-slate-400 text-right">
          {percentage >= 100 ? (
            <span className="text-emerald-600">✓ Goal reached!</span>
          ) : (
            <span>{Math.round(percentage)}% complete</span>
          )}
        </div>
      )}
    </div>
  )
}

