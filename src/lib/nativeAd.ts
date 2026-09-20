import { Capacitor, registerPlugin } from '@capacitor/core'
import { DEBUG } from './debug'

export interface NativeAdBounds {
  x: number
  y: number
  width: number
  height: number
}

interface NativeAdPlugin {
  preload(options: { adUnitId: string }): Promise<void>
  show(options: NativeAdBounds): Promise<void>
  hide(): Promise<void>
  discardLoadedAd(): Promise<void>
}

const NativeAd = registerPlugin<NativeAdPlugin>('NativeAd')
let preloadPromise: Promise<boolean> | null = null
let loadedAdUnitId: string | null = null
let loadedAtMs: number | null = null

/**
 * Last native-side failure detail (ADS-01 diagnostics). Native `reject`s
 * carry the AdMob error code (e.g. ERROR_CODE_NO_FILL) which previously
 * never left logcat — the JS layer reported only a boolean. Callers keep
 * their boolean contract; diagnostics read this accessor. No PII: codes and
 * SDK messages only, never user/game data.
 */
export interface AdError {
  code: string | null
  message: string | null
}

let lastAdError: AdError | null = null
let adRequestCounter = 0

export function getLastAdError(): AdError | null {
  return lastAdError ? { ...lastAdError } : null
}

export function clearAdError(): void {
  lastAdError = null
}

function toAdError(e: unknown): AdError {
  const err = e as { code?: unknown; message?: unknown } | null | undefined
  const code = typeof err?.code === 'number' || typeof err?.code === 'string' ? String(err.code) : null
  const message = e instanceof Error ? e.message : typeof err?.message === 'string' ? err.message : String(e ?? 'unknown')
  return { code, message }
}

function logBridge(stage: string, requestId: number, extra?: Record<string, unknown>): void {
  if (!DEBUG) return
  console.log('[ADS][BRIDGE]', JSON.stringify({ stage, requestId, ...extra }))
}
/**
 * How long a preloaded (not yet shown) ad is trusted. Showing consumes the
 * ad on both sides, so a cache hit can only ever serve the current game's
 * prefetch — but a preload from a previous game that was never shown must
 * not survive indefinitely. Past the TTL the next preload fetches fresh.
 */
export const NATIVE_AD_TTL_MS = 60 * 60 * 1000

/**
 * Bounded preload retry (ADS-02). Transient load failures (network blips,
 * cold SDK) get a second chance without spinning: at most this many native
 * attempts per preload() call, with backoff between them. Never retries from
 * a native onAdFailedToLoad loop — the bound lives here, centrally.
 */
export const PRELOAD_MAX_ATTEMPTS = 3
const PRELOAD_RETRY_DELAYS_MS = [500, 1500]

/**
 * Cooldown for show-failure refills (ADS-02). A failed show consumes the
 * cache; the refill below restores availability for the NEXT placement —
 * but show can fail repeatedly (e.g. torn-down view), so refills are
 * rate-limited to one per window. This recovers availability without
 * manufacturing ad requests.
 */
const SHOW_REFILL_COOLDOWN_MS = 60 * 1000
let lastRefillAtMs = 0

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms) })

function getAdUnitId(): string {
  return process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID?.trim() || ''
}

function canUseNativeAd(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && !!getAdUnitId()
}

export async function preloadNativeAd(opts?: { retryDelaysMs?: number[]; maxAttempts?: number }): Promise<boolean> {
  if (!canUseNativeAd()) return false

  const adUnitId = getAdUnitId()
  if (loadedAdUnitId === adUnitId && loadedAtMs !== null && Date.now() - loadedAtMs <= NATIVE_AD_TTL_MS) return true
  // Stale or mismatched cache entry — drop it so this call fetches fresh.
  loadedAdUnitId = null
  loadedAtMs = null
  if (preloadPromise) return preloadPromise

  const retryDelays = opts?.retryDelaysMs ?? PRELOAD_RETRY_DELAYS_MS
  const maxAttempts = opts?.maxAttempts ?? PRELOAD_MAX_ATTEMPTS
  preloadPromise = (async () => {
    const requestId = ++adRequestCounter
    logBridge('AD_REQUEST_STARTED', requestId, { op: 'preload' })
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await NativeAd.preload({ adUnitId })
        loadedAdUnitId = adUnitId
        loadedAtMs = Date.now()
        lastAdError = null
        logBridge('AD_LOAD_SUCCESS', requestId, { op: 'preload', attempt })
        return true
      } catch (e) {
        lastAdError = toAdError(e)
        logBridge('AD_LOAD_FAILED', requestId, { op: 'preload', attempt, ...lastAdError })
        if (attempt < maxAttempts) {
          await sleep(retryDelays[attempt - 1] ?? 0)
        }
      }
    }
    // Best effort: load failures must never affect game flow.
    loadedAdUnitId = null
    loadedAtMs = null
    return false
  })()

  try {
    return await preloadPromise
  } finally {
    preloadPromise = null
  }
}

export async function showNativeAd(bounds: NativeAdBounds): Promise<boolean> {
  if (!canUseNativeAd()) return false
  if (bounds.width <= 0 || bounds.height <= 0) return false

  const requestId = ++adRequestCounter
  logBridge('AD_REQUEST_STARTED', requestId, { op: 'show', width: bounds.width, height: bounds.height })
  try {
    await NativeAd.show(bounds)
    loadedAdUnitId = null
    loadedAtMs = null
    lastAdError = null
    logBridge('AD_CONSUMED', requestId, { op: 'show' })
    // ADS-03 consume → refill: proactively load the NEXT ad for the next
    // eligible placement (single attempt, single-flight deduped — the next
    // warmup/slot-open carries the full retry bound). MAX_READY stays 1.
    void preloadNativeAd({ maxAttempts: 1 }).catch(() => {
      // Best effort — preload() already records the error for diagnostics.
    })
    return true
  } catch (e) {
    // No-fill or native SDK failure leaves the existing popup usable.
    // The spent cache is refilled (cooldown-guarded) so the NEXT placement
    // has an ad — without manufacturing requests on every failed show.
    lastAdError = toAdError(e)
    logBridge('AD_LOAD_FAILED', requestId, { op: 'show', ...lastAdError })
    loadedAdUnitId = null
    loadedAtMs = null
    maybeRefillAfterShowFailure()
    return false
  }
}

/**
 * Cooldown-guarded background refill after a failed show (ADS-02). Fire and
 * forget: best effort, never throws, single-flight deduped by preload().
 * Single attempt (no backoff sleeps) so background recovery can never leak
 * slow timers across game sessions; the next foreground preload carries the
 * full retry bound.
 */
function maybeRefillAfterShowFailure(): void {
  const now = Date.now()
  if (now - lastRefillAtMs < SHOW_REFILL_COOLDOWN_MS) return
  lastRefillAtMs = now
  logBridge('NEXT_AD_PRELOAD_STARTED', ++adRequestCounter, { op: 'refill-after-show-failure' })
  void preloadNativeAd({ maxAttempts: 1 }).catch(() => {
    // Best effort — preload() already records the error for diagnostics.
  })
}

export async function hideNativeAd(): Promise<void> {
  if (!canUseNativeAd()) return

  try {
    await NativeAd.hide()
  } catch {
    // The native view may already be gone during route teardown.
  }
}

/**
 * Discards a preloaded-but-never-shown ad (ADS-03). Used when the user
 * becomes premium (cached ads must never serve afterwards) — future
 * preloads are already gated by callers checking premium state. Clears both
 * layers best-effort and never throws. No user-facing effect.
 */
export async function discardPreloadedAd(): Promise<void> {
  loadedAdUnitId = null
  loadedAtMs = null
  if (!canUseNativeAd()) return

  try {
    await NativeAd.discardLoadedAd()
  } catch {
    // Native side may be gone (teardown) — the JS cache is already clear.
  }
}
