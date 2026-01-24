'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'
import TeamSelector from '@/components/TeamSelector'
import TeamSwitcher from '@/components/TeamSwitcher'
import TeamProgressBar from '@/components/TeamProgressBar'
import LateClockInModal from '@/components/LateClockInModal'

interface TimeSession {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  team_id: string
}

interface BreakSegment {
  id: string
  break_type: 'BREAK' | 'LUNCH'
  break_start_at: string
  break_end_at: string | null
  time_session_id: string
}

export default function TrackingPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [teams, setTeams] = useState<Array<{ id: string; name: string; color?: string }>>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('MEMBER')
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null)
  const [teamProgress, setTeamProgress] = useState<Record<string, { current: number; scheduled: number }>>({})
  const [schedules, setSchedules] = useState<any[]>([])
  const [activeBreak, setActiveBreak] = useState<BreakSegment | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [todayStats, setTodayStats] = useState({
    totalMinutes: 0,
    breakMinutes: 0,
    workMinutes: 0,
    sessionCount: 0,
    totalSeconds: 0,
    breakSeconds: 0,
    workSeconds: 0,
  })
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [isLateModalOpen, setIsLateModalOpen] = useState(false)
  const [scheduledStartTime, setScheduledStartTime] = useState<string | null>(null)

  // Update current time every second for live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const loadTeams = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) return []

    try {
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Error loading teams:', result.error)
        return []
      }

      if (result.teams && result.teams.length > 0) {
        const hasManagementRole = result.teams.some((tm: any) =>
          tm.role === 'ADMIN' || tm.role === 'MANAGER' || tm.role === 'SUPERADMIN'
        )
        setUserRole(result.is_superadmin ? 'SUPERADMIN' : (hasManagementRole ? 'ADMIN' : 'MEMBER'))

        const teamList = result.teams.map((team: any) => ({
          id: team.id,
          name: team.name,
          color: team.color || '#6366f1',
        }))
        setTeams(teamList)
        if (teamList.length > 0 && !selectedTeam) {
          setSelectedTeam(teamList[0].id)
        }
        return teamList
      }
    } catch (error) {
      console.error('Error loading teams:', error)
    }
    return []
  }, [selectedTeam])

  const loadActiveSession = useCallback(async () => {
    if (!user) return

    const supabase = createClient()
    // Only select essential columns - uses idx_time_sessions_user_active
    const { data: sessionData } = await supabase
      .from('time_sessions')
      .select('id, user_id, team_id, clock_in_at, clock_out_at') // Only essential columns
      .eq('user_id', user.id)
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionData) {
      setActiveSession(sessionData as TimeSession)

      // Only select essential columns for break
      const { data: breakData } = await supabase
        .from('break_segments')
        .select('id, time_session_id, break_type, break_start_at, break_end_at') // Only essential columns
        .eq('time_session_id', sessionData.id)
        .is('break_end_at', null)
        .maybeSingle()

      setActiveBreak(breakData as BreakSegment | null)
    } else {
      setActiveSession(null)
      setActiveBreak(null)
    }
  }, [user])

  const loadSchedules = useCallback(async (now = new Date()) => {
    if (!user) return

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const today = new Date()
    const dayOfWeek = today.getDay()

    const response = await fetch(`/api/schedules`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    const result = await response.json()
    if (response.ok) {
      setSchedules(result.schedules || [])
      
      // Calculate scheduled minutes for today
      const todaySchedules = result.schedules?.filter((s: any) => s.day_of_week === dayOfWeek) || []
      const scheduledByTeam: Record<string, number> = {}
      
      todaySchedules.forEach((schedule: any) => {
        const start = schedule.start_time.split(':').map(Number)
        const end = schedule.end_time.split(':').map(Number)
        const startMinutes = start[0] * 60 + start[1]
        const endMinutes = end[0] * 60 + end[1]
        scheduledByTeam[schedule.team_id] = (scheduledByTeam[schedule.team_id] || 0) + (endMinutes - startMinutes)
      })

      // Calculate actual minutes worked today per team
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)

      // Only select essential columns for today's stats
      const { data: todaySessions } = await supabase
        .from('time_sessions')
        .select('id, team_id, clock_in_at, clock_out_at') // Already optimized
        .eq('user_id', user.id)
        .gte('clock_in_at', todayStart.toISOString())
        .lt('clock_in_at', todayEnd.toISOString())
        .order('clock_in_at', { ascending: false }) // Use indexed ordering

      const workedByTeam: Record<string, number> = {}
      
      if (todaySessions) {
        todaySessions.forEach((session: any) => {
          const clockIn = new Date(session.clock_in_at)
          const clockOut = session.clock_out_at ? new Date(session.clock_out_at) : now
          const minutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / (1000 * 60))
          workedByTeam[session.team_id] = (workedByTeam[session.team_id] || 0) + minutes
        })
      }

      // Combine into progress object
      const progress: Record<string, { current: number; scheduled: number }> = {}
      teams.forEach(team => {
        progress[team.id] = {
          current: workedByTeam[team.id] || 0,
          scheduled: scheduledByTeam[team.id] || 0,
        }
      })
      setTeamProgress(progress)
    }
  }, [user, teams])

  const loadTodayStats = useCallback(async (now = new Date()) => {
    if (!user) return

    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get today's sessions - only select essential columns
    const { data: sessions } = await supabase
      .from('time_sessions')
      .select('id, clock_in_at, clock_out_at, break_segments(id, break_start_at, break_end_at)') // Only essential columns
      .eq('user_id', user.id)
      .gte('clock_in_at', today.toISOString())
      .lt('clock_in_at', tomorrow.toISOString())
      .order('clock_in_at', { ascending: false })

    if (sessions) {
      let totalSeconds = 0
      let breakSeconds = 0
      let sessionCount = sessions.length

      sessions.forEach((session: any) => {
        if (session.clock_out_at) {
          const clockIn = new Date(session.clock_in_at)
          const clockOut = new Date(session.clock_out_at)
          totalSeconds += Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000)
        } else if (activeSession && session.id === activeSession.id) {
          const clockIn = new Date(session.clock_in_at)
          totalSeconds += Math.floor((now.getTime() - clockIn.getTime()) / 1000)
        }

        if (session.break_segments) {
          session.break_segments.forEach((breakSeg: any) => {
            if (breakSeg.break_end_at) {
              const breakStart = new Date(breakSeg.break_start_at)
              const breakEnd = new Date(breakSeg.break_end_at)
              breakSeconds += Math.floor((breakEnd.getTime() - breakStart.getTime()) / 1000)
            } else if (activeBreak && breakSeg.id === activeBreak.id) {
              const breakStart = new Date(breakSeg.break_start_at)
              breakSeconds += Math.floor((now.getTime() - breakStart.getTime()) / 1000)
            }
          })
        }
      })

      setTodayStats({
        totalMinutes: Math.floor(totalSeconds / 60),
        breakMinutes: Math.floor(breakSeconds / 60),
        workMinutes: Math.floor((totalSeconds - breakSeconds) / 60),
        sessionCount,
        totalSeconds,
        breakSeconds,
        workSeconds: totalSeconds - breakSeconds,
      })
    }
  }, [user, activeSession, activeBreak])

  const loadRecentSessions = useCallback(async () => {
    if (!user) return

    const supabase = createClient()
    const { data: sessions } = await supabase
      .from('time_sessions')
      .select('*, teams(name, color)')
      .eq('user_id', user.id)
      .order('clock_in_at', { ascending: false })
      .limit(10)

    if (sessions) {
      setRecentSessions(sessions)
    }
  }, [user])

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)
      await loadTeams()
      setLoading(false)
    }

    loadData()
  }, [router, loadTeams])

  useEffect(() => {
    if (user) {
      loadActiveSession()
      loadRecentSessions()
    }
  }, [user, loadActiveSession, loadRecentSessions])

  useEffect(() => {
    if (!user) return

    const refreshStats = () => {
      const now = new Date()
      loadTodayStats(now)
      loadSchedules(now)
    }

    refreshStats()
    const interval = setInterval(refreshStats, 60000)
    return () => clearInterval(interval)
  }, [user, loadTodayStats, loadSchedules])

  const checkIfLate = async (): Promise<{ isLate: boolean; scheduledStart: Date | null }> => {
    if (!selectedTeam || !user) {
      return { isLate: false, scheduledStart: null }
    }

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { isLate: false, scheduledStart: null }

      const now = new Date()
      const dayOfWeek = now.getDay()

      const { data: schedule } = await supabase
        .from('schedules')
        .select('start_time')
        .eq('user_id', user.id)
        .eq('team_id', selectedTeam)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .single()

      if (!schedule) {
        return { isLate: false, scheduledStart: null }
      }

      const [startHour, startMin] = schedule.start_time.split(':').map(Number)
      const scheduledStart = new Date(now)
      scheduledStart.setHours(startHour, startMin, 0, 0)

      const isLate = now > scheduledStart

      return { isLate, scheduledStart }
    } catch (err) {
      console.error('Error checking if late:', err)
      return { isLate: false, scheduledStart: null }
    }
  }

  const handleClockIn = async () => {
    if (!selectedTeam) {
      setError('Please select a team')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      // Check if user is late
      const { isLate, scheduledStart } = await checkIfLate()

      if (isLate && scheduledStart) {
        // Show modal for late clock-in
        setScheduledStartTime(scheduledStart.toISOString())
        setIsLateModalOpen(true)
        setActionLoading(false)
        return
      }

      // Not late - proceed with normal clock-in
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/time-sessions/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ team_id: selectedTeam }),
      })

      const result = await response.json()
      if (!response.ok) {
        // If API says we're late, show modal
        if (result.isLate) {
          setScheduledStartTime(null)
          setIsLateModalOpen(true)
          setActionLoading(false)
          return
        }
        throw new Error(result.error || 'Failed to clock in')
      }

      await loadActiveSession()
      await loadTodayStats()
    } catch (err: any) {
      setError(err.message || 'Failed to clock in')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!activeSession) return
    setActionLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/time-sessions/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ time_session_id: activeSession.id }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to clock out')

      await loadActiveSession()
      await loadTodayStats()
      await loadRecentSessions()
    } catch (err: any) {
      setError(err.message || 'Failed to clock out')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBreakStart = async (breakType: 'BREAK' | 'LUNCH') => {
    if (!activeSession) return
    setActionLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/breaks/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          time_session_id: activeSession.id,
          break_type: breakType,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to start break')

      await loadActiveSession()
      await loadTodayStats()
    } catch (err: any) {
      setError(err.message || 'Failed to start break')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBreakEnd = async () => {
    if (!activeBreak) return
    setActionLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/breaks/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ break_segment_id: activeBreak.id }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to end break')

      await loadActiveSession()
      await loadTodayStats()
    } catch (err: any) {
      setError(err.message || 'Failed to end break')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDurationShort = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getSessionDuration = (): number => {
    if (!activeSession) return 0
    const clockIn = new Date(activeSession.clock_in_at)
    return Math.floor((currentTime.getTime() - clockIn.getTime()) / 1000)
  }

  const getBreakDuration = (): number => {
    if (!activeBreak) return 0
    const breakStart = new Date(activeBreak.break_start_at)
    return Math.floor((currentTime.getTime() - breakStart.getTime()) / 1000)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium">Loading wetrack...</p>
        </div>
      </div>
    )
  }

  const sessionDuration = getSessionDuration()
  const breakDuration = getBreakDuration()

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <DashboardNav
        activeTab="tracking"
        onTabChange={(tab) => {
          if (tab === 'tracking') {
            router.push('/tracking')
          } else {
            router.push(`/dashboard?tab=${tab}`)
          }
        }}
        userEmail={user?.email}
        userRole={userRole}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Time Tracking</h1>
          <p className="mt-1 text-slate-500 font-medium">Track your work hours and breaks in real-time.</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-xl flex items-center shadow-sm animate-in slide-in-from-top duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Team Progress Bars */}
        {teams.length > 0 && Object.keys(teamProgress).length > 0 && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">Today&apos;s Progress</h2>
                <p className="text-sm font-bold text-slate-400 mt-1">Track your hours against scheduled time</p>
              </div>
              <button
                onClick={() => router.push(`/dashboard?tab=teams&schedule=${selectedTeam}`)}
                className="px-4 py-2 text-xs font-black text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
              >
                Manage Schedules
              </button>
            </div>
            <div className="space-y-4">
              {teams.map(team => {
                const progress = teamProgress[team.id] || { current: 0, scheduled: 0 }
                return (
                  <TeamProgressBar
                    key={team.id}
                    teamName={team.name}
                    teamColor={team.color || '#6366f1'}
                    currentMinutes={progress.current}
                    scheduledMinutes={progress.scheduled}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Today's Stats */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Today&apos;s Total</h3>
            </div>
            <p className="text-4xl font-black text-slate-900 font-mono tracking-tighter tabular-nums">
              {formatDurationShort(todayStats.workSeconds || todayStats.workMinutes * 60)}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-400">
                <span className="text-indigo-600 font-black">{formatDurationShort(todayStats.totalSeconds)}</span> total
              </div>
              <div className="text-xs font-bold text-slate-400">
                <span className="text-orange-500 font-black">{formatDurationShort(todayStats.breakSeconds)}</span> breaks
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Sessions Today</h3>
            </div>
            <p className="text-4xl font-black text-slate-900 tabular-nums">
              {todayStats.sessionCount}
            </p>
            <p className="mt-4 text-xs font-bold text-slate-400 truncate">
              Focusing on: <span className="text-indigo-600 font-black">{teams.find(t => t.id === (activeSession?.team_id || selectedTeam))?.name || '...'}</span>
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Status</h3>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full animate-pulse ${activeSession ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-300'}`}></div>
              <p className={`text-2xl font-black ${activeSession ? 'text-emerald-600' : 'text-slate-400'}`}>
                {activeSession ? 'Clocked In' : 'Clocked Out'}
              </p>
            </div>
            <p className="mt-4 text-xs font-bold text-slate-400 italic">&quot;Focus on being productive instead of busy.&quot;</p>
          </div>
        </div>

        {/* Main Timer Card */}
        <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] rounded-[3rem] border border-slate-100 overflow-hidden mb-12 transition-all duration-500">
          <div className="relative p-10 md:p-20 text-center">
            {/* Background design element */}
            <div className="absolute top-0 right-0 -mt-24 -mr-24 w-80 h-80 bg-indigo-50/40 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-80 h-80 bg-blue-50/40 rounded-full blur-3xl"></div>
            
            {activeSession ? (
              <div className="relative z-10">
                <div className="inline-flex items-center px-5 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black mb-8 border border-emerald-100/50 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2.5 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                  LIVE RECORDING
                </div>
                
                {/* Current Team Badge */}
                {(() => {
                  const currentTeam = teams.find(t => t.id === activeSession.team_id)
                  return currentTeam ? (
                    <div className="mb-6 flex items-center justify-center">
                      <div 
                        className="px-6 py-2.5 rounded-2xl text-sm font-black text-white shadow-lg"
                        style={{ backgroundColor: currentTeam.color }}
                      >
                        {currentTeam.name}
                      </div>
                    </div>
                  ) : null
                })()}
                
                <div className="mb-12">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Current Work Session</p>
                  <p className="text-8xl md:text-[10rem] font-black text-slate-900 font-mono tracking-tighter tabular-nums leading-none drop-shadow-sm">
                    {formatDurationShort(sessionDuration)}
                  </p>
                  <div className="mt-8 flex items-center justify-center space-x-2 text-slate-400 font-bold text-sm bg-slate-50/50 w-fit mx-auto px-4 py-2 rounded-xl border border-slate-100/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Started at {new Date(activeSession.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>

                {/* Team Switcher */}
                {teams.length > 1 && (
                  <TeamSwitcher
                    activeSessionId={activeSession.id}
                    currentTeamId={activeSession.team_id}
                    teams={teams}
                    onTeamSwitched={async () => {
                      await loadActiveSession()
                      await loadSchedules()
                    }}
                  />
                )}

                {activeBreak ? (
                  <div className="mb-12 inline-block p-8 bg-amber-50/90 backdrop-blur-md border border-amber-100 rounded-[2.5rem] shadow-xl shadow-amber-900/5 animate-in fade-in zoom-in duration-500 hover:scale-[1.02] transition-transform text-center">
                    <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ON {activeBreak.break_type === 'LUNCH' ? 'LUNCH' : 'BREAK'}
                    </p>
                    <p className="text-5xl font-black text-amber-900 font-mono tabular-nums tracking-tighter leading-none mb-3">
                      {formatDurationShort(breakDuration)}
                    </p>
                    <p className="text-xs text-amber-600/70 font-black italic">
                      Started at {new Date(activeBreak.break_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <div className="mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 text-center">Ready for a rest?</p>
                    <div className="flex flex-wrap items-center justify-center gap-5">
                      <button
                        onClick={() => handleBreakStart('BREAK')}
                        disabled={actionLoading}
                        className="group relative flex items-center px-10 py-5 bg-white border-[3px] border-slate-100 text-slate-700 font-black rounded-3xl hover:border-indigo-600 hover:text-indigo-600 hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300 disabled:opacity-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        15 min Break
                      </button>
                      <button
                        onClick={() => handleBreakStart('LUNCH')}
                        disabled={actionLoading}
                        className="group relative flex items-center px-10 py-5 bg-white border-[3px] border-slate-100 text-slate-700 font-black rounded-3xl hover:border-orange-500 hover:text-orange-500 hover:shadow-xl hover:shadow-orange-900/5 transition-all duration-300 disabled:opacity-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.703 2.703 0 00-3 0 2.703 2.703 0 01-3 0 2.703 2.703 0 00-3 0 2.704 2.704 0 01-1.5-.454M3 20h18M3 4h18M4 4h16v12H4V4z" />
                        </svg>
                        1 hr Lunch
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-5 justify-center mt-10">
                  {activeBreak && (
                    <button
                      onClick={handleBreakEnd}
                      disabled={actionLoading}
                      className="px-12 py-6 bg-amber-500 text-white text-xl font-black rounded-[2rem] hover:bg-amber-600 shadow-xl shadow-amber-500/25 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading ? '...' : 'FINISH BREAK'}
                    </button>
                  )}
                  <button
                    onClick={handleClockOut}
                    disabled={actionLoading}
                    className="px-12 py-6 bg-slate-900 text-white text-xl font-black rounded-[2rem] hover:bg-black shadow-xl shadow-slate-900/25 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                  >
                    {actionLoading ? '...' : 'CLOCK OUT'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative z-10 py-12 animate-in fade-in duration-1000">
                <div className="w-28 h-28 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-sm border border-indigo-100/50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="mb-12">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-6 leading-relaxed">Ready to Start</p>
                  
                  {/* Integrated Team Selector */}
                  <div className="max-w-xs mx-auto mb-8 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                    <TeamSelector
                      teams={teams}
                      selectedTeam={selectedTeam}
                      onTeamChange={setSelectedTeam}
                    />
                  </div>

                  <p className="text-8xl font-black text-slate-100 font-mono tracking-tighter tabular-nums mb-6">00:00:00</p>
                  <p className="text-slate-400 max-w-sm mx-auto font-bold text-lg leading-relaxed px-4">Select your team above and hit the start button below to begin tracking.</p>
                </div>
                <button
                  onClick={handleClockIn}
                  disabled={actionLoading || !selectedTeam}
                  className="group relative inline-flex items-center px-16 py-7 bg-indigo-600 text-white text-2xl font-black rounded-[2.5rem] hover:bg-indigo-700 shadow-2xl shadow-indigo-600/30 transition-all duration-500 transform hover:-translate-y-1.5 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:translate-y-0"
                >
                  {actionLoading ? 'STARTING...' : (
                    <>
                      <span>START WORK SESSION</span>
                      <div className="ml-4 bg-white/20 p-1.5 rounded-full group-hover:translate-x-2 transition-transform duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-indigo-900/5">
          <div className="p-10 border-b border-slate-50 flex items-center justify-between flex-wrap gap-6">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recent Activity</h2>
              <p className="text-sm font-bold text-slate-400 mt-1.5 flex items-center">
                <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
                Last 10 recorded work sessions
              </p>
            </div>
            <button 
              onClick={() => router.push('/dashboard?tab=timesheet')}
              className="group px-6 py-3 text-sm font-black text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 rounded-2xl transition-all duration-300 flex items-center"
            >
              Full Timesheet 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-50">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                  <th className="px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Team</th>
                  <th className="px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Timeline</th>
                  <th className="px-10 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Total Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-10 py-24 text-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </div>
                      <p className="text-slate-400 font-bold text-xl">No sessions recorded yet.</p>
                      <p className="text-slate-300 text-sm mt-2">Start your first session to see it here.</p>
                    </td>
                  </tr>
                ) : (
                  recentSessions.map((session: any) => {
                    const clockIn = new Date(session.clock_in_at)
                    const clockOut = session.clock_out_at ? new Date(session.clock_out_at) : null
                    const durationSeconds = clockOut
                      ? Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000)
                      : Math.floor((currentTime.getTime() - clockIn.getTime()) / 1000)

                    return (
                      <tr key={session.id} className="group hover:bg-slate-50/80 transition-colors duration-200">
                        <td className="px-10 py-8 whitespace-nowrap">
                          <div className="text-sm font-black text-slate-900">{clockIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </td>
                        <td className="px-10 py-8 whitespace-nowrap">
                          <span 
                            className="inline-flex items-center px-4 py-1.5 rounded-xl text-white text-xs font-black border shadow-sm"
                            style={{ 
                              backgroundColor: session.teams?.color || '#6366f1',
                              borderColor: session.teams?.color || '#6366f1'
                            }}
                          >
                            {session.teams?.name || 'N/A'}
                          </span>
                        </td>
                        <td className="px-10 py-8 whitespace-nowrap">
                          <div className="flex items-center space-x-3 text-sm font-bold text-slate-500">
                            <span className="bg-slate-100 px-2 py-1 rounded-lg text-[10px] uppercase text-slate-400 tracking-wider">Start</span>
                            <span>{clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-slate-200 font-light mx-1">/</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-lg text-[10px] uppercase text-slate-400 tracking-wider">End</span>
                            {clockOut ? (
                              <span>{clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            ) : (
                              <span className="text-emerald-500 font-black animate-pulse flex items-center">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                                NOW
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-10 py-8 whitespace-nowrap font-mono text-sm font-black">
                          <div className={`inline-flex items-center px-4 py-2 rounded-2xl ${!clockOut ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-700 border border-slate-100'} shadow-sm`}>
                            {formatDurationShort(durationSeconds)}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <LateClockInModal
        teamId={selectedTeam}
        scheduledStartTime={scheduledStartTime}
        isOpen={isLateModalOpen}
        onClose={() => {
          setIsLateModalOpen(false)
          setScheduledStartTime(null)
        }}
        onClockInSuccess={async () => {
          await loadActiveSession()
          await loadTodayStats()
        }}
      />
    </div>
  )
}
