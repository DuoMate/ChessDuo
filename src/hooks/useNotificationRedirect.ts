'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { consumeNotificationRedirect, getNotificationRedirectRoute } from '@/lib/notificationRedirect'

export function useNotificationRedirect(): void {
  const router = useRouter()

  useEffect(() => {
    const redirect = consumeNotificationRedirect()
    if (redirect) {
      const route = getNotificationRedirectRoute(redirect)
      if (route !== '/') {
        router.push(route)
      }
    }
  }, [router])
}
