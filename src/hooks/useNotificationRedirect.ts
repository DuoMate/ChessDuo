'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { consumeNotificationRedirect, getNotificationRedirectRoute, storeNotificationRedirect } from '@/lib/notificationRedirect'

export function useNotificationRedirect(): void {
  const router = useRouter()

  useEffect(() => {
    const redirect = consumeNotificationRedirect()
    if (redirect) {
      const route = getNotificationRedirectRoute(redirect)
      if (route !== '/') {
        router.replace(route)
      }
    }
  }, [router])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      const payload = event.data
      if (!payload || payload.type !== 'notification-click' || !payload.url) return
      if (payload.data) {
        try {
          storeNotificationRedirect({
            type: payload.data.type,
            senderId: payload.data.senderId,
            senderName: payload.data.senderName,
            roomId: payload.data.roomId,
            code: payload.data.code,
            joinPlayerId: payload.data.joinPlayerId,
            joinTeam: payload.data.joinTeam,
          })
        } catch { /* redirect store is best-effort; route below still works */ }
      }
      if (payload.url.startsWith('/')) {
        router.replace(payload.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [router])
}
