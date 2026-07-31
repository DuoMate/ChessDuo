import { NextResponse } from 'next/server'
import { Webhook } from '@creem_io/nextjs'
import { Creem } from 'creem'

const CREEM_API_KEY = process.env.CREEM_API_KEY || ''
const CREEM_TEST_MODE = CREEM_API_KEY.startsWith('creem_test_')

async function updateSupabase(userId: string, updates: Record<string, unknown>) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !supabaseServiceRole) {
    console.error('[creem/webhook] Supabase not configured for admin client')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false },
  })

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates }, { onConflict: 'id' })

  if (error) {
    console.error(`[creem/webhook] Failed to update profile for ${userId}:`, error.message)
  }
}

// Events sometimes carry empty metadata (observed on `checkout.completed` +
// `subscription.paid`). Resolve the ChessDuo userId from event metadata first,
// then fall back to retrieving the checkout from Creem — the checkout object
// always carries `metadata.referenceId`/`userId` (see verify-checkout).
async function resolveUserId(metadata: unknown, checkoutId?: string): Promise<string> {
  const meta = (metadata ?? {}) as Record<string, unknown>
  const fromMeta = String(meta?.referenceId ?? meta?.userId ?? '')
  if (fromMeta) return fromMeta

  if (checkoutId && CREEM_API_KEY) {
    try {
      const creem = new Creem({
        apiKey: CREEM_API_KEY,
        server: CREEM_TEST_MODE ? 'test' : 'prod',
      })
      const checkout = await creem.checkouts.retrieve(checkoutId)
      const meta2 = (checkout.metadata ?? {}) as Record<string, unknown>
      const fromCheckout = String(meta2?.referenceId ?? meta2?.userId ?? '')
      if (fromCheckout) return fromCheckout
      console.warn(`[creem/webhook] Checkout ${checkoutId} carries no referenceId/userId in its metadata`)
    } catch (err) {
      console.warn(
        `[creem/webhook] Failed to retrieve checkout ${checkoutId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
  return ''
}

// A webhook event that we cannot attribute to a profile must never crash the
// handler — log it loudly and still resolve 200 so Creem does not retry-spam.
async function resolveUserIdFromEvent(metadata: unknown, checkoutId?: string): Promise<string> {
  const userId = await resolveUserId(metadata, checkoutId)
  if (!userId) {
    console.error('[creem/webhook] Unresolvable event — no userId in metadata or checkout:', {
      metadata,
      checkoutId,
    })
  }
  return userId
}

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET || '',
  onGrantAccess: async ({ metadata, current_period_end_date: currentPeriodEndDate, id }) => {
    const userId = await resolveUserIdFromEvent(metadata, id)
    if (!userId) return
    console.log(`[creem/webhook] Granting access to user ${userId}`)
    await updateSupabase(userId, {
      is_premium: true,
      subscription_status: 'active',
      subscription_provider: 'CREEM',
      ...(currentPeriodEndDate
        ? { subscription_expiry_date: new Date(currentPeriodEndDate).toISOString() }
        : {}),
      last_verified_date: new Date().toISOString(),
    })
  },
  onRevokeAccess: async ({ metadata, id }) => {
    const userId = await resolveUserIdFromEvent(metadata, id)
    if (!userId) return
    console.log(`[creem/webhook] Revoking access for user ${userId}`)
    await updateSupabase(userId, {
      is_premium: false,
      subscription_status: 'inactive',
      last_verified_date: new Date().toISOString(),
    })
  },
  onCheckoutCompleted: async ({ customer, product, metadata, id, subscription }) => {
    const email = typeof customer === 'object' && customer ? customer.email : undefined
    const productName = typeof product === 'object' && product ? product.name : undefined
    console.log(
      `[creem/webhook] Checkout completed: ${email ?? 'unknown email'} purchased ${productName ?? 'unknown product'} (id: ${id})`
    )

    const userId = await resolveUserIdFromEvent(metadata, id)
    if (!userId) return

    const plan = String(metadata?.plan ?? 'monthly')
    const currentPeriodEndDate =
      typeof subscription === 'object' && subscription?.current_period_end_date
        ? new Date(subscription.current_period_end_date).toISOString()
        : null

    console.log(`[creem/webhook] Granting premium to ${userId} (checkout ${id})`)
    await updateSupabase(userId, {
      is_premium: true,
      subscription_status: 'active',
      subscription_provider: 'CREEM',
      subscription_plan: plan,
      purchase_token: id || '',
      ...(currentPeriodEndDate ? { subscription_expiry_date: currentPeriodEndDate } : {}),
      last_verified_date: new Date().toISOString(),
    })
  },
  onSubscriptionCanceled: async ({ metadata, id }) => {
    const userId = await resolveUserIdFromEvent(metadata, id)
    if (!userId) return
    console.log(`[creem/webhook] Cancelling premium for ${userId}`)
    await updateSupabase(userId, {
      is_premium: false,
      subscription_status: 'cancelled',
      last_verified_date: new Date().toISOString(),
    })
  },
  onSubscriptionPastDue: async ({ metadata, id }) => {
    const userId = await resolveUserIdFromEvent(metadata, id)
    if (!userId) return
    console.log(`[creem/webhook] Marking premium past-due for ${userId}`)
    await updateSupabase(userId, {
      subscription_status: 'past_due',
      last_verified_date: new Date().toISOString(),
    })
  },
})
