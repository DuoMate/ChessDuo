import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'
import { getAuthClient } from '@/lib/apiAuth'
import { SignJWT, importPKCS8 } from 'jose'
import { sendWebPush } from '@/lib/webPush'
import { authorizePush } from '@/lib/pushAuthorization'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

function getServiceAccount(): ServiceAccount | null {
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON
    if (!raw) return null
    return JSON.parse(raw) as ServiceAccount
  } catch {
    return null
  }
}

async function getOAuth2Token(sa: ServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken
  }

  const now = Math.floor(Date.now() / 1000)
  const privateKey = await importPKCS8(sa.private_key, 'RS256')

  const jwt = await new SignJWT({
    iss: sa.client_email,
    sub: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey)

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await resp.json() as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    throw new Error('Failed to exchange JWT for OAuth2 token')
  }

  const expiresAt = Date.now() + (data.expires_in || 3600) * 1000 - 60000
  cachedToken = { accessToken: data.access_token, expiresAt }
  return data.access_token
}

async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const message: Record<string, unknown> = {
    message: {
      token: deviceToken,
      notification: { title, body },
      android: {
        priority: 'HIGH' as const,
        notification: { channel_id: 'chessduo_default', default_sound: true },
      },
    },
  }

  if (data && Object.keys(data).length > 0) {
    (message.message as Record<string, unknown>).data = data
  }

  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    },
  )

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`FCM error ${resp.status}: ${errBody}`)
  }
}

async function sendWebPushMessage(
  subscription: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@chessduo.app'

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured')
  }

  await sendWebPush(subscription, title, body, vapidPublicKey, vapidPrivateKey, subject, data)
}

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
  const route = 'push/send'

  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    const { user: authUser, supabase: authSupabase } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      console.error(`[${route}] ${requestId} - Auth failed, no user`)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = authUser
    const supabase = authSupabase

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    let serviceSupabase: any | null = null
    if (supabaseServiceRoleKey) {
      const { createClient } = await import('@supabase/supabase-js')
      serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    } else {
      console.error(`[${route}] ${requestId} - SUPABASE_SERVICE_ROLE_KEY not configured — push send unavailable`)
      return NextResponse.json({ error: 'Service role key not configured — push send unavailable' }, { status: 500 })
    }

    console.log(`[${route}] ${requestId} - User: ${user.id}`)

    const { userId, title, body, data } = await request.json()
    if (!userId || !title || !body || !data?.type || !data?.senderId) {
      console.warn(`[${route}] ${requestId} - Missing required fields`)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ---- P0-4 authorization (server-side) ----
    const type: string = String(data.type)
    const senderId: string = String(data.senderId)
    const receiverId: string = String(userId)

    // The client must identify as the authenticated caller (anti-impersonation).
    if (senderId !== user.id) {
      console.warn(`[${route}] ${requestId} - Sender impersonation rejected`)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (receiverId === senderId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Relationship facts, scoped by the caller's RLS (own friendships).
    const factQuery =
      `or(` +
      `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),` +
      `and(sender_id.eq.${receiverId},receiver_id.eq.${senderId}))`
    const { data: friendships } = await supabase
      .from('friendships')
      .select('status')
      .or(factQuery)
    const statuses = (friendships || []).map((f: { status: string }) => f.status)
    const isAcceptedFriends = statuses.includes('accepted')
    const isBlocked = statuses.includes('blocked')
    const hasPendingRequest = statuses.includes('pending')

    let isRoomMember = false
    if (type === 'game_invite' && data.roomId) {
      const { data: member } = await supabase.rpc('is_room_member', { check_room_id: String(data.roomId) })
      isRoomMember = !!member
    }

    // Durable per-(sender,type) daily cap (server-side, service role).
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: dailySent } = await serviceSupabase
      .from('push_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .eq('type', type)
      .gte('created_at', since)

    const decision = authorizePush({
      type,
      senderId,
      receiverId,
      isAcceptedFriends,
      isBlocked,
      hasPendingRequest,
      isRoomMember,
      dailySent: dailySent || 0,
    })
    if (!decision.allowed) {
      console.warn(`[${route}] ${requestId} - Push denied (${decision.reason})`)
      return NextResponse.json({ success: false, error: decision.reason }, { status: 403 })
    }

    // Record the send for the daily cap / audit (best-effort).
    await serviceSupabase
      .from('push_send_log')
      .insert({ sender_id: senderId, receiver_id: receiverId, type })

    console.log(`[${route}] ${requestId} - Fetching tokens for user: ${userId}`)

    const tokenClient = serviceSupabase || supabase
    const { data: tokens, error } = await tokenClient
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId)

    if (error) {
      console.error(`[${route}] ${requestId} - DB error: ${error.message}`)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!tokens || tokens.length === 0) {
      console.warn(`[${route}] ${requestId} - No tokens found for user`)
      return NextResponse.json({ success: true, sent: 0 })
    }

    const webTokens = tokens.filter((t: { platform: string }) => t.platform === 'web')
    const nativeTokens = tokens.filter((t: { platform: string }) => t.platform !== 'web')

    console.log(`[${route}] ${requestId} - Found ${webTokens.length} web, ${nativeTokens.length} native token(s)`)

    interface TokenResult { platform: string; tokenPreview: string; error?: string }
    const tokenResults: TokenResult[] = []

    function tokenPreview(token: string): string {
      if (token.length <= 40) return token
      return token.substring(0, 20) + '...' + token.substring(token.length - 16)
    }

    if (nativeTokens.length > 0) {
      const sa = getServiceAccount()
      if (!sa) {
        console.warn(`[${route}] ${requestId} - FCM not configured, skipping native tokens`)
        for (const t of nativeTokens) {
          tokenResults.push({ platform: t.platform, tokenPreview: tokenPreview(t.token), error: 'FCM not configured' })
        }
      } else {
        const projectId = process.env.FCM_PROJECT_ID || sa.project_id
        const accessToken = await getOAuth2Token(sa)
        const fcmResults = await Promise.allSettled(
          nativeTokens.map(async (t) => {
            try {
              await sendFcmMessage(accessToken, projectId, t.token, title, body, data)
              return { platform: t.platform, tokenPreview: tokenPreview(t.token) }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              if (msg.includes('UNREGISTERED') || msg.includes('NOT_FOUND') || msg.includes('InvalidRegistration') || msg.includes('PERMISSION_DENIED') || msg.includes('SENDER_ID_MISMATCH')) {
                console.warn(`[${route}] ${requestId} - Cleaning up invalid token for user ${userId}: ${msg}`)
                try { await serviceSupabase.from('push_tokens').delete().eq('token', t.token) } catch { /* best effort */ }
              }
              return { platform: t.platform, tokenPreview: tokenPreview(t.token), error: msg }
            }
          }),
        )
        for (const r of fcmResults) {
          tokenResults.push(r.status === 'fulfilled' ? r.value : { platform: 'android', tokenPreview: '?', error: r.reason?.message || String(r.reason) })
        }
      }
    }

    if (webTokens.length > 0) {
      const webResults = await Promise.allSettled(
        webTokens.map(async (t) => {
          try {
            await sendWebPushMessage(t.token, title, body, data)
            return { platform: t.platform, tokenPreview: tokenPreview(t.token) }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            if (msg.includes('410') || msg.includes('404')) {
              console.warn(`[${route}] ${requestId} - Cleaning up expired web subscription for user ${userId}`)
              try { await serviceSupabase.from('push_tokens').delete().eq('token', t.token) } catch { /* best effort */ }
            }
            return { platform: t.platform, tokenPreview: tokenPreview(t.token), error: msg }
          }
        }),
      )
      for (const r of webResults) {
        if (r.status === 'rejected') {
          console.error(`[${route}] ${requestId} - Web push token failed: ${r.reason?.message || r.reason}`)
        }
        tokenResults.push(r.status === 'fulfilled' ? r.value : { platform: 'web', tokenPreview: '?', error: r.reason?.message || String(r.reason) })
      }
    }

    const sent = tokenResults.filter((r) => !r.error).length
    const failed = tokenResults.filter((r) => r.error).length
    const failures = tokenResults.filter((r) => r.error).map((r) => ({ platform: r.platform, tokenPreview: r.tokenPreview, error: r.error }))

    console.log(`[${route}] ${requestId} - Sent: ${sent}, Failed: ${failed}`)
    return NextResponse.json({ success: true, sent, failed, failures, tokenCount: webTokens.length + nativeTokens.length })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Exception: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
