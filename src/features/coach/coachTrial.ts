import { AI_COACH_FREE_DAILY_LIMIT, AI_COACH_FREE_DAILY_LIMIT_ENABLED } from '../shared/gameConstants'

/**
 * AI Coach daily-trial layer (isolated monetization).
 *
 * Rule: `AI_COACH_FREE_DAILY_LIMIT` free Coach games per UTC calendar day
 * for non-premium users (single source of truth:
 * `src/features/shared/gameConstants.ts` — change the constant only).
 * - Premium users bypass the trial entirely (unlimited).
 * - When `AI_COACH_FREE_DAILY_LIMIT_ENABLED` is false, free users are not
 *   quota-limited (no enforcement, no remaining/limit messaging).
 * - Trial is consumed when a game actually STARTS (idle -> playing), never on
 *   screen open / menu tap / premium dialog / back-out.
 * - Authoritative store: `profiles.coach_free_day` (UTC `YYYY-MM-DD`) +
 *   `profiles.coach_free_count`, with `profiles.coach_last_free_game_at`
 *   maintained for backward compatibility. Local mirror
 *   (`chessduo_coach_trial_{userId}`) keeps the gate working pre-migration
 *   and offline. Server wins when reachable; local covers un-persisted claims.
 * - Claim is idempotent per mount session: double-tap / StrictMode / remount /
 *   duplicate game-over callbacks can never consume twice.
 */

export interface CoachTrialState {
  isPremium: boolean
  eligible: boolean
  lastFreeGameAt: string | null
  nextEligibleAt: string | null
  loading: boolean
  /** Games consumed today (UTC day). 0 for premium/unlimited. */
  usedToday: number
  /** Games left today. Equals the configured limit when unlimited. */
  remainingToday: number
  /** The configured daily allowance (mirrors `AI_COACH_FREE_DAILY_LIMIT`). */
  dailyLimit: number
}

const STORAGE_PREFIX = 'chessduo_coach_trial'

/** Sessions that already claimed (in-memory idempotency for double-mount). */
const claimedSessions = new Set<string>()

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}_${userId}`
}

// ── Central configuration accessors (single source of truth) ──

/** Maximum free AI Coach games per UTC calendar day. */
export function getAiCoachDailyLimit(): number {
  return AI_COACH_FREE_DAILY_LIMIT
}

/** Master switch for the free daily quota. */
export function isAiCoachLimitEnabled(): boolean {
  return AI_COACH_FREE_DAILY_LIMIT_ENABLED
}

// ── Centralized derived messages (no hardcoded "3 free games") ──

/** e.g. "3 free games every day" — derives the number from the config. */
export function getAiCoachDailyLimitMessage(): string {
  const limit = getAiCoachDailyLimit()
  return `${limit} free game${limit === 1 ? '' : 's'} every day`
}

/**
 * e.g. "2 free games left today" / "1 free game left today".
 * Null when exhausted (use `getAiCoachLimitReachedMessage`) or when the
 * limit is disabled (no remaining messaging).
 */
export function getAiCoachRemainingMessage(remaining: number): string | null {
  if (!isAiCoachLimitEnabled()) return null
  if (remaining <= 0) return null
  return remaining === 1 ? '1 free game left today' : `${remaining} free games left today`
}

/** e.g. "You've used your 3 free AI Coach games today." */
export function getAiCoachLimitReachedMessage(): string {
  const limit = getAiCoachDailyLimit()
  return `You've used your ${limit} free AI Coach game${limit === 1 ? '' : 's'} today.`
}

// ── Pure date/count helpers (UTC calendar day) ──

/** UTC calendar-day key (`YYYY-MM-DD`) for a timestamp. */
export function getCoachDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Remaining games for a consumed count (clamped at 0, follows the limit). */
export function getRemainingToday(usedToday: number, limit = getAiCoachDailyLimit()): number {
  return Math.max(0, limit - Math.max(0, usedToday))
}

/** Next UTC midnight after `nowMs` (when today's quota resets). */
export function nextMidnightUtc(nowMs: number): string {
  const d = new Date(nowMs)
  d.setUTCHours(24, 0, 0, 0)
  return d.toISOString()
}

/** Pure: is a consumed-today count still eligible? */
export function isEligibleToday(
  usedToday: number,
  nowMs: number,
  limit = getAiCoachDailyLimit(),
  enabled = isAiCoachLimitEnabled(),
): boolean {
  void nowMs
  if (!enabled) return true
  return getRemainingToday(usedToday, limit) > 0
}

/** Pure: when does quota reset? Null when already eligible. */
export function nextEligibleAtFromCount(usedToday: number, nowMs: number): string | null {
  if (isEligibleToday(usedToday, nowMs)) return null
  return nextMidnightUtc(nowMs)
}

interface LocalMirror {
  day: string | null
  count: number
  lastFreeGameAt: string | null
}

function readLocal(userId: string): LocalMirror {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { day: null, count: 0, lastFreeGameAt: null }
    const parsed = JSON.parse(raw) as { day?: string; count?: number; lastFreeGameAt?: string | null }
    // Current shape: { day, count, lastFreeGameAt }.
    if (typeof parsed?.day === 'string' && typeof parsed?.count === 'number') {
      return { day: parsed.day, count: Math.max(0, parsed.count), lastFreeGameAt: parsed.lastFreeGameAt || null }
    }
    // Legacy shape (1-per-rolling-24h era): { lastFreeGameAt } — treat a
    // same-day legacy claim as one consumed game.
    const legacyIso = parsed?.lastFreeGameAt || null
    if (legacyIso) {
      const ms = new Date(legacyIso).getTime()
      if (!Number.isNaN(ms)) {
        return { day: getCoachDayKey(ms), count: 1, lastFreeGameAt: legacyIso }
      }
    }
    return { day: null, count: 0, lastFreeGameAt: null }
  } catch {
    // localStorage unavailable — treat as never used; server remains authoritative.
    return { day: null, count: 0, lastFreeGameAt: null }
  }
}

function writeLocal(userId: string, day: string, count: number, iso: string): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ day, count, lastFreeGameAt: iso }))
  } catch {
    // Silently ignore quota/private-mode failures; server remains authoritative.
  }
}

/** Human countdown: "22h 14m" / "45m" / "soon". Pure, for gate + home copy. */
export function formatTrialCountdown(nextIso: string | null, nowMs: number): string | null {
  if (!nextIso) return null
  const diff = new Date(nextIso).getTime() - nowMs
  if (Number.isNaN(diff) || diff <= 0) return null
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.ceil((diff % 3_600_000) / 60_000)
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

interface ServerUsage {
  day: string | null
  count: number
  lastIso: string | null
  persisted: boolean
}

async function readServerUsage(userId: string): Promise<ServerUsage> {
  try {
    const { supabase } = await import('@/lib/supabase')
    // Preferred: daily count columns (tolerant — pre-migration DBs reject
    // unknown columns and fall through to the legacy timestamp below).
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('coach_free_day, coach_free_count, coach_last_free_game_at')
        .eq('id', userId)
        .maybeSingle()
      if (!error) {
        const row = (data as { coach_free_day?: string | null; coach_free_count?: number | null; coach_last_free_game_at?: string | null } | null) || null
        return {
          day: row?.coach_free_day || null,
          count: Math.max(0, row?.coach_free_count ?? 0),
          lastIso: row?.coach_last_free_game_at || null,
          persisted: true,
        }
      }
    } catch {
      // Fall through to legacy read.
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('coach_last_free_game_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) return { day: null, count: 0, lastIso: null, persisted: false }
    const iso = (data as { coach_last_free_game_at?: string | null } | null)?.coach_last_free_game_at || null
    if (!iso) return { day: null, count: 0, lastIso: null, persisted: true }
    const ms = new Date(iso).getTime()
    if (Number.isNaN(ms)) return { day: null, count: 0, lastIso: null, persisted: true }
    // Legacy single-timestamp era (1/day): a recorded game counts once.
    return { day: getCoachDayKey(ms), count: 1, lastIso: iso, persisted: true }
  } catch {
    // Pre-migration (column missing), offline, or client unavailable.
    return { day: null, count: 0, lastIso: null, persisted: false }
  }
}

/** Effective consumed-today count from server + local mirrors. */
function effectiveUsedToday(server: ServerUsage, local: LocalMirror, today: string): number {
  let used = 0
  if (server.persisted && server.day === today) used = Math.max(used, server.count)
  if (local.day === today) used = Math.max(used, local.count)
  // Legacy local timestamp without a day key but stamped today.
  if (!local.day && local.lastFreeGameAt) {
    const ms = new Date(local.lastFreeGameAt).getTime()
    if (!Number.isNaN(ms) && getCoachDayKey(ms) === today) used = Math.max(used, 1)
  }
  return used
}

function buildState(
  isPremium: boolean,
  usedToday: number,
  lastFreeGameAt: string | null,
  nowMs: number,
): CoachTrialState {
  const dailyLimit = getAiCoachDailyLimit()
  if (isPremium || !isAiCoachLimitEnabled()) {
    return { isPremium, eligible: true, lastFreeGameAt, nextEligibleAt: null, loading: false, usedToday: 0, remainingToday: dailyLimit, dailyLimit }
  }
  const remainingToday = getRemainingToday(usedToday, dailyLimit)
  const eligible = remainingToday > 0
  return {
    isPremium,
    eligible,
    lastFreeGameAt,
    nextEligibleAt: eligible ? null : nextMidnightUtc(nowMs),
    loading: false,
    usedToday,
    remainingToday,
    dailyLimit,
  }
}

export async function getCoachTrialState(userId: string, nowMs = Date.now()): Promise<CoachTrialState> {
  const today = getCoachDayKey(nowMs)
  let isPremium = false
  let serverIso: string | null = null
  let serverReachable = false
  let serverDay: string | null = null
  let serverCount = 0

  try {
    const { SubscriptionService } = await import('../billing')
    const status = await SubscriptionService.getStatus()
    isPremium = status.isPremium === true
    // Prefer server-computed usage when the status route knows the columns.
    if (typeof status.coachLastFreeGameAt !== 'undefined' || typeof status.coachFreeUsedToday !== 'undefined') {
      serverReachable = true
      serverIso = status.coachLastFreeGameAt || null
      if (typeof status.coachFreeUsedToday === 'number') {
        serverCount = Math.max(0, status.coachFreeUsedToday)
        serverDay = today
      } else if (serverIso) {
        const ms = new Date(serverIso).getTime()
        if (!Number.isNaN(ms) && getCoachDayKey(ms) === today) {
          serverDay = today
          serverCount = 1
        }
      }
      if (isPremium) {
        return buildState(true, 0, serverIso, nowMs)
      }
      if (typeof status.coachFreeEligible === 'boolean') {
        const local = readLocal(userId)
        const used = Math.max(
          serverDay === today ? serverCount : 0,
          local.day === today ? local.count : 0,
        )
        const state = buildState(false, used, serverIso ?? local.lastFreeGameAt, nowMs)
        // Trust the server's eligibility verdict when present (same inputs).
        return { ...state, eligible: status.coachFreeEligible, nextEligibleAt: status.coachNextEligibleAt || state.nextEligibleAt }
      }
    }
  } catch {
    // Subscription lookup failed — fall through to direct read (fail-closed below).
  }

  if (!serverReachable) {
    const direct = await readServerUsage(userId)
    if (direct.persisted) {
      serverReachable = true
      serverIso = direct.lastIso
      serverDay = direct.day
      serverCount = direct.count
    }
  }

  const local = readLocal(userId)
  const lastFreeGameAt = serverIso ?? local.lastFreeGameAt
  if (isPremium) {
    return buildState(true, 0, lastFreeGameAt, nowMs)
  }
  const used = effectiveUsedToday(
    { day: serverDay, count: serverCount, lastIso: serverIso, persisted: serverReachable },
    local,
    today,
  )
  const state = buildState(false, used, lastFreeGameAt, nowMs)
  // Fail-closed: when neither server nor local data is reachable AND the
  // limit is enabled, keep the previous fail-closed posture only if we have
  // no signal at all — a fresh user (no mirrors) stays eligible.
  void serverReachable
  return state
}

/**
 * Consume one daily free game. Call exactly at game START (idle -> playing).
 * Idempotent per `sessionId`: repeated calls for the same session claim once.
 * Returns `persisted:false` when the server write failed — the game continues
 * (it already started) and the caller may retry on game over.
 */
export async function claimCoachDailyTrial(
  userId: string,
  sessionId: string,
  nowMs = Date.now(),
): Promise<{ claimed: boolean; persisted: boolean; state: CoachTrialState }> {
  if (claimedSessions.has(sessionId)) {
    const state = await getCoachTrialState(userId, nowMs)
    return { claimed: true, persisted: true, state }
  }

  const before = await getCoachTrialState(userId, nowMs)
  if (before.isPremium || !isAiCoachLimitEnabled()) {
    claimedSessions.add(sessionId)
    return { claimed: false, persisted: true, state: before }
  }
  if (!before.eligible) {
    return { claimed: false, persisted: true, state: before }
  }

  const today = getCoachDayKey(nowMs)
  const iso = new Date(nowMs).toISOString()
  const nextCount = before.usedToday + 1
  claimedSessions.add(sessionId)
  writeLocal(userId, today, nextCount, iso)

  let persisted = false
  try {
    const { supabase } = await import('@/lib/supabase')
    const full = await supabase
      .from('profiles')
      .update({ coach_free_day: today, coach_free_count: nextCount, coach_last_free_game_at: iso })
      .eq('id', userId)
    if (!full.error) {
      persisted = true
    } else {
      // Pre-migration fallback: legacy timestamp column only.
      const legacy = await supabase.from('profiles').update({ coach_last_free_game_at: iso }).eq('id', userId)
      persisted = !legacy.error
    }
  } catch {
    persisted = false
  }

  if (!persisted) {
    // Allow a retry (e.g. on game over): the local mirror holds the claim so
    // the gate stays consistent, but the in-memory session lock is released.
    claimedSessions.delete(sessionId)
  }

  const remainingToday = getRemainingToday(nextCount)
  const state: CoachTrialState = {
    isPremium: false,
    eligible: remainingToday > 0,
    lastFreeGameAt: iso,
    nextEligibleAt: remainingToday > 0 ? null : nextMidnightUtc(nowMs),
    loading: false,
    usedToday: nextCount,
    remainingToday,
    dailyLimit: getAiCoachDailyLimit(),
  }
  return { claimed: true, persisted, state }
}

/** Test/shutdown helper: clear in-memory claim set. */
export function __clearClaimedSessions(): void {
  claimedSessions.clear()
}
