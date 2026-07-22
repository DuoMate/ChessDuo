import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'
import { SignJWT, importPKCS8 } from 'jose'

let cachedToken: { accessToken: string; expiresAt: number } | null = null

interface ServiceAccount {
  client_email: string
  private_key: string
}

interface GooglePlaySubscriptionResponse {
  expiryTimeMillis?: string
  autoRenewing?: boolean
  purchaseState?: number
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
): Promise<GooglePlaySubscriptionResponse | null> {
  try {
    const resp = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!resp.ok) return null
    return resp.json() as Promise<GooglePlaySubscriptionResponse>
  } catch {
    return null
  }
}

function mapPurchaseState(purchaseStateNum: number | undefined): string | null {
  switch (purchaseStateNum) {
    case 0: return 'purchased'
    case 1: return 'cancelled'
    case 2: return 'pending'
    default: return null
  }
}

function needsReverification(
  expiryDate: string | null,
  lastVerified: string | null,
  purchaseState: string | null,
): boolean {
  if (purchaseState === 'pending') return true
  if (!lastVerified) return true

  const lastVerifiedDate = new Date(lastVerified).getTime()
  const hoursSince = (Date.now() - lastVerifiedDate) / (1000 * 60 * 60)
  if (hoursSince > 24) return true

  if (expiryDate) {
    const expiryMs = new Date(expiryDate).getTime()
    const daysUntilExpiry = (expiryMs - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysUntilExpiry < 3) return true
  }

  return false
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'subscription/status'

  try {
    const { user: authUser, supabase: authSupabase } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      console.error(`[${route}] ${requestId} - Auth failed, no user`)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = authUser
    const supabase = authSupabase

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, subscription_provider, subscription_plan, purchase_token, subscription_expiry_date, auto_renew_status, purchase_state, last_verified_date, subscription_status')
      .eq('id', user.id)
      .maybeSingle()

    const baseResponse = {
      isPremium: profile?.is_premium === true,
      subscriptionProvider: (profile?.subscription_provider as 'GOOGLE_PLAY' | 'APPLE' | 'WEB' | null) || null,
      subscriptionPlan: (profile?.subscription_plan as 'monthly' | 'yearly' | null) || null,
      purchaseToken: (profile?.purchase_token as string | null) || null,
      subscriptionExpiryDate: (profile?.subscription_expiry_date as string | null) || null,
      autoRenewStatus: profile?.auto_renew_status === true,
      purchaseState: (profile?.purchase_state as string | null) || null,
      lastVerifiedDate: (profile?.last_verified_date as string | null) || null,
      subscriptionStatus: (profile?.subscription_status as string | null) || null,
    }

    const needsCheck = profile?.subscription_provider === 'GOOGLE_PLAY' &&
      profile?.purchase_token &&
      profile?.subscription_plan &&
      needsReverification(
        profile?.subscription_expiry_date as string | null,
        profile?.last_verified_date as string | null,
        profile?.purchase_state as string | null,
      )

    if (!needsCheck) {
      console.log(`[${route}] ${requestId} - No reverification needed, returning cached status`)
      return NextResponse.json(baseResponse)
    }

    console.log(`[${route}] ${requestId} - Reverification needed, checking with Google`)

    const sa = getServiceAccount()
    if (!sa) {
      console.warn(`[${route}] ${requestId} - Google Play not configured, returning cached`)
      return NextResponse.json(baseResponse)
    }

    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.navron.chessduo'
    const accessToken = await getOAuth2Token(sa)

    const sub = await getSubscriptionFromGoogle(
      accessToken,
      packageName,
      profile!.subscription_plan as string,
      profile!.purchase_token as string,
    )

    if (!sub) {
      console.warn(`[${route}] ${requestId} - No subscription data from Google`)
      return NextResponse.json(baseResponse)
    }

    const purchaseState = mapPurchaseState(sub.purchaseState)
    const isActive = purchaseState === 'purchased'
    const expiryDate = sub.expiryTimeMillis ? new Date(Number(sub.expiryTimeMillis)).toISOString() : null
    const now = new Date().toISOString()

    console.log(`[${route}] ${requestId} - Google response: active=${isActive}, state=${purchaseState}`)

    if (isActive && !baseResponse.isPremium) {
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          is_premium: true,
          subscription_status: 'active',
          purchase_state: purchaseState,
          subscription_expiry_date: expiryDate,
          auto_renew_status: sub.autoRenewing === true,
          last_verified_date: now,
        }, { onConflict: 'id' })
    } else if (!isActive && baseResponse.isPremium) {
      await supabase
        .from('profiles')
        .update({
          is_premium: false,
          subscription_status: 'inactive',
          purchase_state: purchaseState,
          subscription_expiry_date: expiryDate,
          auto_renew_status: sub.autoRenewing === true,
          last_verified_date: now,
        })
        .eq('id', user.id)
    } else {
      await supabase
        .from('profiles')
        .update({
          purchase_state: purchaseState,
          subscription_expiry_date: expiryDate,
          auto_renew_status: sub.autoRenewing === true,
          last_verified_date: now,
        })
        .eq('id', user.id)
    }

    console.log(`[${route}] ${requestId} - Profile updated`)
    return NextResponse.json({
      ...baseResponse,
      isPremium: isActive,
      purchaseState,
      subscriptionExpiryDate: expiryDate,
      autoRenewStatus: sub.autoRenewing === true,
      lastVerifiedDate: now,
    })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Exception: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
