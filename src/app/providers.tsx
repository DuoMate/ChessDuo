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

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[SW] Service worker registration failed:', err)
      })
    }

    initPushNotifications().catch(() => {})
    SubscriptionService.setProvider(GooglePlayBillingProvider)
    SubscriptionService.initialize().catch(() => {})
  }, [])

  useScrollToTop()

  return (
    <NetworkAwareToastProvider>
      <SplashHandler />
      {children}
    </NetworkAwareToastProvider>
  )
}
