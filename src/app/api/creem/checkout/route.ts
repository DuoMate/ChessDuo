import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'
import { Creem } from 'creem'

const CREEM_API_KEY = process.env.CREEM_API_KEY || ''
const CREEM_TEST_MODE = CREEM_API_KEY.startsWith('creem_test_')

const MONTHLY_PRODUCT_ID = process.env.CREEM_PRODUCT_ID_MONTHLY || ''
const YEARLY_PRODUCT_ID = process.env.CREEM_PRODUCT_ID_YEARLY || ''

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://chessduo.navron.org'

function getCreemProductId(internalId: string): string {
  if (internalId === 'premium_monthly') return MONTHLY_PRODUCT_ID
  if (internalId === 'premium_yearly') return YEARLY_PRODUCT_ID
  return internalId
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'creem/checkout'

  try {
    const { user: authUser } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json() as { productId?: string; userId?: string; isNative?: boolean }
    const { productId, userId, isNative } = body
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
    }

    const creemProductId = getCreemProductId(productId)

    const creem = new Creem({
      apiKey: CREEM_API_KEY,
      server: CREEM_TEST_MODE ? 'test' : 'prod',
    })

    const plan = productId.includes('yearly') ? 'yearly' : 'monthly'

    // Creem does NOT support template variables like {CHECKOUT_SESSION_ID} in
    // the success URL — it passes the literal string. Store the checkout ID in
    // the DB so the return page can look it up.
    const successUrl = isNative
      ? `${SITE_URL}/api/creem/return`
      : `${SITE_URL}/premium`

    const checkout = await creem.checkouts.create({
      productId: creemProductId,
      successUrl,
      metadata: {
        userId: userId || authUser.id,
        plan,
        referenceId: authUser.id,
      },
    })

    if (!checkout.checkoutUrl) {
      throw new Error('Creem did not return a checkout URL')
    }

    console.log(`[${route}] ${requestId} - Checkout created: ${checkout.id}`)

    // Store the checkout ID so /premium can look it up on return (no reliable
    // query param because Creem doesn't template-replace success URLs).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (supabaseUrl && supabaseServiceRole) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const admin = createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false } })
        const { error: storeErr } = await admin
          .from('profiles')
          .update({ pending_checkout_id: checkout.id })
          .eq('id', authUser.id)
        if (storeErr) {
          console.warn(`[${route}] ${requestId} - Failed to store pending_checkout_id for ${authUser.id}: ${storeErr.message}`)
        }
      } catch (storeE) {
        console.warn(`[${route}] ${requestId} - Exception storing pending_checkout_id: ${storeE instanceof Error ? storeE.message : String(storeE)}`)
      }
    }

    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl })
  } catch (err) {
    console.error(`[${route}] ${requestId} - Error: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create checkout' },
      { status: 500 },
    )
  }
}
