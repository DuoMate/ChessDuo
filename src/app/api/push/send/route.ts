import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'
import { cookies } from 'next/headers'
import { SignJWT, importPKCS8 } from 'jose'
import type { PushTokenRow } from '@/features/push-notifications/types'

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
      android: { priority: 'HIGH' as const },
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
  const webpush = await import('web-push')
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@chessduo.app'

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys not configured')
  }

  webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey)

  let pushSubscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  try {
    pushSubscription = JSON.parse(subscription)
  } catch {
    throw new Error('Invalid web push subscription JSON')
  }

  const payload = JSON.stringify({ title, body, data, tag: `chessduo-${data?.type || 'default'}` })
  await webpush.sendNotification(pushSubscription as Parameters<typeof webpush.sendNotification>[0], payload)
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'push/send'

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
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(supabaseUrl, supabaseAnonKey)
      const token = authHeader.split(' ')[1]
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

    const { userId, title, body, data } = await request.json()
    if (!userId || !title || !body) {
      console.warn(`[${route}] ${requestId} - Missing required fields`)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[${route}] ${requestId} - Fetching tokens for user: ${userId}`)

    const { data: tokens, error } = await supabase
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

    const results: PromiseSettledResult<void>[] = []

    if (nativeTokens.length > 0) {
      const sa = getServiceAccount()
      if (!sa) {
        console.warn(`[${route}] ${requestId} - FCM not configured, skipping native tokens`)
      } else {
        const projectId = process.env.FCM_PROJECT_ID || sa.project_id
        const accessToken = await getOAuth2Token(sa)
        const fcmResults = await Promise.allSettled(
          (nativeTokens as Pick<PushTokenRow, 'token'>[]).map((t) =>
            sendFcmMessage(accessToken, projectId, t.token, title, body, data),
          ),
        )
        results.push(...fcmResults)
      }
    }

    if (webTokens.length > 0) {
      const webResults = await Promise.allSettled(
        (webTokens as Pick<PushTokenRow, 'token'>[]).map((t) =>
          sendWebPushMessage(t.token, title, body, data),
        ),
      )
      results.push(...webResults)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    console.log(`[${route}] ${requestId} - Sent: ${sent}, Failed: ${failed}`)
    return NextResponse.json({ success: true, sent, failed })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Exception: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
