'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface DashboardNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  userEmail?: string
  userRole?: string
  onLogout: () => void
}

export default function DashboardNav({ activeTab, onTabChange, userEmail, userRole, onLogout }: DashboardNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const currentTab = pathname === '/tracking' ? 'tracking' : activeTab

  const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SUPERADMIN'

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 sticky top-0 z-50 shadow-lg shadow-slate-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Logo + Primary Nav (Bold Segmented) */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-white/10 group-hover:bg-white/20 transition-colors">
                <Image 
                  src="/wellflex_logo.jpg" 
                  alt="wetrack logo" 
                  width={28} 
                  height={28}
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:to-purple-300 transition-all font-wetrack">
                wetrack
              </span>
            </Link>
            
            {/* Primary Nav: Bold Segmented Control */}
            <div className="hidden md:flex items-center bg-white/10 backdrop-blur-sm p-1.5 rounded-xl border border-white/10">
              <button
                onClick={() => router.push('/tracking')}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  currentTab === 'tracking'
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/50 transform scale-105'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                aria-current={currentTab === 'tracking' ? 'page' : undefined}
              >
                Time Tracking
              </button>
              <button
                onClick={() => router.push('/dashboard?tab=timesheet')}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  currentTab === 'timesheet'
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/50 transform scale-105'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                aria-current={currentTab === 'timesheet' ? 'page' : undefined}
              >
                Timesheet
              </button>
            </div>
          </div>
          
          {/* Center: Secondary Nav (Accent Text) */}
          <div className="hidden lg:flex items-center gap-6 text-sm font-semibold">
            <button
              onClick={() => router.push('/dashboard?tab=requests')}
              className={`transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-md px-2 py-1 ${
                currentTab === 'requests'
                  ? 'text-indigo-400 font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
              aria-current={currentTab === 'requests' ? 'page' : undefined}
            >
              My Requests
            </button>
            <span className="text-white/20" aria-hidden="true">•</span>
            <button
              onClick={() => router.push('/teams')}
              className={`transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-md px-2 py-1 ${
                currentTab === 'teams'
                  ? 'text-indigo-400 font-bold'
                  : 'text-white/60 hover:text-white'
              }`}
              aria-current={currentTab === 'teams' ? 'page' : undefined}
            >
              Teams
            </button>
          </div>
          
          {/* Right: User + Admin + Logout */}
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-sm font-medium text-white/70">
              {userEmail}
            </span>
            
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900 border border-amber-400/30 hover:border-amber-400/50"
                aria-label="Admin panel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            
            <button
              onClick={onLogout}
              className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              title="Logout"
              aria-label="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className="md:hidden border-t border-white/10 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 p-3 overflow-x-auto scrollbar-hide">
          {/* Primary: Bold Segmented */}
          <div className="flex items-center bg-white/10 p-1 rounded-lg flex-shrink-0 border border-white/10">
            <button
              onClick={() => router.push('/tracking')}
              className={`px-4 py-2.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                currentTab === 'tracking'
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                  : 'text-white/70'
              }`}
            >
              Tracking
            </button>
            <button
              onClick={() => router.push('/dashboard?tab=timesheet')}
              className={`px-4 py-2.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                currentTab === 'timesheet'
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                  : 'text-white/70'
              }`}
            >
              Timesheet
            </button>
          </div>
          {/* Secondary */}
          <button
            onClick={() => router.push('/dashboard?tab=requests')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              currentTab === 'requests'
                ? 'text-indigo-400 bg-indigo-500/10'
                : 'text-white/60'
            }`}
          >
            Requests
          </button>
          <button
            onClick={() => router.push('/teams')}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              currentTab === 'teams'
                ? 'text-indigo-400 bg-indigo-500/10'
                : 'text-white/60'
            }`}
          >
            Teams
          </button>
        </div>
      </div>
    </nav>
  )
}
