import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'

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

    const isExpired = profile?.subscription_expiry_date
      ? new Date(profile.subscription_expiry_date).getTime() < Date.now()
      : false

    const isPremium = profile?.is_premium === true && !isExpired

    const baseResponse = {
      isPremium,
      subscriptionProvider: (profile?.subscription_provider as 'GOOGLE_PLAY' | 'APPLE' | 'WEB' | null) || null,
      subscriptionPlan: (profile?.subscription_plan as 'monthly' | 'yearly' | null) || null,
      purchaseToken: (profile?.purchase_token as string | null) || null,
      subscriptionExpiryDate: (profile?.subscription_expiry_date as string | null) || null,
      autoRenewStatus: profile?.auto_renew_status === true,
      purchaseState: (profile?.purchase_state as string | null) || null,
      lastVerifiedDate: (profile?.last_verified_date as string | null) || null,
      subscriptionStatus: (profile?.subscription_status as string | null) || null,
    }

    return NextResponse.json(baseResponse)
  } catch (err) {
    console.error(`[${route}] ${requestId} - Exception: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
