'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardNav from '@/components/DashboardNav'
import { Card, Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'

export const dynamic = 'force-dynamic'

export default function ProfilePage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [initialName, setInitialName] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const user = session.user
      setUserId(user.id)
      setEmail(user.email || '')
      const name = (user.user_metadata?.full_name as string) || ''
      setFullName(name)
      setInitialName(name)
      setLoading(false)
    }
    load()
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = fullName.trim()
    if (!trimmed) {
      toast.error('Name cannot be empty')
      return
    }
    if (!userId) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ full_name: trimmed }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to update name')

      setInitialName(trimmed)
      toast.success('Profile updated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const dirty = fullName.trim() !== initialName.trim()

  return (
    <div className="min-h-screen bg-canvas">
      <DashboardNav
        activeTab=""
        onTabChange={(tab) => {
          if (tab === 'tracking') router.push('/tracking')
          else router.push(`/dashboard?tab=${tab}`)
        }}
        userEmail={email}
        userName={fullName || undefined}
        onLogout={handleLogout}
      />

      <main className="max-w-2xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Profile</h1>
          <p className="text-slate-500 font-bold text-sm mt-1">Manage your account details.</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label htmlFor="fullName" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                required
                maxLength={255}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-control focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white focus:border-primary-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                readOnly
                className="w-full px-5 py-4 bg-slate-100 border-2 border-transparent rounded-control font-bold text-slate-400 cursor-not-allowed"
              />
              <p className="text-xs font-bold text-slate-400 mt-2 ml-1">Your email address can&apos;t be changed here.</p>
            </div>

            <div className="pt-2">
              <Button type="submit" loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  )
}
