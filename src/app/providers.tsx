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
import { initPushNotifications } from '@/features/push-notifications'
import { SubscriptionService, GooglePlayBillingProvider } from '@/features/billing'
import { supabase } from '@/lib/supabase'

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
    SubscriptionService.initialize().catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Service worker registration failed:', err)
      })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        initPushNotifications().catch(() => {})
      }
      if (event === 'SIGNED_OUT') {
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
