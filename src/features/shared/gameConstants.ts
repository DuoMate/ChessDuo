export const CHECKMATE_SCORE = 10000

export const DEFAULT_TEAM_TIMER_SECONDS = 600

export const DEFAULT_MOVE_TIMER_SECONDS = 10

export const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000

export const QUICK_MATCH_ROOM_EXPIRY_MS = 60_000

export const DEFAULT_POLLING_INTERVAL_MS = 2000

export const INSIGHTS_FREE_LIMIT = 3

/** Rolling window for the AI Coach daily free game (1 free game per 24h). */
export const COACH_TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000

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
