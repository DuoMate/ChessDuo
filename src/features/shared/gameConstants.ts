export const CHECKMATE_SCORE = 10000

export const DEFAULT_TEAM_TIMER_SECONDS = 600

export const DEFAULT_MOVE_TIMER_SECONDS = 10

export const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000

export const QUICK_MATCH_ROOM_EXPIRY_MS = 60_000

export const DEFAULT_POLLING_INTERVAL_MS = 2000

export const INSIGHTS_FREE_LIMIT = 3

/**
 * @deprecated Superseded by `AI_COACH_FREE_DAILY_LIMIT` (N games per UTC
 * calendar day). Retained only to avoid breaking stray imports — new code
 * must use the central daily-limit config above.
 */
export const COACH_TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * AI Coach daily free allowance — SINGLE SOURCE OF TRUTH.
 *
 * Purpose:
 * Maximum number of AI Coach games a free user may start per calendar day
 * (UTC). Premium users are always unlimited.
 *
 * Current launch value:
 * 3
 *
 * How to change:
 * Change this value only. Quota enforcement (`coachTrial.ts`), the
 * `/api/subscription/status` server computation, and all derived
 * user-facing messaging (`getAiCoachDailyLimitMessage`,
 * `getAiCoachRemainingMessage`, `getAiCoachLimitReachedMessage`, home +
 * gate copy) read this constant — e.g. setting it to 5 automatically
 * yields "5 free games every day" with a quota of 5. No UI/business-logic
 * edits required for the normal case.
 *
 * Do NOT hard-code "3 free games" / "limit === 3" / "count >= 3" anywhere —
 * always derive from this constant.
 */
export const AI_COACH_FREE_DAILY_LIMIT = 3

/**
 * Master switch for the AI Coach free daily quota.
 *
 * When false: free users are not quota-limited (no enforcement, no
 * "remaining games" / limit-reached messaging); premium users remain
 * unlimited. Allows the product team to lift the limit without removing
 * the implementation.
 */
export const AI_COACH_FREE_DAILY_LIMIT_ENABLED = true

/** Google Play subscription product IDs (must match Play Console). */
export const PREMIUM_MONTHLY_PRODUCT_ID = 'premium_monthly'

export const PREMIUM_YEARLY_PRODUCT_ID = 'premium_yearly'

/**
 * Google Play base-plan IDs per subscription product (must match Play Console
 * "Base plans and offers"). The native purchase flow requires the base-plan ID
 * — passing the subscription product ID as the plan was the production
 * "Upgrade loading forever" root cause. Annual uses `yearlybaseplan`
 * (the old monthly-cadence `yearlybase` is inactive in Play Console).
 */
export const GOOGLE_PLAY_BASE_PLAN_IDS: Record<string, string> = {
  [PREMIUM_MONTHLY_PRODUCT_ID]: 'monthlybase',
  [PREMIUM_YEARLY_PRODUCT_ID]: 'yearlybaseplan',
}

/** Bounded timeout for non-interactive billing queries (product details). */
export const BILLING_PRODUCT_QUERY_TIMEOUT_MS = 8000

/** Bounded timeout for reading the auth session before billing API calls. */
export const BILLING_AUTH_TIMEOUT_MS = 8000

/** Bounded timeout for restore-purchases (native bridge may hang). */
export const BILLING_RESTORE_TIMEOUT_MS = 15000

/** Timeout for the verify/status network calls. */
export const BILLING_VERIFY_TIMEOUT_MS = 10000

/**
 * Safety-net timeout for the whole Upgrade tap flow (purchase + verify +
 * status refresh). Last-resort guard only — every settled path below it
 * reports the real stage/code; this never hides the underlying failure.
 */
export const PREMIUM_PURCHASE_SAFETY_NET_MS = 30000

/** Max coaching-history snapshots retained per AI Coach session (in-memory). */
export const COACH_HISTORY_LIMIT = 100

/**
 * Grace window after a bare games-row GAME_OVER is observed before assuming
 * peer abandonment. The row carries no termination reason — the authoritative
 * match_timeout / match_abandoned broadcast (sent BEFORE the row write)
 * normally arrives first and sets the true result. Only when nothing
 * authoritative arrives within this window do we fall back to abandonment.
 */
export const DB_GAME_OVER_GRACE_MS = 4000

export type PlayerColor = 'white' | 'black' | 'random'

export type ResolvedColor = 'white' | 'black'

export const DEFAULT_PLAYER_COLOR: PlayerColor = 'white'

export const BROWSER_BOT_LEVEL = 3

export const SELECTED_COLOR_KEY = 'chessduo_selected_color'

export function resolvePlayerColor(color: PlayerColor): ResolvedColor {
  if (color === 'random') {
    return Math.random() < 0.5 ? 'white' : 'black'
  }
  return color
}
