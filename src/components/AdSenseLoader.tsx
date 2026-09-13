'use client'

import Script from 'next/script'
import { Capacitor } from '@capacitor/core'
import { usePremium } from '@/hooks/usePremium'
import { getAdSenseClientId } from '@/lib/webAds'

// Loads the AdSense base script once for web non-premium users.
// Mirrors the NativeAdSlot suppression inversely: native/premium/missing-ID → null.
// Manual display units (AdSenseSlot) render nothing without this script.
export function AdSenseLoader() {
  const { isPremium, loading } = usePremium()

  if (loading || isPremium) return null
  if (typeof window === 'undefined') return null
  if (Capacitor.isNativePlatform()) return null

  const clientId = getAdSenseClientId()
  if (!clientId) return null

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
