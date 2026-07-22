import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'
import { getAuthClient } from '@/lib/apiAuth'

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
    const { user: authUser, supabase: authSupabase } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      console.error(`[${route}] ${requestId} - Auth failed, no user`)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = authUser
    const supabase = authSupabase

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
