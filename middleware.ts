import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "./lib/auth"
import { rateLimit } from "./lib/rate-limiter"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate Limiting for Auth Endpoints
  if (pathname.startsWith('/api/auth/')) {
    const result = await rateLimit(request, { limit: 10, window: 60 }) // 10 requests per minute
    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: result.reset },
        { status: 429, headers: { 'Retry-After': result.reset.toString() } }
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
