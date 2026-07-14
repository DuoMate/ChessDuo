import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { token, platform } = await request.json()
    if (!token || !platform) {
      return NextResponse.json({ error: 'Missing token or platform' }, { status: 400 })
    }

    if (platform !== 'android' && platform !== 'ios') {
      return NextResponse.json({ error: 'Platform must be android or ios' }, { status: 400 })
    }

    const { error } = await supabase.from('push_tokens').upsert(
      { user_id: user.id, token, platform },
      { onConflict: 'user_id,token' },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
