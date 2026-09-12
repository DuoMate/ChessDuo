import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'
import { COACH_TRIAL_WINDOW_MS } from '@/features/shared/gameConstants'

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

    const TRIAL_WINDOW_MS = COACH_TRIAL_WINDOW_MS

    // NOTE: `coach_last_free_game_at` requires the 2026-09-12_coach_daily_trial
    // migration. The select is tolerant: pre-migration DBs fall back to a base
    // select so premium status never breaks because of the trial column.
    let profile: {
      is_premium?: boolean | null
      subscription_provider?: string | null
      subscription_plan?: string | null
      purchase_token?: string | null
      subscription_expiry_date?: string | null
      auto_renew_status?: boolean | null
      purchase_state?: string | null
      last_verified_date?: string | null
      subscription_status?: string | null
      coach_last_free_game_at?: string | null
    } | null = null
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium, subscription_provider, subscription_plan, purchase_token, subscription_expiry_date, auto_renew_status, purchase_state, last_verified_date, subscription_status, coach_last_free_game_at')
        .eq('id', user.id)
        .maybeSingle()
      profile = data
    } catch {
      // Column missing pre-migration — fall through to base select below.
      profile = null
    }
    if (!profile) {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium, subscription_provider, subscription_plan, purchase_token, subscription_expiry_date, auto_renew_status, purchase_state, last_verified_date, subscription_status')
        .eq('id', user.id)
        .maybeSingle()
      profile = data
    }

    const isExpired = profile?.subscription_expiry_date
      ? new Date(profile.subscription_expiry_date).getTime() < Date.now()
      : false

    const isPremium = profile?.is_premium === true && !isExpired

    const coachLastFreeGameAt = (profile?.coach_last_free_game_at as string | null) || null
    const coachLastMs = coachLastFreeGameAt ? new Date(coachLastFreeGameAt).getTime() : NaN
    const coachFreeEligible = isPremium || !coachLastFreeGameAt || Number.isNaN(coachLastMs) || (Date.now() - coachLastMs) >= TRIAL_WINDOW_MS
    const coachNextEligibleAt =
      !coachFreeEligible && !Number.isNaN(coachLastMs)
        ? new Date(coachLastMs + TRIAL_WINDOW_MS).toISOString()
        : null

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
      coachLastFreeGameAt,
      coachFreeEligible,
      coachNextEligibleAt,
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
