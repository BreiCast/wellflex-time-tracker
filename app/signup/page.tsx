'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate full name
    if (!fullName.trim()) {
      setError('Full name is required')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) throw error

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // Show success message instead of error
        setError('')
        // Redirect to a confirmation page
        router.push(`/auth/check-email?email=${encodeURIComponent(email)}`)
        return
      }

      // If session exists (shouldn't happen with email confirmation enabled)
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      // Handle duplicate email errors
      let errorMessage = err.message || 'Failed to sign up'
      let isDuplicate = false
      
      if (
        errorMessage.toLowerCase().includes('already registered') ||
        errorMessage.toLowerCase().includes('user already exists') ||
        errorMessage.toLowerCase().includes('email address is already') ||
        errorMessage.toLowerCase().includes('already exists') ||
        err.code === 'user_already_exists'
      ) {
        isDuplicate = true
        errorMessage = 'An account with this email address already exists.'
      }
      
      setError(errorMessage)
      setIsDuplicateEmail(isDuplicate)
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
              className="w-full h-full object-contain rounded-2xl"
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
            <h2 className="text-2xl font-black text-slate-900">Create Account</h2>
            <p className="text-slate-400 font-bold text-sm mt-1">Start tracking your time with Wellflex.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSignup}>
            {error && (
              <div className={`${isDuplicateEmail ? 'bg-blue-50 border-l-4 border-blue-500 text-blue-800' : 'bg-red-50 border-l-4 border-red-500 text-red-700'} px-4 py-3 rounded-xl flex flex-col animate-in fade-in slide-in-from-top-2 duration-300`}>
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold">{error}</span>
                </div>
                {isDuplicateEmail && (
                  <div className="mt-3 ml-8 space-y-2">
                    <p className="text-xs text-blue-700 font-medium">
                      You can either:
                    </p>
                    <div className="flex flex-col space-y-1">
                      <Link
                        href="/login"
                        className="text-xs font-black text-blue-600 hover:text-blue-500 underline decoration-2 underline-offset-4"
                      >
                        Sign in to your existing account
                      </Link>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-black text-blue-600 hover:text-blue-500 underline decoration-2 underline-offset-4"
                      >
                        Reset your password
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  minLength={1}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                />
              </div>
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
                  placeholder="name@company.com"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 transition-all font-bold text-slate-700 placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Password
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
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-6 bg-indigo-600 text-white text-lg font-black rounded-2xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:grayscale"
              >
                {loading ? (
                  <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'CREATE ACCOUNT'}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50">
            <div className="text-center">
              <Link href="/login" className="text-sm font-black text-indigo-600 hover:text-indigo-700 transition-colors">
                Already have an account? <span className="underline decoration-2 underline-offset-4">Sign in</span>
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

