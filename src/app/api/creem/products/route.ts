import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'
import { Creem } from 'creem'
import type { SubscriptionPlan } from '@/features/billing'

const CREEM_API_KEY = process.env.CREEM_API_KEY || ''
const CREEM_TEST_MODE = CREEM_API_KEY.startsWith('creem_test_')
const MONTHLY_PRODUCT_ID = process.env.CREEM_PRODUCT_ID_MONTHLY || ''
const YEARLY_PRODUCT_ID = process.env.CREEM_PRODUCT_ID_YEARLY || ''

export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'creem/products'

  try {
    const { user: authUser } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const creem = new Creem({
      apiKey: CREEM_API_KEY,
      server: CREEM_TEST_MODE ? 'test' : 'prod',
    })

    let monthlyProduct, yearlyProduct

    try {
      monthlyProduct = await creem.products.get(MONTHLY_PRODUCT_ID)
    } catch {
      console.warn(`[${route}] ${requestId} - Failed to fetch monthly product`)
    }

    try {
      yearlyProduct = await creem.products.get(YEARLY_PRODUCT_ID)
    } catch {
      console.warn(`[${route}] ${requestId} - Failed to fetch yearly product`)
    }

    const plans: SubscriptionPlan[] = []

    if (monthlyProduct) {
      const priceAmount = (monthlyProduct as { price?: number }).price || 199
      plans.push({
        productId: 'premium_monthly',
        title: 'Monthly',
        subtitle: 'Flexible & cancel anytime',
        price: `$${(priceAmount / 100).toFixed(2)}`,
        description: 'Monthly premium subscription',
        billingPeriod: 'monthly',
      })
    }

    if (yearlyProduct) {
      const priceAmount = (yearlyProduct as { price?: number }).price || 1499
      plans.push({
        productId: 'premium_yearly',
        title: 'Annual',
        subtitle: 'Most popular choice',
        price: `$${(priceAmount / 100).toFixed(2)}`,
        description: 'Annual premium subscription',
        billingPeriod: 'yearly',
      })
    }

    return NextResponse.json(plans)
  } catch (err) {
    console.error(`[${route}] ${requestId} - Error: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json([], { status: 200 })
  }
}

export async function HEAD(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const { user: authUser } = await getAuthClient(request, 'creem/products/head', requestId)
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!CREEM_API_KEY) {
      return NextResponse.json({ error: 'Creem not configured' }, { status: 503 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
