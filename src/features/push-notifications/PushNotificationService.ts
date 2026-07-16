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
    if (!native) {
      console.log('[Push] Not on native platform, skipping')
      return
    }

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
        console.log('[Push] Permission not granted')
        return
      }

      PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] Registration fired, token:', token.value.substring(0, 20) + '...')

        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: { session } } = await supabase.auth.getSession()

          if (!session?.access_token) {
            console.warn('[Push] No session found, cannot register token')
            return
          }

          console.log('[Push] Session found, sending token to API')

          const res = await fetch(`${getApiBase()}/api/push/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ token: token.value, platform: 'android' }),
          })

          const resText = await res.text()
          console.log('[Push] Registration response:', res.status, resText)

          if (res.ok) {
            const parsed = JSON.parse(resText)
            console.log('[Push] Token registered successfully')

            // Send welcome notification after short delay
            if (session?.user) {
              setTimeout(async () => {
                try {
                  await sendPushNotification(session.user.id, 'friend_request', {
                    senderId: 'system',
                    senderName: 'ChessDuo',
                    snippet: 'Welcome! Push notifications are now enabled.',
                  })
                  console.log('[Push] Welcome notification sent')
                } catch (err) {
                  console.warn('[Push] Failed to send welcome notification:', err)
                }
              }, 1000)
            }
          } else {
            console.error('[Push] Registration failed:', res.status, resText)
          }
        } catch (err) {
          console.error('[Push] Registration error:', err instanceof Error ? err.message : String(err))
        }
      })

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err)
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
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()

    const authHeader = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}

    console.log('[Push] Sending notification to:', receiverId, 'type:', type)

    const res = await fetch(`${getApiBase()}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        userId: receiverId,
        title: titles[type],
        body: bodies[type](data),
        data: { type, senderId: data.senderId, roomId: data.roomId || '' },
      }),
    })

    const resText = await res.text()
    console.log('[Push] Send response:', res.status, resText)

    if (!res.ok) {
      console.error('[Push] Send failed:', res.status, resText)
    }
  } catch (err) {
    console.error('[Push] Send error:', err instanceof Error ? err.message : String(err))
  }
}
