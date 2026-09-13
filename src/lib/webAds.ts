import { Capacitor } from '@capacitor/core'

// Web AdSense counterpart to `nativeAd.ts` (Android Native Advanced).
// Same contract, inverted platform gate: web-only, best effort, never gates UI.
// Auto ads are OFF — only the single approved responsive display unit
// (chessduo_gameover_responsive) is ever rendered, inside game-over modals.

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

export function getAdSenseClientId(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || ''
}

export function getAdSenseSlotId(): string {
  return process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID?.trim() || ''
}

export function canUseWebAds(): boolean {
  return (
    typeof window !== 'undefined' &&
    !Capacitor.isNativePlatform() &&
    !!getAdSenseClientId() &&
    !!getAdSenseSlotId()
  )
}

export function pushWebAd(): boolean {
  if (!canUseWebAds()) return false

  try {
    window.adsbygoogle = window.adsbygoogle || []
    window.adsbygoogle.push({})
    return true
  } catch {
    // Ad blocker or AdSense load failure leaves the existing popup usable.
    return false
  }
}
