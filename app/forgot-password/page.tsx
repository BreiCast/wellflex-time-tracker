'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
      })

      if (error) throw error

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <img 
              src="/wellflex_logo.jpg" 
              alt="Wellflex Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to SVG if image not found
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const fallback = target.nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-200 hidden">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">WELLFLEX</h1>
          <p className="mt-2 text-slate-500 font-bold uppercase tracking-widest text-xs">Time Tracker</p>
        </div>

        <div className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] rounded-[3rem] p-10 border border-slate-100">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900">Reset Password</h2>
            <p className="text-slate-400 font-bold text-sm mt-1">We&apos;ll send a secure link to your email.</p>
          </div>

          <form className="space-y-6" onSubmit={handleResetPassword}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-xl flex items-center animate-in fade-in slide-in-from-top-2 duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 px-4 py-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold uppercase tracking-widest">Email Sent!</span>
                </div>
                <p className="text-xs font-bold mt-2 ml-8 text-emerald-600/80">
                  Check your inbox for a link to reset your password. If it doesn&apos;t appear, check your spam.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={success}
                placeholder="name@company.com"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300 disabled:opacity-50"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || success}
                className="w-full flex justify-center py-4 px-6 bg-indigo-600 text-white text-lg font-black rounded-2xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:grayscale"
              >
                {loading ? 'SENDING...' : success ? 'LINK SENT' : 'SEND RESET LINK'}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50">
            <div className="text-center">
              <Link href="/login" className="text-sm font-black text-indigo-600 hover:text-indigo-700 transition-colors">
                <span className="underline decoration-2 underline-offset-4">Back to sign in</span>
              </Link>
            </div>
          </div>
        </div>
        
        <p className="mt-10 text-center text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">
          &copy; 2026 Wellflex Inc. All rights reserved.
        </p>
      </div>
    </div>
  )
}

