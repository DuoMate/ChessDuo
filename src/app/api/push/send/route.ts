import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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

export async function POST(request: Request) {
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

    const { userId, title, body, data } = await request.json()
    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sa = getServiceAccount()
    if (!sa) {
      return NextResponse.json({ error: 'FCM not configured' }, { status: 503 })
    }

    const projectId = process.env.FCM_PROJECT_ID || sa.project_id

    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    const accessToken = await getOAuth2Token(sa)

    const results = await Promise.allSettled(
      (tokens as Pick<PushTokenRow, 'token'>[]).map((t) =>
        sendFcmMessage(accessToken, projectId, t.token, title, body, data),
      ),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return NextResponse.json({ success: true, sent, failed })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
