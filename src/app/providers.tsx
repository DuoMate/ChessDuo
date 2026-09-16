'use client'

import { ToastProvider } from '@/components/Toast'
import { NetworkOverlay } from '@/components/NetworkOverlay'
import { Suspense, useEffect, type ReactNode } from 'react'
import Loading from '@/app/loading'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { registerCapacitorAuthListener } from '@/lib/capacitorAuth'
import { registerBackButtonListener } from '@/hooks/useCapacitorBackButton'
import { SplashHandler } from '@/components/SplashHandler'
import { useScrollToTop } from '@/hooks/useScrollToTop'
import { useRouter } from 'next/navigation'
import { initPushNotifications, clearCachedAccessToken, setCachedAccessToken, resetPushState } from '@/features/push-notifications'
import { SubscriptionService, GooglePlayBillingProvider } from '@/features/billing'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { createEvaluator } from '@/features/mobile-engine/evaluatorFactory'
import { useNotificationRedirect } from '@/hooks/useNotificationRedirect'
import { PremiumProvider } from '@/hooks/usePremium'
import { PremiumCornerBadge } from '@/components/PremiumCornerBadge'
import { preloadNativeAd } from '@/lib/nativeAd'

function NetworkAwareToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <NetworkOverlay />
      <Suspense fallback={<Loading />}>
        {children}
      </Suspense>
    </ToastProvider>
  )
}

export default function Providers({ children }: { children: ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    registerCapacitorAuthListener({ navigate: (path) => router.replace(path) }).catch(() => {})
    registerBackButtonListener()
    SubscriptionService.setProvider(GooglePlayBillingProvider)
    void preloadNativeAd()

    // Pre-warm Stockfish WASM evaluator so it's ready when bots need to move
    // (especially critical when human plays as Black - White bots move first).
    // P2 perf: deferred to browser idle so worker spawn + ~340K WASM
    // download/compile never contends with home-page TTI on mid-range WebView.
    // Still warms in the background well before typical game entry (home →
    // mode pick → lobby), preserving Black-first latency. Singleton in
    // evaluatorFactory — game engines call createEvaluator() on construct too,
    // so readiness for actual games is unchanged even if idle never fires.
    const warmStockfish = () => { try { createEvaluator() } catch { /* worker unavailable — engine constructs lazily per game */ } }
    let idleId: number | null = null
    let fallbackId: ReturnType<typeof setTimeout> | null = null
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(warmStockfish, { timeout: 8000 })
    } else {
      fallbackId = setTimeout(warmStockfish, 3000)
    }
    return () => {
      if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId)
      }
      if (fallbackId) clearTimeout(fallbackId)
    }
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Service worker registration failed:', err)
      })
    }

    const unsubscribe = AuthService.onAuthChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        const token = session?.access_token || ''
        if (token) {
          initPushNotifications(token).catch(() => {})
          SubscriptionService.initialize().catch(() => {})
        }
      }
      if (event === 'TOKEN_REFRESHED') {
        const token = session?.access_token || ''
        if (token) {
          setCachedAccessToken(token)
        }
      }
      if (event === 'SIGNED_OUT') {
        clearCachedAccessToken()
        resetPushState().catch(() => {})
        try { localStorage.removeItem('chessduo_push_last_error') } catch { /* quota exceeded */ }
      }
    })

    return () => unsubscribe()
  }, [])

  useScrollToTop()
  useNotificationRedirect()

  return (
    <NetworkAwareToastProvider>
      <PremiumProvider>
        <SplashHandler />
        <PremiumCornerBadge />
        {children}
      </PremiumProvider>
    </NetworkAwareToastProvider>
  )
}
