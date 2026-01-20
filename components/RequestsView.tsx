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
    requested_date_from: new Date().toISOString().split('T')[0],
    requested_date_to: new Date().toISOString().split('T')[0],
    requested_time_from: '',
    requested_time_to: '',
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
          requested_data: {
            date_from: formData.requested_date_from,
            date_to: formData.requested_date_to,
            time_from: formData.requested_time_from || null,
            time_to: formData.requested_time_to || null,
          },
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setShowForm(false)
        setFormData({ 
          request_type: '', 
          description: '',
          requested_date_from: new Date().toISOString().split('T')[0],
          requested_date_to: new Date().toISOString().split('T')[0],
          requested_time_from: '',
          requested_time_to: '',
        })
        loadRequests()
      } else {
        alert(result.error || 'Failed to create request')
      }
    } catch (error) {
      alert('Failed to create request')
    }
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
                    <option value="Break Adjustment">Break Adjustment</option>
                  </optgroup>
                  <optgroup label="Time Off & Leave">
                    <option value="PTO">PTO</option>
                    <option value="Medical Leave">Medical Leave</option>
                    <option value="Vacation">Vacation</option>
                    <option value="Personal Day">Personal Day</option>
                    <option value="Holiday">Holiday</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="Training">Training</option>
                    <option value="Other">Other</option>
                  </optgroup>
                </select>
              </div>
            </div>
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

                  <p className="text-sm font-bold text-slate-500 mt-1 leading-relaxed">{request.description}</p>
                  
                  {request.review_notes && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Admin Feedback</p>
                      <p className="text-sm font-bold text-slate-600 italic">“{request.review_notes}”</p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end text-right">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Submitted</span>
                  <span className="text-sm font-bold text-slate-400">
                    {new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

