'use client'

import { useEffect, useRef } from 'react'
import { usePremium } from '@/hooks/usePremium'
import { canUseWebAds, getAdSenseClientId, getAdSenseSlotId, pushWebAd } from '@/lib/webAds'
import { DEBUG } from '@/lib/debug'

// Web AdSense counterpart to NativeAdSlot: single responsive display unit
// (chessduo_gameover_responsive) inside game-over modals only.
// Suppression mirrors NativeAdSlot inversely — hidden on native, for premium
// users, and when the ad cannot serve. Best effort, never blocks the modal.
export function AdSenseSlot({ open, gameOverReason }: { open: boolean; gameOverReason?: string | null }) {
  const { isPremium, loading } = usePremium()
  const pushedRef = useRef(false)

  const ready = open && !loading && !isPremium && canUseWebAds()

  useEffect(() => {
    if (!ready) {
      pushedRef.current = false
      return
    }
    if (pushedRef.current) return
    pushedRef.current = true

    const rendered = pushWebAd()
    DEBUG && console.log('[ADS][GAMEOVER]', JSON.stringify({
      source: 'adsense',
      reason: gameOverReason || 'unknown',
      popupMounted: true,
      adLoadRequested: true,
      adLoadSucceeded: rendered,
      adLoadFailed: !rendered,
      errorCode: null,
      errorMessage: rendered ? null : 'AdSense push failed; ad blocker or script not loaded',
      popupVisible: open,
    }))
  }, [gameOverReason, open, ready])

  if (!ready) return null

  return (
    <div aria-hidden="true" className="my-4 min-h-[120px] w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
      <ins
        className="adsbygoogle block w-full"
        data-ad-client={getAdSenseClientId()}
        data-ad-slot={getAdSenseSlotId()}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
