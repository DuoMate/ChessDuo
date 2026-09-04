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

function getAdUnitId(): string {
  return process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID?.trim() || ''
}

function canUseNativeAd(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && !!getAdUnitId()
}

export async function preloadNativeAd(): Promise<boolean> {
  if (!canUseNativeAd()) return false

  try {
    await NativeAd.preload({ adUnitId: getAdUnitId() })
    return true
  } catch {
    // Native ad loading is best effort and must never affect game flow.
    return false
  }
}

export async function showNativeAd(bounds: NativeAdBounds): Promise<void> {
  if (!canUseNativeAd()) return
  if (bounds.width <= 0 || bounds.height <= 0) return

  try {
    await NativeAd.show(bounds)
  } catch {
    // No-fill or native SDK failure leaves the existing popup usable.
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
