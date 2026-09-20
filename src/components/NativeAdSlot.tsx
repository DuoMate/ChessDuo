'use client'

import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePremium } from '@/hooks/usePremium'
import { hideNativeAd, preloadNativeAd, showNativeAd, getLastAdError } from '@/lib/nativeAd'
import { DEBUG } from '@/lib/debug'

type AdSurface = 'game_over' | 'upgrade'

export function NativeAdSlot({ open, gameOverReason, surface = 'game_over' }: { open: boolean; gameOverReason?: string | null; surface?: AdSurface }) {
  const slotRef = useRef<HTMLDivElement>(null)
  const { isPremium, loading } = usePremium()
  const [ready, setReady] = useState(false)
  // ADS-02: at most one delayed re-show per show-effect lifetime. A failed
  // show consumes the cache and kicks a background refill; this single retry
  // (not a loop) gives the refill a chance to land without depending on the
  // user scrolling. Never manufactures impressions: the placement stays open
  // and visible throughout.
  const reshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reshowDoneRef = useRef(false)
  // gameOverReason is display/logging-only: track it in a ref so a reason
  // change while open never tears down a loaded ad or re-fires show (show
  // consumes the ad, so a teardown + re-show without fresh fill would blank it).
  const reasonRef = useRef(gameOverReason)
  useEffect(() => {
    reasonRef.current = gameOverReason
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!open || loading || isPremium || !Capacitor.isNativePlatform()) return

    let active = true
    DEBUG && console.log(`[ADS][${surface === 'upgrade' ? 'UPGRADE' : 'GAMEOVER'}]`, JSON.stringify({
      surface,
      reason: reasonRef.current || 'unknown',
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
      const lastError = loaded ? null : getLastAdError()
      DEBUG && console.log(`[ADS][${surface === 'upgrade' ? 'UPGRADE' : 'GAMEOVER'}]`, JSON.stringify({
        surface,
        reason: reasonRef.current || 'unknown',
        popupMounted: true,
        adLoadRequested: true,
        adLoadSucceeded: loaded,
        adLoadFailed: !loaded,
        errorCode: lastError?.code ?? null,
        errorMessage: loaded ? null : (lastError?.message ?? 'Native ad preload failed; see Android logcat'),
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
  }, [isPremium, loading, open, surface])

  useEffect(() => {
    if (typeof window === 'undefined') return
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
        if (!active) return
        const lastError = rendered ? null : getLastAdError()
        // ADS-02: one delayed re-show if this attempt failed — the failed
        // show already triggered a background refill, so a single later
        // attempt can recover a visible ad (e.g. transient native loss).
        if (!rendered && !reshowDoneRef.current) {
          reshowDoneRef.current = true
          reshowTimerRef.current = setTimeout(() => {
            reshowTimerRef.current = null
            render()
          }, 2500)
        }
        DEBUG && console.log(`[ADS][${surface === 'upgrade' ? 'UPGRADE' : 'GAMEOVER'}]`, JSON.stringify({
          surface,
          reason: reasonRef.current || 'unknown',
          popupMounted: true,
          adLoadRequested: true,
          adLoadSucceeded: true,
          adLoadFailed: false,
          errorCode: lastError?.code ?? null,
          errorMessage: lastError?.message ?? null,
          nativeAdPresent: true,
          nativeAdViewRendered: rendered,
          popupVisible: open,
        }))
      })
    }

    // Throttle reposition-driven re-shows to one per frame (every scroll
    // pixel previously re-invoked the native show bridge), and retry across
    // a few frames so the first render landing mid modal spring animation
    // (zero/wrong bounds) still positions the ad without user scrolling.
    let rafId = 0
    const schedule = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        render()
      })
    }
    const frame = requestAnimationFrame(render)
    const retryFrame = requestAnimationFrame(() => {
      requestAnimationFrame(render)
    })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)

    return () => {
      active = false
      cancelAnimationFrame(frame)
      cancelAnimationFrame(retryFrame)
      if (rafId) cancelAnimationFrame(rafId)
      if (reshowTimerRef.current) {
        clearTimeout(reshowTimerRef.current)
        reshowTimerRef.current = null
      }
      reshowDoneRef.current = false
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      void hideNativeAd()
    }
  }, [isPremium, loading, open, ready, surface])

  if (!open || !ready || loading || isPremium || !Capacitor.isNativePlatform()) return null

  return <div ref={slotRef} aria-hidden="true" className="my-4 h-[180px] w-full overflow-hidden rounded-2xl" />
}
