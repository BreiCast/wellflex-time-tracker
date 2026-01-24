'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import RequestDetailModal from './RequestDetailModal'

interface RequestsViewProps {
  userId: string
  teamId: string
}

export default function RequestsView({ userId, teamId }: RequestsViewProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userTeams, setUserTeams] = useState<any[]>([])
  const [availableBreaks, setAvailableBreaks] = useState<any[]>([])
  const [loadingBreaks, setLoadingBreaks] = useState(false)
  const [formData, setFormData] = useState({
    team_id: teamId || '',
    request_type: '',
    description: '',
    requested_date_from: new Date().toISOString().split('T')[0],
    requested_date_to: new Date().toISOString().split('T')[0],
    requested_time_from: '',
    requested_time_to: '',
    // Break-specific fields
    break_type: 'BREAK' as 'BREAK' | 'LUNCH',
    break_segment_id: '',
    current_duration_minutes: 0,
    adjusted_duration_minutes: 0,
  })

  const loadUserTeams = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()

      if (response.ok && result.teams) {
        setUserTeams(result.teams)
        // Set default team_id if not set and we have teams
        if (!formData.team_id && result.teams.length > 0) {
          setFormData(prev => ({ ...prev, team_id: result.teams[0].id }))
        }
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
    }
  }, [formData.team_id])

  const loadRequests = useCallback(async () => {
    const selectedTeamId = formData.team_id || teamId
    if (!selectedTeamId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: requestData } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', userId)
        .eq('team_id', selectedTeamId)
        .order('created_at', { ascending: false })

      if (requestData) {
        setRequests(requestData)
      }
    } catch (error) {
      console.error('Failed to load requests:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, teamId, formData.team_id])

  const loadBreaks = useCallback(async (startDate: string, endDate: string) => {
    const selectedTeamId = formData.team_id || teamId
    if (!selectedTeamId || !userId) return

    setLoadingBreaks(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `/api/breaks?user_id=${userId}&team_id=${selectedTeamId}&start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      const result = await response.json()
      if (response.ok && result.breaks) {
        setAvailableBreaks(result.breaks)
      }
    } catch (error) {
      console.error('Failed to load breaks:', error)
    } finally {
      setLoadingBreaks(false)
    }
  }, [userId, teamId, formData.team_id])

  useEffect(() => {
    loadUserTeams()
  }, [loadUserTeams])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  // Load breaks when date range changes and request type is break adjustment
  useEffect(() => {
    const requestTypeUpper = formData.request_type.toUpperCase()
    if (requestTypeUpper.includes('BREAK') && requestTypeUpper.includes('ADJUSTMENT')) {
      loadBreaks(formData.requested_date_from, formData.requested_date_to)
    } else {
      setAvailableBreaks([])
    }
  }, [formData.request_type, formData.requested_date_from, formData.requested_date_to, loadBreaks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedTeamId = formData.team_id || teamId
    if (!selectedTeamId) {
      alert('Please select a team/client for this request')
      return
    }

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const requestTypeUpper = formData.request_type.toUpperCase()
      const isForgotBreak = requestTypeUpper.includes('FORGOT') && (requestTypeUpper.includes('BREAK') || requestTypeUpper.includes('LUNCH'))
      const isBreakAdjustment = requestTypeUpper.includes('BREAK') && requestTypeUpper.includes('ADJUSTMENT')

      // Build requested_data based on request type
      let requestedData: any = {}
      
      if (isForgotBreak) {
        requestedData = {
          date: formData.requested_date_from,
          time_from: formData.requested_time_from,
          time_to: formData.requested_time_to,
          break_type: formData.break_type,
        }
      } else if (isBreakAdjustment) {
        requestedData = {
          break_segment_id: formData.break_segment_id,
          current_duration_minutes: formData.current_duration_minutes,
          adjusted_duration_minutes: formData.adjusted_duration_minutes,
        }
      } else {
        requestedData = {
          date_from: formData.requested_date_from,
          date_to: formData.requested_date_to,
          time_from: formData.requested_time_from || null,
          time_to: formData.requested_time_to || null,
        }
      }

      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          team_id: selectedTeamId,
          request_type: formData.request_type,
          description: formData.description,
          requested_data: requestedData,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setShowForm(false)
        setFormData({ 
          team_id: selectedTeamId,
          request_type: '', 
          description: '',
          requested_date_from: new Date().toISOString().split('T')[0],
          requested_date_to: new Date().toISOString().split('T')[0],
          requested_time_from: '',
          requested_time_to: '',
          break_type: 'BREAK',
          break_segment_id: '',
          current_duration_minutes: 0,
          adjusted_duration_minutes: 0,
        })
        loadRequests()
      } else {
        alert(result.error || 'Failed to create request')
      }
    } catch (error) {
      alert('Failed to create request')
    }
  }

  const handleOpenRequest = (requestId: string) => {
    setSelectedRequestId(requestId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedRequestId(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading requests...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            My Requests
          </h3>
          <p className="text-sm font-bold text-slate-400 mt-1 flex items-center">
            <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
            Submit and track your time correction requests
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center px-6 py-3 rounded-2xl font-black transition-all shadow-lg transform active:scale-95 ${
            showForm 
            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
          }`}
        >
          {showForm ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Request
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <h4 className="text-lg font-black text-slate-900 mb-6">Create New Request</h4>
          <form onSubmit={handleSubmit} className="space-y-6">
            {userTeams.length > 1 && (
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Team / Client <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                >
                  <option value="">Select a team/client...</option>
                  {userTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1 ml-1">
                  Select which team/client this request is for
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Request Type
                </label>
                <select
                  required
                  value={formData.request_type}
                  onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
                  className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                >
                  <option value="">Select a type...</option>
                  <optgroup label="Time Corrections">
                    <option value="Time Correction">Time Correction</option>
                    <option value="Missing Clock In">Missing Clock In</option>
                    <option value="Missing Clock Out">Missing Clock Out</option>
                    <option value="Break Duration Adjustment">Break Duration Adjustment</option>
                  </optgroup>
                  <optgroup label="Break & Lunch">
                    <option value="Forgot to Log Break">Forgot to Log Break</option>
                    <option value="Forgot to Log Lunch">Forgot to Log Lunch</option>
                  </optgroup>
                  <optgroup label="Time Off & Leave">
                    <option value="PTO">PTO</option>
                    <option value="Medical Leave">Medical Leave</option>
                    <option value="Vacation">Vacation</option>
                    <option value="Personal Day">Personal Day</option>
                    <option value="Holiday">Holiday</option>
                  </optgroup>
                  <optgroup label="Work Arrangements">
                    <option value="Work From Home">Work From Home</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="Training">Training</option>
                    <option value="Other">Other</option>
                  </optgroup>
                </select>
              </div>
            </div>
            {/* Conditional fields based on request type */}
            {(() => {
              const requestTypeUpper = formData.request_type.toUpperCase()
              const isForgotBreak = requestTypeUpper.includes('FORGOT') && (requestTypeUpper.includes('BREAK') || requestTypeUpper.includes('LUNCH'))
              const isBreakAdjustment = requestTypeUpper.includes('BREAK') && requestTypeUpper.includes('ADJUSTMENT')

              // Forgot to Log Break/Lunch
              if (isForgotBreak) {
                return (
                  <>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.requested_date_from}
                        onChange={(e) => setFormData({ ...formData, requested_date_from: e.target.value, requested_date_to: e.target.value })}
                        className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Break Start Time <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.requested_time_from}
                          onChange={(e) => setFormData({ ...formData, requested_time_from: e.target.value })}
                          className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          Break End Time <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.requested_time_to}
                          onChange={(e) => setFormData({ ...formData, requested_time_to: e.target.value })}
                          className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        Break Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.break_type}
                        onChange={(e) => setFormData({ ...formData, break_type: e.target.value as 'BREAK' | 'LUNCH' })}
                        className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                      >
                        <option value="BREAK">Break</option>
                        <option value="LUNCH">Lunch</option>
                      </select>
                    </div>
                  </>
                )
              }

              // Break Duration Adjustment
              if (isBreakAdjustment) {
                const selectedBreak = availableBreaks.find(b => b.id === formData.break_segment_id)
                const difference = selectedBreak 
                  ? Math.abs(formData.current_duration_minutes - formData.adjusted_duration_minutes)
                  : 0

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          From Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.requested_date_from}
                          onChange={(e) => {
                            setFormData({ ...formData, requested_date_from: e.target.value })
                            loadBreaks(e.target.value, formData.requested_date_to)
                          }}
                          className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                          To Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.requested_date_to}
                          onChange={(e) => {
                            setFormData({ ...formData, requested_date_to: e.target.value })
                            loadBreaks(formData.requested_date_from, e.target.value)
                          }}
                          min={formData.requested_date_from}
                          className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        Select Break <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.break_segment_id}
                        onChange={(e) => {
                          const breakId = e.target.value
                          const selected = availableBreaks.find(b => b.id === breakId)
                          setFormData({
                            ...formData,
                            break_segment_id: breakId,
                            current_duration_minutes: selected?.duration_minutes || 0,
                            adjusted_duration_minutes: selected?.duration_minutes || 0,
                          })
                        }}
                        disabled={loadingBreaks || availableBreaks.length === 0}
                        className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="">
                          {loadingBreaks ? 'Loading breaks...' : availableBreaks.length === 0 ? 'No breaks found in date range' : 'Select a break...'}
                        </option>
                        {availableBreaks.map((breakSeg) => (
                          <option key={breakSeg.id} value={breakSeg.id}>
                            {breakSeg.break_type} - {new Date(breakSeg.break_start_at).toLocaleDateString()} {new Date(breakSeg.break_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to {new Date(breakSeg.break_end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({Math.floor(breakSeg.duration_minutes / 60)}h {breakSeg.duration_minutes % 60}m)
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedBreak && (
                      <>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                          <p className="text-sm font-bold text-indigo-900 mb-2">Current Break Duration:</p>
                          <p className="text-lg font-black text-indigo-700">
                            {Math.floor(formData.current_duration_minutes / 60)}h {formData.current_duration_minutes % 60}m
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                            Adjusted Duration (hours:minutes) <span className="text-rose-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              placeholder="Hours"
                              value={Math.floor(formData.adjusted_duration_minutes / 60)}
                              onChange={(e) => {
                                const hours = parseInt(e.target.value) || 0
                                const minutes = formData.adjusted_duration_minutes % 60
                                setFormData({ ...formData, adjusted_duration_minutes: hours * 60 + minutes })
                              }}
                              className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                            />
                            <input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="Minutes"
                              value={formData.adjusted_duration_minutes % 60}
                              onChange={(e) => {
                                const minutes = parseInt(e.target.value) || 0
                                const hours = Math.floor(formData.adjusted_duration_minutes / 60)
                                setFormData({ ...formData, adjusted_duration_minutes: hours * 60 + minutes })
                              }}
                              className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                            />
                          </div>
                        </div>
                        {difference > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <p className="text-sm font-bold text-amber-900">
                              Adjustment: {formData.current_duration_minutes > formData.adjusted_duration_minutes ? '-' : '+'}{Math.floor(difference / 60)}h {difference % 60}m
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )
              }

              // Default fields for other request types
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        From Date
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.requested_date_from}
                        onChange={(e) => setFormData({ ...formData, requested_date_from: e.target.value })}
                        className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        To Date
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.requested_date_to}
                        onChange={(e) => setFormData({ ...formData, requested_date_to: e.target.value })}
                        min={formData.requested_date_from}
                        className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        From Time <span className="text-slate-300 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="time"
                        value={formData.requested_time_from}
                        onChange={(e) => setFormData({ ...formData, requested_time_from: e.target.value })}
                        className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                        placeholder="Leave empty for full day"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        To Time <span className="text-slate-300 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="time"
                        value={formData.requested_time_to}
                        onChange={(e) => setFormData({ ...formData, requested_time_to: e.target.value })}
                        className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700"
                        placeholder="Leave empty for full day"
                      />
                    </div>
                  </div>
                </>
              )
            })()}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Description
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Please describe the correction needed (e.g., forgot to clock out at 5:00 PM, should have been 5:15 PM)"
                rows={4}
                className="w-full px-5 py-4 bg-white border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
              />
            </div>
            <button
              type="submit"
              className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all transform active:scale-95"
            >
              SUBMIT REQUEST
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {requests.length === 0 ? (
          <div className="py-20 text-center bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-slate-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-400 font-bold text-xl tracking-tight">No requests yet</p>
            <p className="text-slate-300 text-sm mt-2">When you submit a time correction, it will appear here.</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300 group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      request.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                      request.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                        request.status === 'APPROVED' ? 'bg-emerald-500' :
                        request.status === 'REJECTED' ? 'bg-rose-500' :
                        'bg-amber-500 animate-pulse'
                      }`}></span>
                      {request.status}
                    </span>
                    <span className="text-xs font-black text-slate-300 uppercase tracking-widest">
                      {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{request.request_type}</h4>
                  
                  {request.requested_data && (typeof request.requested_data === 'object') && (request.requested_data.date_from || request.requested_data.date_to || request.requested_data.date || request.requested_data.time_from || request.requested_data.time_to || request.requested_data.time) && (
                    <div className="flex flex-wrap items-center gap-3 mt-2 mb-3">
                      {(request.requested_data.date_from || request.requested_data.date_to || request.requested_data.date) && (
                        <div className="flex items-center text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {request.requested_data.date_from && request.requested_data.date_to
                            ? (() => {
                                const fromDate = new Date(request.requested_data.date_from + 'T00:00:00')
                                const toDate = new Date(request.requested_data.date_to + 'T00:00:00')
                                const fromStr = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: fromDate.getFullYear() !== toDate.getFullYear() ? 'numeric' : undefined })
                                const toStr = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                return fromDate.getTime() === toDate.getTime() ? fromStr : `${fromStr} - ${toStr}`
                              })()
                            : request.requested_data.date
                            ? new Date(request.requested_data.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : request.requested_data.date_from
                            ? new Date(request.requested_data.date_from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : request.requested_data.date_to
                            ? new Date(request.requested_data.date_to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : null
                          }
                        </div>
                      )}
                      {(request.requested_data.time_from || request.requested_data.time_to || request.requested_data.time) && (
                        <div className="flex items-center text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50/50 px-3 py-1.5 rounded-xl border border-amber-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {request.requested_data.time_from && request.requested_data.time_to 
                            ? `${request.requested_data.time_from} - ${request.requested_data.time_to}`
                            : request.requested_data.time || (request.requested_data.time_from || request.requested_data.time_to)
                          }
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-sm font-bold text-slate-500 mt-1 leading-relaxed line-clamp-2">{request.description}</p>
                  
                  {request.review_notes && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Admin Feedback</p>
                      <p className="text-sm font-bold text-slate-600 italic">"{request.review_notes}"</p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => handleOpenRequest(request.id)}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 text-xs font-black rounded-xl hover:bg-indigo-100 border border-indigo-200 transition-all transform active:scale-95 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    OPEN
                  </button>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Submitted</span>
                    <span className="text-sm font-bold text-slate-400 block">
                      {new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <RequestDetailModal
        requestId={selectedRequestId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRequestUpdated={loadRequests}
      />
    </div>
  )
}

