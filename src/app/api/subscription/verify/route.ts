import { NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'
import { getAuthClient } from '@/lib/apiAuth'
import { SignJWT, importPKCS8 } from 'jose'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

interface GooglePlaySubscriptionResponse {
  startTimeMillis?: string
  expiryTimeMillis?: string
  autoRenewing?: boolean
  purchaseState?: number
  orderId?: string
  acknowledgementState?: number
}

function getServiceAccount(): ServiceAccount | null {
  try {
    const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
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
    scope: 'https://www.googleapis.com/auth/androidpublisher',
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

async function getSubscriptionFromGoogle(
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<GooglePlaySubscriptionResponse> {
  const resp = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`Google Play API error ${resp.status}: ${errBody}`)
  }

  return resp.json() as Promise<GooglePlaySubscriptionResponse>
}

async function acknowledgeSubscription(
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<void> {
  const resp = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}:acknowledge`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`Google Play acknowledge error ${resp.status}: ${errBody}`)
  }
}

function mapPurchaseState(purchaseStateNum: number | undefined): string {
  switch (purchaseStateNum) {
    case 0: return 'purchased'
    case 1: return 'cancelled'
    case 2: return 'pending'
    default: return 'expired'
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'subscription/verify'

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

    const body = await request.json() as { purchaseToken?: string; productId?: string; orderId?: string }
    const { purchaseToken, productId, orderId } = body
    if (!purchaseToken || !productId) {
      console.warn(`[${route}] ${requestId} - Missing purchaseToken or productId`)
      return NextResponse.json({ error: 'Missing purchaseToken or productId' }, { status: 400 })
    }

    const sa = getServiceAccount()
    if (!sa) {
      console.error(`[${route}] ${requestId} - Google Play Billing not configured`)
      return NextResponse.json({ error: 'Google Play Billing not configured' }, { status: 503 })
    }

    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.navron.chessduo'
    const accessToken = await getOAuth2Token(sa)

    console.log(`[${route}] ${requestId} - Fetching subscription from Google`)
    const sub = await getSubscriptionFromGoogle(accessToken, packageName, productId, purchaseToken)

    const purchaseState = mapPurchaseState(sub.purchaseState)
    const isActive = purchaseState === 'purchased'

    console.log(`[${route}] ${requestId} - Purchase state: ${purchaseState}, active: ${isActive}`)

    if (!isActive) {
      return NextResponse.json({
        success: false,
        error: `Subscription is not active (state: ${purchaseState})`,
        state: purchaseState,
      }, { status: 200 })
    }

    if (sub.acknowledgementState === 0) {
      console.log(`[${route}] ${requestId} - Acknowledging subscription`)
      await acknowledgeSubscription(accessToken, packageName, productId, purchaseToken)
    }

    const plan = productId.includes('yearly') ? 'yearly' : 'monthly'
    const expiryDate = sub.expiryTimeMillis ? new Date(Number(sub.expiryTimeMillis)).toISOString() : null
    const now = new Date().toISOString()

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          is_premium: true,
          subscription_status: 'active',
          subscription_provider: 'GOOGLE_PLAY',
          subscription_plan: plan,
          purchase_token: purchaseToken,
          subscription_expiry_date: expiryDate,
          auto_renew_status: sub.autoRenewing === true,
          purchase_state: purchaseState,
          last_verified_date: now,
        },
        { onConflict: 'id' },
      )

    if (upsertError) {
      console.error(`[${route}] ${requestId} - DB upsert error: ${upsertError.message}`)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    console.log(`[${route}] ${requestId} - Subscription verified successfully, plan: ${plan}`)
    return NextResponse.json({
      success: true,
      state: purchaseState,
      plan,
      expiryDate,
    })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Exception: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
