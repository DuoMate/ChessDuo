'use client'

import { ToastProvider } from '@/components/Toast'
import { NetworkOverlay } from '@/components/NetworkOverlay'
import { Suspense, useEffect, type ReactNode } from 'react'
import Loading from '@/app/loading'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { registerCapacitorAuthListener } from '@/lib/capacitorAuth'
import { registerBackButtonListener } from '@/hooks/useCapacitorBackButton'
import { SplashHandler } from '@/components/SplashHandler'
import { NotificationHandler } from '@/features/push-notifications'
import { initPushNotifications } from '@/features/push-notifications'

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
    registerCapacitorAuthListener()
    registerBackButtonListener()
    initPushNotifications()
  }, [])

  return (
    <NetworkAwareToastProvider>
      <SplashHandler />
      <NotificationHandler />
      {children}
    </NetworkAwareToastProvider>
  )
}
