'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui'

export const dynamic = 'force-dynamic'

function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center mb-10">
      <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
        <Image
          src="/wellflex_logo.jpg"
          alt="wetrack logo"
          width={96}
          height={96}
          className="w-full h-full object-contain rounded-2xl"
        />
      </div>
      <h1 className="text-4xl font-black text-slate-900 tracking-tighter font-wetrack">wetrack</h1>
      <p className="mt-2 text-slate-500 font-bold uppercase tracking-widest text-xs">{subtitle}</p>
    </div>
  )
}

function ConfirmEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const confirmEmail = async () => {
      const supabase = createClient()
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (!token_hash || !type) {
        setStatus('error')
        setError('Invalid confirmation link')
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
        }

        setStatus('success')
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } catch (err: any) {
        setStatus('error')
        setError(err.message || 'Failed to confirm email')
      }
    }

    confirmEmail()
  }, [router, searchParams])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
        <div className="max-w-md w-full">
          <BrandHeader subtitle="Verifying" />
          <Card className="p-10 text-center">
            <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-slate-500 font-bold">Confirming your email…</p>
          </Card>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
        <div className="max-w-md w-full">
          <BrandHeader subtitle="Error" />
          <Card className="p-10 text-center">
            <div className="w-20 h-20 bg-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-200">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Confirmation Failed</h2>
            <p className="text-slate-400 font-bold text-sm mb-10">{error}</p>
            <Link
              href="/login"
              className="block w-full py-4 px-6 bg-primary-600 text-white text-lg font-black rounded-control hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
            >
              BACK TO LOGIN
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="max-w-md w-full">
        <BrandHeader subtitle="Welcome" />
        <Card className="p-10 text-center">
          <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
            <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Email Confirmed!</h2>
          <p className="text-slate-400 font-bold text-sm">
            Your email is verified. Redirecting you to your dashboard…
          </p>
        </Card>
      </div>
    </div>
  )
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-canvas">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ConfirmEmailContent />
    </Suspense>
  )
}
