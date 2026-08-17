'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  consumeNotificationRedirect,
  getNotificationRedirectRoute,
  storeNotificationRedirect,
  FRIENDS_REFRESH_EVENT,
} from '@/lib/notificationRedirect'

function dispatchFriendsRefresh(type?: string): void {
  if (type !== 'friend_request' && type !== 'invite_accepted') return
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FRIENDS_REFRESH_EVENT))
}

export function useNotificationRedirect(): void {
  const router = useRouter()

  useEffect(() => {
    const redirect = consumeNotificationRedirect()
    if (redirect) {
      const route = getNotificationRedirectRoute(redirect)
      if (route !== '/') {
        router.replace(route)
      }
      // A friend-request deep-link may land on /friends while the panel is
      // already mounted (no remount → no refetch). Signal it to refetch.
      dispatchFriendsRefresh(redirect.type)
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
      // Same as the mount-consume path: if a friend-request notification is
      // tapped while /friends is already open, router.replace is a no-op, so
      // explicitly tell the FriendsPanel to refetch.
      dispatchFriendsRefresh(payload.data?.type)
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [router])
}
