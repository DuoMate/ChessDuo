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

function getAdUnitId(): string {
  return process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID?.trim() || ''
}

function canUseNativeAd(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && !!getAdUnitId()
}

export async function preloadNativeAd(): Promise<boolean> {
  if (!canUseNativeAd()) return false

  const adUnitId = getAdUnitId()
  if (loadedAdUnitId === adUnitId) return true
  if (preloadPromise) return preloadPromise

  preloadPromise = (async () => {
    try {
      await NativeAd.preload({ adUnitId })
      loadedAdUnitId = adUnitId
      return true
    } catch {
      // Native ad loading is best effort and must never affect game flow.
      loadedAdUnitId = null
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
    return true
  } catch {
    // No-fill or native SDK failure leaves the existing popup usable.
    loadedAdUnitId = null
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
