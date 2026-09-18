import { Capacitor, registerPlugin } from '@capacitor/core'

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
    try {
      await NativeAd.preload({ adUnitId })
      loadedAdUnitId = adUnitId
      loadedAtMs = Date.now()
      return true
    } catch {
      // Native ad loading is best effort and must never affect game flow.
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

  try {
    await NativeAd.show(bounds)
    loadedAdUnitId = null
    loadedAtMs = null
    return true
  } catch {
    // No-fill or native SDK failure leaves the existing popup usable.
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
