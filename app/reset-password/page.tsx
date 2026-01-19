'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if we have the required tokens in the URL
    const token_hash = searchParams.get('token_hash')
    const token = searchParams.get('token')
    const type = searchParams.get('type')

    // Accept either token_hash (OTP flow) or token (PKCE/magic link flow)
    if (!token_hash && !token) {
      setError('Invalid or missing reset token. Please request a new password reset.')
    }
  }, [searchParams])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const token_hash = searchParams.get('token_hash')
      const token = searchParams.get('token')
      const type = searchParams.get('type')

      // Handle different token formats from Supabase
      if (type === 'recovery' && token_hash) {
        // Verify the OTP token first
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash,
        })

        if (verifyError) {
          throw verifyError
        }
      } else if (token) {
        // Alternative flow: exchange code for session (PKCE/magic link)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(token)
        if (exchangeError) {
          throw exchangeError
        }
      } else {
        throw new Error('Invalid or missing reset token')
      }

      // Update the password (user should now be authenticated)
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to reset password'
      
      // Provide more helpful error messages
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        errorMessage = 'This password reset link is invalid or has expired. Please request a new one.'
      } else if (errorMessage.includes('same password')) {
        errorMessage = 'New password must be different from your current password.'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const token_hash = searchParams.get('token_hash')
  const token = searchParams.get('token')
  const type = searchParams.get('type')

  // Show error if we don't have any valid token
  if (!token_hash && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <div className="max-w-md w-full">
          {/* Logo/Header */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">WELLFLEX</h1>
            <p className="mt-2 text-slate-500 font-bold uppercase tracking-widest text-xs">Error</p>
          </div>

          <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] rounded-[3rem] p-10 border border-slate-100 text-center">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Invalid Reset Link</h2>
            <p className="text-slate-400 font-bold text-sm mb-10">This password reset link is invalid or has expired.</p>
            
            <div className="space-y-4">
              <Link
                href="/forgot-password"
                className="block w-full py-4 px-6 bg-indigo-600 text-white text-lg font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform active:scale-95"
              >
                REQUEST NEW LINK
              </Link>
              <Link
                href="/login"
                className="block w-full py-4 px-6 bg-slate-100 text-slate-600 text-lg font-black rounded-2xl hover:bg-slate-200 transition-all"
              >
                BACK TO LOGIN
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase tracking-widest text-xs">Wellflex</h1>
          </div>

          <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] rounded-[3rem] p-10 border border-slate-100 text-center">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Password Updated!</h2>
            <p className="text-slate-400 font-bold text-sm">Your account is now secure. Redirecting you to login...</p>
            <div className="mt-8">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">WELLFLEX</h1>
          <p className="mt-2 text-slate-500 font-bold uppercase tracking-widest text-xs">Security</p>
        </div>

        <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] rounded-[3rem] p-10 border border-slate-100">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900">Set New Password</h2>
            <p className="text-slate-400 font-bold text-sm mt-1">Please choose a strong password.</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-xl flex items-center animate-in fade-in slide-in-from-top-2 duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-6 bg-indigo-600 text-white text-lg font-black rounded-2xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:grayscale"
              >
                {loading ? 'RESETTING...' : 'RESET PASSWORD'}
              </button>
            </div>
            <div className="text-center">
              <Link href="/login" className="text-sm font-black text-indigo-600 hover:text-indigo-700 transition-colors">
                <span className="underline decoration-2 underline-offset-4">Back to login</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

