import Link from 'next/link'

interface AccessDeniedPageProps {
  searchParams?: {
    reason?: string
  }
}

export default function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const reason = searchParams?.reason
  const isDeviceBlock = reason === 'device'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] p-10 text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
        </div>

        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Access Restricted</h1>
        <p className="text-slate-600 font-medium">
          {isDeviceBlock
            ? 'Desktop access is required to use this platform. Please sign in from a desktop or laptop browser.'
            : 'You do not currently have access to this page.'}
        </p>

        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
