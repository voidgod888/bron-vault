import { NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  // Auth removed as per user request
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
