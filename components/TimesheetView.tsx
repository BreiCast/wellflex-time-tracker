'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMinutes } from '@/lib/utils/timesheet'
import CalendarView from './CalendarView'
import AdjustmentEditModal from './AdjustmentEditModal'

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
  const [viewAllMembers, setViewAllMembers] = useState(false)
  const [selectedAdjustment, setSelectedAdjustment] = useState<any>(null)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  
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
      if (!teamId) return
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setCurrentUser(session.user)
        // Only set selectedUserId if not already set by props or state
        setSelectedUserId(prev => prev || initialUserId || session.user.id)

        const isSuperAdmin =
          session.user.user_metadata?.superadmin === true ||
          session.user.user_metadata?.super_admin === true ||
          session.user.user_metadata?.role === 'SUPERADMIN' ||
          session.user.app_metadata?.role === 'SUPERADMIN'

        if (isSuperAdmin) {
          setUserRole('SUPERADMIN')
        }

        const response = await fetch(`/api/teams/${teamId}/members`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })
        const result = await response.json()
        const memberList = response.ok ? result.members || [] : []

        const currentMember = memberList.find((member: any) => member.user_id === session.user.id)
        const role = isSuperAdmin ? 'SUPERADMIN' : (currentMember?.role || 'MEMBER')
        setUserRole(role)

        if (role === 'MANAGER' || role === 'ADMIN' || role === 'SUPERADMIN') {
          setMembers(memberList.map((m: any) => ({
            id: m.user_id,
            name: m.users?.full_name || m.users?.email,
            email: m.users?.email
          })))
        }
      }
    }
    init()
  }, [teamId, initialUserId])

  const loadTimesheet = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // If "all" is selected, use special endpoint or pass "all" as user_id
      const userIdParam = selectedUserId === 'all' ? 'all' : selectedUserId
      
      const response = await fetch(
        `/api/timesheet?user_id=${userIdParam}&team_id=${teamId}&start_date=${dateRange.start}&end_date=${dateRange.end}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      const result = await response.json()
      if (response.ok) {
        setTimesheet(result.timesheet || [])
        setViewAllMembers(result.viewAllMembers || false)
      }
    } catch (error) {
      console.error('Failed to load timesheet:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, teamId, dateRange])

  useEffect(() => {
    // Only require teamId if it's not empty (not "All Teams")
    if (teamId && teamId !== '') {
      if (selectedUserId) {
        loadTimesheet()
      }
    } else if (teamId === '') {
      // When "All Teams" is selected, show empty state or aggregate
      setTimesheet([])
      setLoading(false)
    }
  }, [selectedUserId, teamId, dateRange, loadTimesheet])

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
      <div className="flex flex-col gap-4">
        {/* First Row: Month Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl shadow-sm">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 hover:text-indigo-600"
                aria-label="Previous month"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToToday}
                className="px-4 py-1.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 hover:text-indigo-600"
                aria-label="Next month"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Second Row: User Selector and View Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {(userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'SUPERADMIN') && members.length > 0 && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm hover:border-slate-300 transition-colors"
            >
              <option value="all">All Members</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-xl shadow-sm border border-slate-200">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-5 py-2.5 rounded-lg text-sm font-black transition-all ${
                viewMode === 'calendar' 
                  ? 'bg-white shadow-md text-indigo-600 border-2 border-indigo-500' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-5 py-2.5 rounded-lg text-sm font-black transition-all ${
                viewMode === 'table' 
                  ? 'bg-white shadow-md text-indigo-600 border-2 border-indigo-500' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
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
      {!teamId || teamId === '' ? (
        <div className="h-96 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-dashed border-slate-300 shadow-sm">
          <div className="w-20 h-20 bg-slate-200 rounded-2xl flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-slate-600 font-black text-lg mb-2">Select a Team</p>
          <p className="text-slate-400 text-sm font-bold max-w-sm text-center">
            Please select a specific team from the dropdown above to view timesheet data.
          </p>
        </div>
      ) : loading ? (
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
                  {viewAllMembers && (
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Member</th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Break</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {timesheet.filter(e => e.totalMinutes > 0 || e.adjustments.length > 0).map((entry, index) => (
                  <>
                    <tr key={`${entry.date}-${entry.user_id || ''}-${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">
                          {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                      {viewAllMembers && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-black text-slate-700">
                            {entry.user_name || 'Unknown'}
                          </div>
                        </td>
                      )}
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
                        <div className="flex items-center gap-2">
                          {entry.workMinutes > 480 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 uppercase">Overtime</span>
                          ) : entry.workMinutes > 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 uppercase">Regular</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-400 uppercase">No Data</span>
                          )}
                          {entry.adjustments && entry.adjustments.length > 0 && (
                            <button
                              onClick={() => {
                                const key = `${entry.date}-${entry.user_id || ''}`
                                setExpandedEntries(prev => {
                                  const newSet = new Set(prev)
                                  if (newSet.has(key)) {
                                    newSet.delete(key)
                                  } else {
                                    newSet.add(key)
                                  }
                                  return newSet
                                })
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-black bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                              title={`${entry.adjustments.length} adjustment(s)`}
                            >
                              {entry.adjustments.length} ⚙️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {entry.adjustments && entry.adjustments.length > 0 && expandedEntries.has(`${entry.date}-${entry.user_id || ''}`) && (
                      <tr key={`${entry.date}-${entry.user_id || ''}-adjustments`} className="bg-amber-50/50">
                        <td colSpan={viewAllMembers ? 7 : 6} className="px-6 py-4">
                          <div className="space-y-2">
                            <p className="text-xs font-black text-amber-700 uppercase tracking-wider mb-2">Adjustments</p>
                            {entry.adjustments.map((adj: any) => (
                              <div key={adj.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-200">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                                      adj.adjustment_type === 'ADD_TIME' ? 'bg-emerald-100 text-emerald-700' :
                                      adj.adjustment_type === 'SUBTRACT_TIME' ? 'bg-rose-100 text-rose-700' :
                                      'bg-indigo-100 text-indigo-700'
                                    }`}>
                                      {adj.adjustment_type.replace('_', ' ')}
                                    </span>
                                    <span className="text-sm font-mono font-black text-slate-900">
                                      {formatMinutes(adj.minutes)}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {new Date(adj.effective_date).toLocaleDateString()}
                                    </span>
                                    {adj.description && (
                                      <span className="text-xs text-slate-600 italic">
                                        {adj.description}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {(userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SUPERADMIN') && (
                                  <button
                                    onClick={() => {
                                      setSelectedAdjustment(adj)
                                      setIsAdjustmentModalOpen(true)
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {timesheet.filter(e => e.totalMinutes > 0 || e.adjustments.length > 0).length === 0 && (
                  <tr>
                    <td colSpan={viewAllMembers ? 7 : 6} className="px-6 py-12 text-center text-slate-400 font-bold">
                      No records found for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjustment Edit Modal */}
      {selectedAdjustment && (
        <AdjustmentEditModal
          adjustment={selectedAdjustment}
          isOpen={isAdjustmentModalOpen}
          onClose={() => {
            setIsAdjustmentModalOpen(false)
            setSelectedAdjustment(null)
          }}
          onUpdated={() => {
            loadTimesheet()
            setIsAdjustmentModalOpen(false)
            setSelectedAdjustment(null)
          }}
        />
      )}
    </div>
  )
}
