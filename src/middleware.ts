import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/game')) {
    const playerId = request.nextUrl.searchParams.get('playerId')
    const level = request.nextUrl.searchParams.get('level')
    const mode = request.nextUrl.searchParams.get('mode')
    const room = request.nextUrl.searchParams.get('room')

    const hasAuthCookie = request.cookies
      .getAll()
      .some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    const isOffline = mode === 'offline' || (!mode && !playerId && !!level)
    const hasPlayerId = !!playerId
    const isJoinLink = !!room

    if (!isOffline && !hasPlayerId && !hasAuthCookie && !isJoinLink) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/game'],
}
