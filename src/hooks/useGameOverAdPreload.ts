'use client'

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePremium } from '@/hooks/usePremium'
import { preloadNativeAd } from '@/lib/nativeAd'

/**
 * Preloads the Game Over native ad while a game is still active so the
 * terminal screen can render it with minimal delay.
 *
 * Safety contract (mirrors NativeAdSlot):
 * - Eligible FREE native users only (`usePremium` gate).
 * - Fires at most once per active session (ref-guarded, resets when `active`
 *   goes false so a remounted/next game can preload again).
 * - Best-effort: never throws, never blocks game flow or navigation.
 * - Web / premium / still-loading premium status → no-op (never invokes the
 *   native AdMob bridge off-platform).
 */
export function useGameOverAdPreload(active: boolean): void {
  const { isPremium, loading } = usePremium()
  const firedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      firedRef.current = false
      return
    }
    if (firedRef.current || loading || isPremium) return
    if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return
    firedRef.current = true
    void preloadNativeAd()
  }, [active, isPremium, loading])
}
