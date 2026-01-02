import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "./lib/auth"
import { rateLimiter } from "./lib/rate-limiter"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate Limiting for Auth Endpoints
  if (pathname.startsWith('/api/auth/')) {
    const result = rateLimiter.check(request) // 10 requests per minute
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: result.resetTime },
        { status: 429, headers: { 'Retry-After': result.resetTime.toString() } }
      )
    }
  }

  // Authentication Check
  // Check if auth is enabled (default: true)
  const isAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTH !== 'false'

  if (isAuthEnabled) {
    // Public paths that don't require auth
    const publicPaths = [
      '/login',
      '/register', // Assuming there is a register page or first-user flow
      '/api/auth/login',
      '/api/auth/check-users', // Needed for healthcheck/setup
      '/api/auth/register-first-user',
      '/_next',
      '/favicon.ico',
      '/images'
    ]

    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

    if (!isPublicPath) {
      const user = await validateRequest(request)
      if (!user) {
        // If API request, return 401
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        // If page request, redirect to login
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        // Preserve the original URL to redirect back after login
        url.searchParams.set('callbackUrl', request.nextUrl.pathname)
        return NextResponse.redirect(url)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
