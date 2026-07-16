import type { NotificationPayload, NotificationType } from './types'

function getApiBase(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

async function isCapacitorAvailable(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export async function registerDeviceToken(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('chessduo_push_disabled') === 'true') return

    const pushInProgress = typeof window !== 'undefined' ? localStorage.getItem('chessduo_push_in_progress') : null
    if (pushInProgress === 'true') {
      console.warn('[Push] Detected crash during previous registration attempt — disabling push')
      localStorage.setItem('chessduo_push_disabled', 'true')
      localStorage.removeItem('chessduo_push_in_progress')
      try { alert('Push notifications caused a crash and have been disabled. You can re-enable them in Settings.') } catch { /* alert may be unavailable */ }
      return
    }

    const lastError = typeof window !== 'undefined' ? localStorage.getItem('chessduo_push_last_error') : null
    if (lastError) {
      console.warn('[Push] Previous crash detected:', lastError)
      try { alert(`[Push Prev Crash]\n${lastError}`) } catch { /* alert may be unavailable */ }
      try { localStorage.removeItem('chessduo_push_last_error') } catch { /* quota exceeded */ }
    }

    const native = await isCapacitorAvailable()
    if (!native) return

    await new Promise(resolve => setTimeout(resolve, 500))

    let PushNotifications
    try {
      ;({ PushNotifications } = await import('@capacitor/push-notifications'))
    } catch (err) {
      const msg = `[Push Setup] Capacitor Push plugin unavailable: ${err instanceof Error ? err.message : String(err)}`
      console.warn(msg)
      try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
      return
    }

    localStorage.setItem('chessduo_push_in_progress', 'true')

    try {
      const permResult = await PushNotifications.requestPermissions()
      if (permResult?.receive !== 'granted') {
        return
      }

      PushNotifications.addListener('registration', (token) => {
        fetch(`${getApiBase()}/api/push/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.value, platform: 'android' }),
        }).catch((err) => {
          console.warn('[Push] Failed to register token with backend:', err)
        })
      })

      PushNotifications.addListener('registrationError', (err) => {
        console.warn('[Push] Registration error:', err)
      })

      await PushNotifications.register()

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        try {
          const data = notification?.notification?.data as Record<string, string> | undefined
          if (!data) return
          const type = data.type as NotificationType | undefined
          if (!type) return
          switch (type) {
            case 'friend_request':
              if (data.senderId) window.location.href = `/invite/${data.senderId}`
              break
            case 'invite_accepted':
            case 'chat_message':
              window.location.href = '/'
              break
            case 'game_invite':
              if (data.roomId) window.location.href = `/duel?room=${data.roomId}`
              break
            default: {
              const msg = `[Push Debug] Unknown type: ${JSON.stringify(data)}`
              console.warn(msg)
              try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
            }
          }
        } catch (err) {
          const msg = `[Push Crash] ${err instanceof Error ? err.message : String(err)} | data: ${JSON.stringify(notification)}`
          console.error(msg)
          try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
          try { alert(msg) } catch { /* alert may be unavailable */ }
        }
      })
    } finally {
      localStorage.removeItem('chessduo_push_in_progress')
    }
  } catch (err) {
    const msg = `[Push Setup] ${err instanceof Error ? err.message : String(err)}`
    console.warn(msg)
    try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
  }
}

export async function sendPushNotification(
  receiverId: string,
  type: NotificationType,
  data: Omit<NotificationPayload, 'type'>,
): Promise<void> {
  const titles: Record<NotificationType, string> = {
    friend_request: 'Friend Request',
    invite_accepted: 'Invite Accepted',
    chat_message: data.senderName || 'New Message',
    game_invite: 'Game Invite',
  }

  const bodies: Record<NotificationType, (d: typeof data) => string> = {
    friend_request: (d) => `${d.senderName || 'Someone'} sent you a friend request`,
    invite_accepted: (d) => `${d.senderName || 'Someone'} accepted your friend request`,
    chat_message: (d) => d.snippet || 'Sent you a message',
    game_invite: (d) => `${d.senderName || 'Someone'} invited you to a game`,
  }

  try {
    await fetch(`${getApiBase()}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: receiverId,
        title: titles[type],
        body: bodies[type](data),
        data: { type, senderId: data.senderId, roomId: data.roomId || '' },
      }),
    })
  } catch {
    // silently fail — push is best-effort
  }
}
