import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'
import { cookies } from 'next/headers'

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  })
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'push/register'

  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const authHeader = request.headers.get('authorization')

    console.log(`[${route}] ${requestId} - Starting, auth header: ${authHeader ? 'present' : 'missing'}`)

    let user = null
    let supabase: any

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })
      const { data } = await supabase.auth.getUser(token)
      user = data.user
      console.log(`[${route}] ${requestId} - Auth via Bearer token`)
    } else {
      const cookieStore = await cookies()
      const { createServerClient } = await import('@supabase/ssr')
      supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
      })
      const { data } = await supabase.auth.getUser()
      user = data.user
      console.log(`[${route}] ${requestId} - Auth via cookies`)
    }

    if (!user) {
      console.error(`[${route}] ${requestId} - Auth failed, no user`)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log(`[${route}] ${requestId} - User: ${user.id}`)

    const { token, platform } = await request.json()
    if (!token || !platform) {
      console.warn(`[${route}] ${requestId} - Missing token or platform`)
      return NextResponse.json({ error: 'Missing token or platform' }, { status: 400 })
    }

    if (platform !== 'android' && platform !== 'ios' && platform !== 'web') {
      console.warn(`[${route}] ${requestId} - Invalid platform: ${platform}`)
      return NextResponse.json({ error: 'Platform must be android, ios, or web' }, { status: 400 })
    }

    console.log(`[${route}] ${requestId} - Clearing old ${platform} tokens for user ${user.id}`)
    await supabase.from('push_tokens').delete().eq('user_id', user.id).eq('platform', platform)

    const { error } = await supabase.from('push_tokens').upsert(
      { user_id: user.id, token, platform },
      { onConflict: 'user_id,token' },
    )

    if (error) {
      console.error(`[${route}] ${requestId} - DB error: ${error.message}`)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[${route}] ${requestId} - Token saved successfully`)
    return NextResponse.json({ success: true, userId: user.id })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Exception: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
