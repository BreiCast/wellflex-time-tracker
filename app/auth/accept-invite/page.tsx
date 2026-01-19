'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const acceptInvite = async () => {
      const supabase = createClient()
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (!token_hash || !type) {
        setStatus('error')
        setError('Invalid invite link')
        return
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          type: type as any,
          token_hash,
        })

        if (error) {
          setStatus('error')
          setError(error.message)
          return
        }

        // Get the user after verification
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // Create user record if it doesn't exist
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()

          if (!existingUser) {
            await supabase.from('users').insert({
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || null,
            })
          }

          // Add user to team if metadata exists
          if (user.user_metadata?.team_id && user.user_metadata?.role) {
            const { error: memberError } = await supabase
              .from('team_members')
              .insert({
                team_id: user.user_metadata.team_id,
                user_id: user.id,
                role: user.user_metadata.role,
              })

            if (memberError && !memberError.message.includes('duplicate')) {
              console.error('Error adding to team:', memberError)
            }
          }
        }

        setStatus('success')
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } catch (err: any) {
        setStatus('error')
        setError(err.message || 'Failed to accept invite')
      }
    }

    acceptInvite()
  }, [router, searchParams])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Accepting invite...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Invite Failed</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </div>
          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Go to login
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Invite Accepted!</h2>
          <p className="mt-2 text-sm text-gray-600">
            You&apos;ve been added to the team. Redirecting to dashboard...
          </p>
        </div>
      </div>
    </div>
  )
}

