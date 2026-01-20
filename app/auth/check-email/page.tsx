'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function CheckEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState('')

  const handleResend = async () => {
    if (!email) return

    setResending(true)
    setResendError('')
    setResendSuccess(false)

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend email')
      }

      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err: any) {
      setResendError(err.message || 'Failed to resend confirmation email')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">wetrack</h1>
          <p className="mt-2 text-slate-500 font-bold uppercase tracking-widest text-xs">Verify Email</p>
        </div>

        <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] rounded-[3rem] p-10 border border-slate-100 text-center">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900">Check your email</h2>
            <p className="text-slate-400 font-bold text-sm mt-1">We&apos;ve sent a confirmation link to:</p>
            <p className="mt-2 text-indigo-600 font-black truncate px-2">{email}</p>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 text-left">
            <div className="flex">
              <svg className="h-5 w-5 text-indigo-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                Click the link in the email to confirm your account and complete signup. The link will expire in 24 hours.
              </p>
            </div>
          </div>

          {resendSuccess && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 px-4 py-3 rounded-xl mb-6 flex items-center animate-in fade-in slide-in-from-top-2 duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest">Confirmation email sent!</span>
            </div>
          )}

          {resendError && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center animate-in fade-in slide-in-from-top-2 duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-bold">{resendError}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleResend}
              disabled={resending || !email}
              className="w-full py-4 px-6 bg-indigo-600 text-white text-lg font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              {resending ? 'SENDING...' : 'RESEND EMAIL'}
            </button>
            
            <p className="text-xs font-bold text-slate-400">
              Didn&apos;t receive it? Check your spam or{' '}
              <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 underline decoration-2 underline-offset-4 font-black">
                try another email
              </Link>
            </p>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50">
            <Link href="/login" className="text-sm font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
              Back to sign in
            </Link>
          </div>
        </div>
        
        <p className="mt-10 text-center text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">
          &copy; 2026 wetrack. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CheckEmailContent />
    </Suspense>
  )
}

