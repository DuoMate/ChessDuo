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

function getAdUnitId(): string {
  return process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID?.trim() || ''
}

function canUseNativeAd(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && !!getAdUnitId()
}

export async function preloadNativeAd(): Promise<boolean> {
  if (!canUseNativeAd()) return false

  const adUnitId = getAdUnitId()
  if (loadedAdUnitId === adUnitId && loadedAtMs !== null && Date.now() - loadedAtMs <= NATIVE_AD_TTL_MS) return true
  // Stale or mismatched cache entry — drop it so this call fetches fresh.
  loadedAdUnitId = null
  loadedAtMs = null
  if (preloadPromise) return preloadPromise

  preloadPromise = (async () => {
    const requestId = ++adRequestCounter
    logBridge('AD_REQUEST_STARTED', requestId, { op: 'preload' })
    try {
      await NativeAd.preload({ adUnitId })
      loadedAdUnitId = adUnitId
      loadedAtMs = Date.now()
      lastAdError = null
      logBridge('AD_LOAD_SUCCESS', requestId, { op: 'preload' })
      return true
    } catch (e) {
      // Native ad loading is best effort and must never affect game flow.
      lastAdError = toAdError(e)
      logBridge('AD_LOAD_FAILED', requestId, { op: 'preload', ...lastAdError })
      loadedAdUnitId = null
      loadedAtMs = null
      return false
    } finally {
      preloadPromise = null
    }
  })()

  return preloadPromise
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
    return true
  } catch (e) {
    // No-fill or native SDK failure leaves the existing popup usable.
    lastAdError = toAdError(e)
    logBridge('AD_LOAD_FAILED', requestId, { op: 'show', ...lastAdError })
    loadedAdUnitId = null
    loadedAtMs = null
    return false
  }
}

export async function hideNativeAd(): Promise<void> {
  if (!canUseNativeAd()) return

  try {
    await NativeAd.hide()
  } catch {
    // The native view may already be gone during route teardown.
  }
}
