'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { NotificationType } from './types'

export function NotificationHandler() {
  const router = useRouter()

  useEffect(() => {
    let unregister: (() => void) | undefined

    async function setup() {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return

        const { PushNotifications } = await import('@capacitor/push-notifications')

        const handler = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (notification) => {
            const data = notification.notification.data as Record<string, string>
            const type = data?.type as NotificationType | undefined
            if (!type) return

            switch (type) {
              case 'friend_request':
                router.push(`/invite/${data.senderId}`)
                break
              case 'invite_accepted':
                router.push('/')
                break
              case 'chat_message':
                router.push('/')
                break
              case 'game_invite':
                if (data.roomId) {
                  router.push(`/duel?room=${data.roomId}`)
                }
                break
            }
          },
        )

        unregister = () => { handler.remove() }
      } catch {
        // not running on native
      }
    }

    setup()

    return () => {
      unregister?.()
    }
  }, [router])

  return null
}
