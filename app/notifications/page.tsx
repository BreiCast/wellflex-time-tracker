'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Load notifications
      const response = await fetch('/api/notifications/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const formatNotificationType = (type: string) => {
    switch (type) {
      case 'CLOCK_IN_REMINDER':
        return '⏰ Clock In Reminder'
      case 'CLOCK_OUT_REMINDER':
        return '⏰ Clock Out Reminder'
      case 'BREAK_RETURN_REMINDER':
        return '⏰ Break Return Reminder'
      case 'MISSED_PUNCH_REMINDER':
        return '⚠️ Missed Punch Reminder'
      default:
        return type
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
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

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <DashboardNav
        activeTab="notifications"
        onTabChange={() => {}}
        userEmail={user?.email}
        userRole="MEMBER"
        onLogout={handleLogout}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Notifications</h1>
          <p className="text-slate-500 font-bold text-sm">View your recent reminder notifications</p>
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-slate-400 font-bold">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl p-6 border-2 ${
                  notification.status === 'SENT'
                    ? 'border-emerald-100 bg-emerald-50/30'
                    : notification.status === 'FAILED'
                    ? 'border-red-100 bg-red-50/30'
                    : 'border-slate-100'
                } shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-bold text-slate-900">
                        {formatNotificationType(notification.notification_type)}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          notification.status === 'SENT'
                            ? 'bg-emerald-100 text-emerald-700'
                            : notification.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {notification.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mb-2">
                      {formatDate(notification.created_at)}
                    </p>
                    {notification.error_message && (
                      <p className="text-sm text-red-600 font-bold mt-2">
                        Error: {notification.error_message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
