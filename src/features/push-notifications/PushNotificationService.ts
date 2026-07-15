import type { NotificationPayload, NotificationType } from './types'

function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
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

    const native = await isCapacitorAvailable()
    if (!native) return

    await new Promise(resolve => setTimeout(resolve, 500))

    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permResult = await PushNotifications.requestPermissions()
    if (permResult.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', (token) => {
      fetch(`${getApiBase()}/api/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.value, platform: 'android' }),
      }).catch(() => {})
    })

    PushNotifications.addListener('registrationError', () => {})
  } catch {
    // Push notifications are best-effort — silently fail if native plugin is unavailable
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
