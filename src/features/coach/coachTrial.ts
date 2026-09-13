import { COACH_TRIAL_WINDOW_MS } from '../shared/gameConstants'

/**
 * AI Coach daily-trial layer (isolated monetization).
 *
 * Rule: 1 free Coach game per rolling 24h window for non-premium users.
 * - Premium users bypass the trial entirely (unlimited).
 * - Trial is consumed when a game actually STARTS (idle -> playing), never on
 *   screen open / menu tap / premium dialog / back-out.
 * - Authoritative store: `profiles.coach_last_free_game_at` (server timestamp).
 *   Local mirror (`chessduo_coach_trial_{userId}`) keeps the gate working
 *   pre-migration and offline. Server wins when both exist (max timestamp).
 * - Claim is idempotent per mount session: double-tap / StrictMode / remount /
 *   duplicate game-over callbacks can never consume twice.
 */

export interface CoachTrialState {
  isPremium: boolean
  eligible: boolean
  lastFreeGameAt: string | null
  nextEligibleAt: string | null
  loading: boolean
}

const STORAGE_PREFIX = 'chessduo_coach_trial'

/** Sessions that already claimed (in-memory idempotency for double-mount). */
const claimedSessions = new Set<string>()

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}_${userId}`
}

function readLocal(userId: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lastFreeGameAt?: string | null }
    return parsed?.lastFreeGameAt || null
  } catch {
    // localStorage unavailable — treat as never used; server remains authoritative.
    return null
  }
}

function writeLocal(userId: string, iso: string): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ lastFreeGameAt: iso }))
  } catch {
    // Silently ignore quota/private-mode failures; server remains authoritative.
  }
}

/** Pure: is `lastIso` old enough for a new free game at `nowMs`? */
export function isTrialEligible(lastIso: string | null, nowMs: number, windowMs = COACH_TRIAL_WINDOW_MS): boolean {
  if (!lastIso) return true
  const lastMs = new Date(lastIso).getTime()
  if (Number.isNaN(lastMs)) return true
  return nowMs - lastMs >= windowMs
}

/** Pure: when does the next free game unlock? Null when already eligible. */
export function nextEligibleAt(lastIso: string | null, nowMs: number, windowMs = COACH_TRIAL_WINDOW_MS): string | null {
  if (isTrialEligible(lastIso, nowMs, windowMs)) return null
  const lastMs = new Date(lastIso as string).getTime()
  return new Date(lastMs + windowMs).toISOString()
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

async function readServerTimestamp(userId: string): Promise<{ iso: string | null; persisted: boolean }> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('profiles')
      .select('coach_last_free_game_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) return { iso: null, persisted: false }
    const iso = (data as { coach_last_free_game_at?: string | null } | null)?.coach_last_free_game_at || null
    return { iso, persisted: true }
  } catch {
    // Pre-migration (column missing), offline, or client unavailable.
    return { iso: null, persisted: false }
  }
}

export async function getCoachTrialState(userId: string, nowMs = Date.now()): Promise<CoachTrialState> {
  let isPremium = false
  let serverIso: string | null = null
  let serverReachable = false

  try {
    const { SubscriptionService } = await import('../billing')
    const status = await SubscriptionService.getStatus()
    isPremium = status.isPremium === true
    // Prefer server-computed eligibility when the status route knows the column.
    if (typeof status.coachLastFreeGameAt !== 'undefined') {
      serverIso = status.coachLastFreeGameAt || null
      serverReachable = true
      if (isPremium) {
        return { isPremium, eligible: true, lastFreeGameAt: serverIso, nextEligibleAt: null, loading: false }
      }
      if (typeof status.coachFreeEligible === 'boolean') {
        return {
          isPremium,
          eligible: status.coachFreeEligible,
          lastFreeGameAt: serverIso,
          nextEligibleAt: status.coachNextEligibleAt || nextEligibleAt(serverIso, nowMs),
          loading: false,
        }
      }
    }
  } catch {
    // Subscription lookup failed — fall through to direct read (fail-closed below).
  }

  if (!serverReachable) {
    const direct = await readServerTimestamp(userId)
    if (direct.persisted) {
      serverIso = direct.iso
      serverReachable = true
    }
  }

  const localIso = readLocal(userId)
  // Server wins when newer; otherwise local mirror keeps pre-migration working.
  const lastFreeGameAt =
    serverIso && localIso
      ? new Date(serverIso).getTime() >= new Date(localIso).getTime()
        ? serverIso
        : localIso
      : (serverIso ?? localIso)

  if (isPremium) {
    return { isPremium, eligible: true, lastFreeGameAt, nextEligibleAt: null, loading: false }
  }
  const eligible = isTrialEligible(lastFreeGameAt, nowMs)
  return { isPremium, eligible, lastFreeGameAt, nextEligibleAt: nextEligibleAt(lastFreeGameAt, nowMs), loading: false }
}

/**
 * Consume the daily free game. Call exactly at game START (idle -> playing).
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
  if (before.isPremium) {
    claimedSessions.add(sessionId)
    return { claimed: true, persisted: true, state: before }
  }
  if (!before.eligible) {
    return { claimed: false, persisted: true, state: before }
  }

  const iso = new Date(nowMs).toISOString()
  claimedSessions.add(sessionId)
  writeLocal(userId, iso)

  let persisted = false
  try {
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase.from('profiles').update({ coach_last_free_game_at: iso }).eq('id', userId)
    persisted = !error
  } catch {
    persisted = false
  }

  if (!persisted) {
    // Allow a retry (e.g. on game over): the local mirror holds the claim so
    // the gate stays consistent, but the in-memory session lock is released.
    claimedSessions.delete(sessionId)
  }

  const state: CoachTrialState = {
    isPremium: false,
    eligible: false,
    lastFreeGameAt: iso,
    nextEligibleAt: new Date(nowMs + COACH_TRIAL_WINDOW_MS).toISOString(),
    loading: false,
  }
  return { claimed: true, persisted, state }
}

/** Test/shutdown helper: clear in-memory claim set. */
export function __clearClaimedSessions(): void {
  claimedSessions.clear()
}
