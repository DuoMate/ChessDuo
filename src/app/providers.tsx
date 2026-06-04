'use client'

import { ToastProvider } from '@/components/Toast'
import { NetworkOverlay } from '@/components/NetworkOverlay'
import { Suspense, type ReactNode } from 'react'
import Loading from '@/app/loading'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

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
  return <NetworkAwareToastProvider>{children}</NetworkAwareToastProvider>
}
