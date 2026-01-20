'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Check if admin
      const { data: adminCheck } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('role', 'ADMIN')
        .limit(1)
        .maybeSingle()

      if (!adminCheck) {
        router.push('/dashboard')
        return
      }

      setUser(session.user)

      // Load settings
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      const data = await response.json()
      setSettings(data.settings)
      alert('Settings saved successfully!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Failed to load settings</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <DashboardNav
        activeTab="settings"
        onTabChange={() => {}}
        userEmail={user?.email}
        userRole="ADMIN"
        onLogout={handleLogout}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Organization Settings</h1>
          <p className="text-slate-500 font-bold text-sm">Configure thresholds and reminder timing</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <p className="text-red-700 font-bold">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Missed Punch Threshold (hours)
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={settings.missed_punch_threshold_hours}
              onChange={(e) => setSettings({ ...settings, missed_punch_threshold_hours: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Sessions running longer than this will be flagged</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Clock In Reminder Window (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="120"
              value={settings.clock_in_reminder_window_minutes}
              onChange={(e) => setSettings({ ...settings, clock_in_reminder_window_minutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Send reminder within this window after scheduled start</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Clock Out Reminder Before (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="120"
              value={settings.clock_out_reminder_before_minutes}
              onChange={(e) => setSettings({ ...settings, clock_out_reminder_before_minutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Send reminder this many minutes before scheduled end</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Clock Out Reminder After (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="120"
              value={settings.clock_out_reminder_after_minutes}
              onChange={(e) => setSettings({ ...settings, clock_out_reminder_after_minutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Send reminder if still running this many minutes after scheduled end</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Break Return Threshold (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="240"
              value={settings.break_return_threshold_minutes}
              onChange={(e) => setSettings({ ...settings, break_return_threshold_minutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Send reminder if break exceeds this duration</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Reminder Cooldown (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="240"
              value={settings.reminder_cooldown_minutes}
              onChange={(e) => setSettings({ ...settings, reminder_cooldown_minutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">Minimum time between reminders of the same type</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Quiet Hours Start
              </label>
              <input
                type="time"
                value={settings.quiet_hours_start}
                onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Quiet Hours End
              </label>
              <input
                type="time"
                value={settings.quiet_hours_end}
                onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
