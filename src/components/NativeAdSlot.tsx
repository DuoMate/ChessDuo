'use client'

import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePremium } from '@/hooks/usePremium'
import { hideNativeAd, preloadNativeAd, showNativeAd } from '@/lib/nativeAd'
import { DEBUG } from '@/lib/debug'

export function NativeAdSlot({ open, gameOverReason }: { open: boolean; gameOverReason?: string | null }) {
  const slotRef = useRef<HTMLDivElement>(null)
  const { isPremium, loading } = usePremium()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open || loading || isPremium || !Capacitor.isNativePlatform()) return

    let active = true
    DEBUG && console.log('[ADS][GAMEOVER]', JSON.stringify({
      reason: gameOverReason || 'unknown',
      popupMounted: true,
      adLoadRequested: true,
      adLoadSucceeded: false,
      adLoadFailed: false,
      errorCode: null,
      errorMessage: null,
      nativeAdPresent: false,
      nativeAdViewRendered: false,
      popupVisible: open,
    }))
    preloadNativeAd().then((loaded) => {
      if (!active) return
      DEBUG && console.log('[ADS][GAMEOVER]', JSON.stringify({
        reason: gameOverReason || 'unknown',
        popupMounted: true,
        adLoadRequested: true,
        adLoadSucceeded: loaded,
        adLoadFailed: !loaded,
        errorCode: null,
        errorMessage: loaded ? null : 'Native ad preload failed; see Android logcat',
        nativeAdPresent: loaded,
        nativeAdViewRendered: false,
        popupVisible: open,
      }))
      setReady(loaded)
    })

    return () => {
      active = false
      setReady(false)
    }
  }, [gameOverReason, isPremium, loading, open])

  useEffect(() => {
    if (!open || !ready || loading || isPremium || !Capacitor.isNativePlatform()) return

    const slot = slotRef.current
    if (!slot) return

    let active = true
    const render = () => {
      if (!active) return
      const bounds = slot.getBoundingClientRect()
      void showNativeAd({
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }).then((rendered) => {
        DEBUG && console.log('[ADS][GAMEOVER]', JSON.stringify({
          reason: gameOverReason || 'unknown',
          popupMounted: true,
          adLoadRequested: true,
          adLoadSucceeded: true,
          adLoadFailed: false,
          errorCode: null,
          errorMessage: null,
          nativeAdPresent: true,
          nativeAdViewRendered: rendered,
          popupVisible: open,
        }))
      })
    }

    const frame = requestAnimationFrame(render)
    window.addEventListener('resize', render)
    window.addEventListener('scroll', render, true)

    return () => {
      active = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', render)
      window.removeEventListener('scroll', render, true)
      void hideNativeAd()
    }
  }, [gameOverReason, isPremium, loading, open, ready])

  if (!open || !ready || loading || isPremium || !Capacitor.isNativePlatform()) return null

  return <div ref={slotRef} aria-hidden="true" className="my-4 h-[180px] w-full overflow-hidden rounded-2xl" />
}
