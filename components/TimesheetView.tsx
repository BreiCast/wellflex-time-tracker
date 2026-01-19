'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMinutes } from '@/lib/utils/timesheet'
import CalendarView from './CalendarView'

interface TimesheetViewProps {
  userId?: string
  teamId: string
  isFullPage?: boolean
}

export default function TimesheetView({ userId: initialUserId, teamId, isFullPage = false }: TimesheetViewProps) {
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar')
  const [timesheet, setTimesheet] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || '')
  const [members, setMembers] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('MEMBER')
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Date range for fetching
  const dateRange = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  }, [currentMonth])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setCurrentUser(session.user)
        if (!selectedUserId) setSelectedUserId(session.user.id)
        
        // Load user role and members if MANAGER/ADMIN
        const { data: memberData } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', teamId)
          .eq('user_id', session.user.id)
          .single()
        
        const role = memberData?.role || 'MEMBER'
        setUserRole(role)

        if (role === 'MANAGER' || role === 'ADMIN') {
          const { data: teamMembers } = await supabase
            .from('team_members')
            .select('user_id, users(id, email, full_name)')
            .eq('team_id', teamId)
          
          if (teamMembers) {
            setMembers(teamMembers.map((m: any) => ({
              id: m.user_id,
              name: m.users?.full_name || m.users?.email,
              email: m.users?.email
            })))
          }
        }
      }
    }
    init()
  }, [teamId, initialUserId])

  useEffect(() => {
    if (selectedUserId && teamId) {
      loadTimesheet()
    }
  }, [selectedUserId, teamId, dateRange])

  const loadTimesheet = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `/api/timesheet?user_id=${selectedUserId}&team_id=${teamId}&start_date=${dateRange.start}&end_date=${dateRange.end}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      const result = await response.json()
      if (response.ok) {
        setTimesheet(result.timesheet || [])
      }
    } catch (error) {
      console.error('Failed to load timesheet:', error)
    } finally {
      setLoading(false)
    }
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const goToToday = () => {
    const d = new Date()
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  const totalWorkMinutes = timesheet.reduce((sum, entry) => sum + entry.workMinutes, 0)
  const totalAdjustments = timesheet.reduce((sum, entry) => sum + entry.adjustedMinutes, 0)

  return (
    <div className="space-y-6">
      {/* Header / Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(userRole === 'MANAGER' || userRole === 'ADMIN') && members.length > 0 && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
            >
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'calendar' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Total Work Time</p>
          <p className="text-2xl font-black text-indigo-900 font-mono">
            {Math.floor(totalWorkMinutes / 60)}h {totalWorkMinutes % 60}m
          </p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Days Worked</p>
          <p className="text-2xl font-black text-emerald-900 font-mono">
            {timesheet.filter(e => e.workMinutes > 0).length}
          </p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Adjustments</p>
          <p className="text-2xl font-black text-amber-900 font-mono">
            {totalAdjustments > 0 ? '+' : ''}{Math.floor(totalAdjustments / 60)}h {Math.abs(totalAdjustments % 60)}m
          </p>
        </div>
      </div>

      {/* Main View */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-500 font-bold">Loading records...</p>
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarView entries={timesheet} currentDate={currentMonth} />
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Break</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {timesheet.filter(e => e.totalMinutes > 0 || e.adjustments.length > 0).map((entry) => (
                  <tr key={entry.date} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">
                        {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600 font-mono">
                        {entry.clockIn ? new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600 font-mono">
                        {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500 font-mono">
                        {entry.breakMinutes > 0 ? formatMinutes(entry.breakMinutes) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-black text-slate-900 font-mono">
                        {formatMinutes(entry.workMinutes)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.workMinutes > 480 ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 uppercase">Overtime</span>
                      ) : entry.workMinutes > 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 uppercase">Regular</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-400 uppercase">No Data</span>
                      )}
                    </td>
                  </tr>
                ))}
                {timesheet.filter(e => e.totalMinutes > 0 || e.adjustments.length > 0).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">
                      No records found for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
