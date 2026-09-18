import { NextResponse } from 'next/server'
import { getAuthClient } from '@/lib/apiAuth'
import { AI_COACH_FREE_DAILY_LIMIT, AI_COACH_FREE_DAILY_LIMIT_ENABLED } from '@/features/shared/gameConstants'

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

    const DAILY_LIMIT = AI_COACH_FREE_DAILY_LIMIT
    const LIMIT_ENABLED = AI_COACH_FREE_DAILY_LIMIT_ENABLED
    const today = new Date().toISOString().slice(0, 10)

    // NOTE: `coach_free_day` / `coach_free_count` require the
    // 2026-09-18_coach_daily_limit migration; `coach_last_free_game_at`
    // requires the 2026-09-12_coach_daily_trial migration. The selects are
    // tolerant: pre-migration DBs fall back so premium status never breaks
    // because of the trial columns.
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
      coach_free_day?: string | null
      coach_free_count?: number | null
    } | null = null
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium, subscription_provider, subscription_plan, purchase_token, subscription_expiry_date, auto_renew_status, purchase_state, last_verified_date, subscription_status, coach_last_free_game_at, coach_free_day, coach_free_count')
        .eq('id', user.id)
        .maybeSingle()
      profile = data
    } catch {
      // New columns missing pre-migration — fall through to legacy select below.
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
    // Daily-count columns (post-migration). Legacy single-timestamp rows
    // (1/day era) count once when stamped today.
    let coachFreeUsedToday = 0
    if (typeof profile?.coach_free_day === 'string' && profile.coach_free_day === today) {
      coachFreeUsedToday = Math.max(0, profile?.coach_free_count ?? 0)
    } else if (coachLastFreeGameAt) {
      const lastMs = new Date(coachLastFreeGameAt).getTime()
      if (!Number.isNaN(lastMs) && new Date(lastMs).toISOString().slice(0, 10) === today) {
        coachFreeUsedToday = profile?.coach_free_day ? 0 : 1
      }
    }
    const coachFreeRemaining = Math.max(0, DAILY_LIMIT - coachFreeUsedToday)
    const coachFreeEligible = isPremium || !LIMIT_ENABLED || coachFreeRemaining > 0
    const coachNextEligibleAt =
      !coachFreeEligible
        ? (() => {
            const d = new Date()
            d.setUTCHours(24, 0, 0, 0)
            return d.toISOString()
          })()
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
      coachFreeUsedToday,
      coachFreeRemaining,
      coachDailyLimit: DAILY_LIMIT,
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
