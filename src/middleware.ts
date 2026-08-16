import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'experimental-edge'

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/game') && !request.nextUrl.pathname.startsWith('/duel') && !request.nextUrl.pathname.startsWith('/history')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const redirectUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(new URL(`/?redirect=${redirectUrl}`, request.url))
  }

  return supabaseResponse
}

export const config = {
  // Only guard /history at the edge. /game and /duel have their own
  // client-side session checks; the SSR cookie race was causing deep-link
  // / OAuth bounce loops back to /?redirect=... (Bug #2).
  matcher: ['/history'],
}
