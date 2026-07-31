import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'
import { Creem } from 'creem'

const CREEM_API_KEY = process.env.CREEM_API_KEY || ''
const CREEM_TEST_MODE = CREEM_API_KEY.startsWith('creem_test_')

export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  const route = 'creem/subscriptions'

  try {
    const { user: authUser, supabase } = await getAuthClient(request, route, requestId)
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, subscription_plan, subscription_expiry_date, subscription_status')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profile?.is_premium && profile?.subscription_status === 'active') {
      const expiryDate = profile.subscription_expiry_date
        ? new Date(profile.subscription_expiry_date).getTime()
        : 0
      const isExpired = expiryDate > 0 && expiryDate < Date.now()

      if (!isExpired) {
        return NextResponse.json([{
          success: true,
          purchaseToken: 'creem_restored',
          productId: profile.subscription_plan === 'yearly' ? 'premium_yearly' : 'premium_monthly',
          orderId: '',
        }])
      }
    }

    return NextResponse.json([])
  } catch (err) {
    console.error(`[${route}] ${requestId} - Error: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json([], { status: 200 })
  }
}
