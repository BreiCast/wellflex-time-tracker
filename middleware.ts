import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isDesktopRequest, sanitizeUserAgentForLogs } from '@/lib/security/access-guards'

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl
    if (pathname.startsWith('/access-denied')) {
      return NextResponse.next()
    }

    const userAgent = request.headers.get('user-agent')
    if (!isDesktopRequest(userAgent)) {
      const uaSnippet = sanitizeUserAgentForLogs(userAgent)
      console.warn(`[ACCESS] Blocked non-desktop request path=${pathname} ua="${uaSnippet}"`)

      const acceptsHtml = request.headers.get('accept')?.includes('text/html')
      if (!acceptsHtml) {
        return NextResponse.json({ error: 'Desktop access only' }, { status: 403 })
      }

      const blockedUrl = request.nextUrl.clone()
      blockedUrl.pathname = '/access-denied'
      blockedUrl.searchParams.set('reason', 'device')
      return NextResponse.redirect(blockedUrl)
    }

    // Check if environment variables are set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.next()
    }

    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    })

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              request.cookies.set({
                name,
                value,
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value,
                ...options,
              })
            } catch (error) {
              // Ignore cookie errors in middleware
              console.error('Error setting cookie in middleware:', error)
            }
          },
          remove(name: string, options: any) {
            try {
              request.cookies.set({
                name,
                value: '',
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value: '',
                ...options,
              })
            } catch (error) {
              // Ignore cookie errors in middleware
              console.error('Error removing cookie in middleware:', error)
            }
          },
        },
      }
    )

    // Refresh user session if needed (with timeout to prevent hanging)
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      )
      await Promise.race([supabase.auth.getUser(), timeoutPromise])
    } catch (error) {
      // If auth check fails or times out, just continue - don't block the request
      // This is expected for unauthenticated requests
    }

    return response
  } catch (error) {
    // If middleware fails completely, return a response to prevent 500 error
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

