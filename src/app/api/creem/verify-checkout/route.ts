import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'
import { applyRateLimit } from '@/lib/rateLimit'
import { Creem } from 'creem'
import type { SubscriptionInfo } from '@/features/billing'

const CREEM_API_KEY = process.env.CREEM_API_KEY || ''
const CREEM_TEST_MODE = CREEM_API_KEY.startsWith('creem_test_')

function getPlanFromBillingPeriod(billingPeriod?: string): 'monthly' | 'yearly' {
  if (billingPeriod?.includes('year')) return 'yearly'
  return 'monthly'
}

type CreemProductLike = { billingPeriod?: string }
type CreemSubscriptionLike = { current_period_end_date?: Date | string }

export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'creem/verify-checkout'

  const rateLimitResult = applyRateLimit(request)
  if (rateLimitResult) return rateLimitResult

  try {
    const { user: authUser } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const creem = new Creem({
      apiKey: CREEM_API_KEY,
      server: CREEM_TEST_MODE ? 'test' : 'prod',
    })

    const checkout = await creem.checkouts.retrieve(sessionId)

    if (checkout.status !== 'completed') {
      return NextResponse.json({
        verified: false,
        status: checkout.status,
      })
    }

    const referenceId = String(checkout.metadata?.referenceId ?? '')
    const metadataUserId = String(checkout.metadata?.userId ?? '')

    if (referenceId && referenceId !== authUser.id) {
      console.warn(`[${route}] ${requestId} - Session ${sessionId} belongs to ${referenceId}, not ${authUser.id}`)
      return NextResponse.json({ error: 'Checkout does not belong to this user' }, { status: 403 })
    }

    if (metadataUserId && metadataUserId !== authUser.id) {
      console.warn(`[${route}] ${requestId} - Session ${sessionId} userId mismatch`)
      return NextResponse.json({ error: 'Checkout does not belong to this user' }, { status: 403 })
    }

    const product = typeof checkout.product === 'object'
      ? (checkout.product as unknown as CreemProductLike)
      : undefined
    const plan =
      String(checkout.metadata?.plan ?? '') === 'yearly'
        ? 'yearly'
        : getPlanFromBillingPeriod(product?.billingPeriod)

    const subscription = typeof checkout.subscription === 'object'
      ? (checkout.subscription as unknown as CreemSubscriptionLike)
      : undefined
    const expiryDate = subscription?.current_period_end_date
      ? new Date(subscription.current_period_end_date).toISOString()
      : null

    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (supabaseUrl && supabaseServiceRole) {
      const admin = createClient(supabaseUrl, supabaseServiceRole, {
        auth: { persistSession: false },
      })
      const { error } = await admin
        .from('profiles')
        .upsert(
          {
            id: authUser.id,
            is_premium: true,
            subscription_status: 'active',
            subscription_provider: 'CREEM',
            subscription_plan: plan,
            purchase_token: sessionId,
            ...(expiryDate ? { subscription_expiry_date: expiryDate } : {}),
            last_verified_date: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )

      if (error) {
        console.error(`[${route}] ${requestId} - Supabase update failed: ${error.message}`)
        return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
      }
    } else {
      console.error(`[${route}] ${requestId} - Supabase not configured for admin client`)
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const status: SubscriptionInfo = {
      isPremium: true,
      subscriptionProvider: 'CREEM',
      subscriptionPlan: plan,
      purchaseToken: sessionId,
      subscriptionExpiryDate: expiryDate,
      autoRenewStatus: true,
      purchaseState: 'active',
      lastVerifiedDate: new Date().toISOString(),
      subscriptionStatus: 'active',
    }

    return NextResponse.json({ verified: true, status })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Error: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to verify checkout' },
      { status: 500 },
    )
  }
}
