'use client'

import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { usePremium } from '@/hooks/usePremium'
import { hideNativeAd, preloadNativeAd, showNativeAd } from '@/lib/nativeAd'

export function NativeAdSlot() {
  const slotRef = useRef<HTMLDivElement>(null)
  const { isPremium, loading } = usePremium()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading || isPremium || !Capacitor.isNativePlatform()) return

    let active = true
    preloadNativeAd().then((loaded) => {
      if (active) setReady(loaded)
    })

    return () => {
      active = false
      setReady(false)
    }
  }, [isPremium, loading])

  useEffect(() => {
    if (!ready || loading || isPremium || !Capacitor.isNativePlatform()) return

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
  }, [isPremium, loading, ready])

  if (!ready || loading || isPremium || !Capacitor.isNativePlatform()) return null

  return <div ref={slotRef} aria-hidden="true" className="my-4 h-[180px] w-full overflow-hidden rounded-2xl" />
}
