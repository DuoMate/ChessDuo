import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/game')) {
    const hasAuthCookie = request.cookies
      .getAll()
      .some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (!hasAuthCookie) {
      const redirectUrl = encodeURIComponent(request.nextUrl.toString())
      return NextResponse.redirect(new URL(`/?redirect=${redirectUrl}`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/game'],
}
