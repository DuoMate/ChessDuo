import { NextResponse } from 'next/server'
import { Webhook } from '@creem_io/nextjs'

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

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET || '',
  onGrantAccess: async ({ metadata }) => {
    const userId = String(metadata?.referenceId ?? metadata?.userId ?? '')
    if (!userId) {
      console.warn('[creem/webhook] onGrantAccess: no userId in metadata')
      return
    }
    console.log(`[creem/webhook] Granting access to user ${userId}`)
    await updateSupabase(userId, {
      is_premium: true,
      subscription_status: 'active',
      subscription_provider: 'CREEM',
      last_verified_date: new Date().toISOString(),
    })
  },
  onRevokeAccess: async ({ metadata }) => {
    const userId = String(metadata?.referenceId ?? metadata?.userId ?? '')
    if (!userId) {
      console.warn('[creem/webhook] onRevokeAccess: no userId in metadata')
      return
    }
    console.log(`[creem/webhook] Revoking access for user ${userId}`)
    await updateSupabase(userId, {
      is_premium: false,
      subscription_status: 'inactive',
      last_verified_date: new Date().toISOString(),
    })
  },
  onCheckoutCompleted: async ({ customer, product, metadata }) => {
    console.log(`[creem/webhook] Checkout completed: ${customer.email} purchased ${product.name}`)
    const userId = String(metadata?.referenceId ?? metadata?.userId ?? '')
    if (!userId) return

    const plan = String(metadata?.plan ?? 'monthly')
    await updateSupabase(userId, {
      is_premium: true,
      subscription_status: 'active',
      subscription_provider: 'CREEM',
      subscription_plan: plan,
      purchase_token: '',
      last_verified_date: new Date().toISOString(),
    })
  },
  onSubscriptionCanceled: async ({ metadata }) => {
    const userId = String(metadata?.referenceId ?? metadata?.userId ?? '')
    if (!userId) return

    await updateSupabase(userId, {
      is_premium: false,
      subscription_status: 'cancelled',
      last_verified_date: new Date().toISOString(),
    })
  },
  onSubscriptionPastDue: async ({ metadata }) => {
    const userId = String(metadata?.referenceId ?? metadata?.userId ?? '')
    if (!userId) return

    await updateSupabase(userId, {
      subscription_status: 'past_due',
      last_verified_date: new Date().toISOString(),
    })
  },
})
