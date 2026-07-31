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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAdminClient(): Promise<any> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl || !supabaseServiceRole) return null
  return createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function grantPremiumToProfile(admin: any, userId: string, updates: Record<string, unknown>) {
  // Use update+insert instead of upsert to avoid the NOT NULL username constraint
  // error when the profile row doesn't exist (e.g. handle_new_user trigger race).
  const { error: updateErr } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (!updateErr) {
    // Check if a row was affected (update returns no error on 0 rows affected)
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!existing) {
      // Profile doesn't exist — create it with a fallback username
      const fallbackUsername = `user_${userId.slice(0, 8)}`
      const { error: insertErr } = await admin
        .from('profiles')
        .insert({ id: userId, username: fallbackUsername, ...updates })
      if (insertErr) {
        console.error(`[creem/verify-checkout] Failed to insert profile for ${userId}: ${insertErr.message}`)
        return insertErr
      }
    }
  } else {
    console.error(`[creem/verify-checkout] Failed to update profile for ${userId}: ${updateErr.message}`)
    return updateErr
  }
  return null
}

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
    let sessionId = url.searchParams.get('session_id') || ''

    // Creem does NOT template-replace {CHECKOUT_SESSION_ID} in success_url,
    // so the query param may be a literal template or absent entirely.
    // Fall back to the pending_checkout_id stored at checkout creation time.
    if (!sessionId || sessionId.startsWith('{')) {
      const admin = await getAdminClient()
      if (admin) {
        const { data: profile } = await admin
          .from('profiles')
          .select('pending_checkout_id')
          .eq('id', authUser.id)
          .maybeSingle()
        if (profile?.pending_checkout_id) {
          sessionId = profile.pending_checkout_id
          console.log(`[${route}] ${requestId} - Resolved session_id from pending_checkout_id: ${sessionId}`)
        }
      }
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'No checkout session found' }, { status: 400 })
    }

    const creem = new Creem({
      apiKey: CREEM_API_KEY,
      server: CREEM_TEST_MODE ? 'test' : 'prod',
    })

    const checkout = await creem.checkouts.retrieve(sessionId)

    const rawSubscription = typeof checkout.subscription === 'object' && checkout.subscription
      ? checkout.subscription as { status?: string; current_period_end_date?: Date | string }
      : undefined
    const subscriptionStatus = String(rawSubscription?.status ?? '').toLowerCase()

    const isCompleted =
      checkout.status === 'completed' ||
      ['active', 'completed', 'paid', 'trialing'].includes(subscriptionStatus)

    if (!isCompleted) {
      return NextResponse.json({
        verified: false,
        status: checkout.status,
        subscriptionStatus: subscriptionStatus || null,
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

    const expiryDate = rawSubscription?.current_period_end_date
      ? new Date(rawSubscription.current_period_end_date).toISOString()
      : null

    const admin = await getAdminClient()
    if (!admin) {
      console.error(`[${route}] ${requestId} - Supabase not configured for admin client`)
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const grantErr = await grantPremiumToProfile(admin, authUser.id, {
      is_premium: true,
      subscription_status: 'active',
      subscription_provider: 'CREEM',
      subscription_plan: plan,
      purchase_token: sessionId,
      ...(expiryDate ? { subscription_expiry_date: expiryDate } : {}),
      last_verified_date: new Date().toISOString(),
    })

    if (grantErr) {
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
    }

    // Clear the pending checkout ID after successful grant
    await admin
      .from('profiles')
      .update({ pending_checkout_id: null })
      .eq('id', authUser.id)

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