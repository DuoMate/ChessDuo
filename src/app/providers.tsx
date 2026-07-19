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
import { initPushNotifications, clearCachedAccessToken, setCachedAccessToken, resetPushState } from '@/features/push-notifications'
import { SubscriptionService, GooglePlayBillingProvider } from '@/features/billing'
import { supabase } from '@/lib/supabase'
import { createEvaluator } from '@/features/mobile-engine/evaluatorFactory'

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
  useEffect(() => {
    registerCapacitorAuthListener().catch(() => {})
    registerBackButtonListener()
    SubscriptionService.setProvider(GooglePlayBillingProvider)
    
    // Pre-warm Stockfish WASM evaluator so it's ready when bots need to move
    // (especially critical when human plays as Black - White bots move first)
    createEvaluator()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Service worker registration failed:', err)
      })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
        localStorage.removeItem('chessduo_push_welcome_sent')
        try { localStorage.removeItem('chessduo_push_last_error') } catch { /* quota exceeded */ }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useScrollToTop()

  return (
    <NetworkAwareToastProvider>
      <SplashHandler />
      {children}
    </NetworkAwareToastProvider>
  )
}
