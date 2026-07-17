import type { NotificationPayload, NotificationType } from './types'

const PUSH_IN_PROGRESS_KEY = 'chessduo_push_in_progress'
const PUSH_WELCOME_SENT_KEY = 'chessduo_push_welcome_sent'
const PUSH_FCM_TOKEN_KEY = 'chessduo_fcm_token'
const CRASH_GUARD_TIMEOUT_MS = 30_000

let fcmRegistered = false
let pushInitInProgress = false
let cachedAccessToken = ''

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

function getVapidPublicKey(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  }
  return ''
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function saveTokenToServer(token: string, platform: string, accessToken?: string): Promise<void> {
  if (!accessToken) {
    const msg = '[Push] No access token provided, cannot register token — are you signed in?'
    console.warn(msg)
    try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
    return
  }

  const apiUrl = `${getApiBase()}/api/push/register`
  console.log('[Push] POST', apiUrl, 'platform:', platform)

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token, platform }),
  })

  const resText = await res.text()
  console.log('[Push] Registration response:', res.status, resText)

  if (res.ok) {
    console.log('[Push] Token registered successfully')

    const welcomeSent = typeof window !== 'undefined' && localStorage.getItem(PUSH_WELCOME_SENT_KEY) === 'true'
    if (!welcomeSent && accessToken) {
      localStorage.setItem(PUSH_WELCOME_SENT_KEY, 'true')
      setTimeout(async () => {
        try {
          await sendPushNotification('system', 'friend_request', {
            senderId: 'system',
            senderName: 'ChessDuo',
            snippet: 'Welcome! Push notifications are now enabled.',
          }, accessToken)
          console.log('[Push] Welcome notification sent')
        } catch (err) {
          console.warn('[Push] Failed to send welcome notification:', err)
        }
      }, 1000)
    }
  } else {
    const msg = `[Push] Server rejected token: ${res.status} — ${resText}`
    console.error(msg)
    try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
  }
}

const PUSH_VAPID_KEY = 'chessduo_vapid_public_key'

async function registerBrowserPush(accessToken?: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Browser push not supported')
    return false
  }

  const vapidPublicKey = getVapidPublicKey()
  if (!vapidPublicKey) {
    console.log('[Push] VAPID public key not configured, skipping browser push')
    return false
  }

  const storedVapidKey = typeof window !== 'undefined' ? localStorage.getItem(PUSH_VAPID_KEY) : null
  const vapidKeyChanged = storedVapidKey !== null && storedVapidKey !== vapidPublicKey

  try {
    const registration = await navigator.serviceWorker.ready
    const existingSubscription = await registration.pushManager.getSubscription()

    if (existingSubscription) {
      if (vapidKeyChanged) {
        console.log('[Push] VAPID key changed — unsubscribing old subscription and creating new one')
        await existingSubscription.unsubscribe()
      } else {
        console.log('[Push] Existing browser subscription found, reusing')
        await saveTokenToServer(JSON.stringify(existingSubscription), 'web', accessToken)
        try { localStorage.setItem(PUSH_VAPID_KEY, vapidPublicKey) } catch { /* quota exceeded */ }
        return true
      }
    }
  } catch (err) {
    console.warn('[Push] Failed to check existing browser subscription:', err)
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('[Push] Browser notification permission denied')
      return false
    }

    const registration = await navigator.serviceWorker.ready
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    try { localStorage.setItem(PUSH_VAPID_KEY, vapidPublicKey) } catch { /* quota exceeded */ }
    await saveTokenToServer(JSON.stringify(subscription), 'web', accessToken)
    return true
  } catch (err) {
    const msg = `[Push Web] ${err instanceof Error ? err.message : String(err)}`
    console.warn(msg)
    try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
    try { alert(`Push setup failed: ${msg}. Check Settings to retry.`) } catch { /* alert may be unavailable */ }
    return false
  }
}

export function clearCachedAccessToken(): void { cachedAccessToken = '' }

export async function registerDeviceToken(accessToken?: string): Promise<void> {
  if (!accessToken) {
    console.warn('[Push] No access token — skipping registration (not yet signed in)')
    return
  }

  cachedAccessToken = accessToken

  if (pushInitInProgress) {
    console.log('[Push] Init already in progress, skipping')
    return
  }

  pushInitInProgress = true
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('chessduo_push_disabled') === 'true') return

    const pushInProgress = typeof window !== 'undefined' ? localStorage.getItem(PUSH_IN_PROGRESS_KEY) : null
    if (pushInProgress) {
      const startedAt = parseInt(pushInProgress, 10)
      if (Date.now() - startedAt > CRASH_GUARD_TIMEOUT_MS) {
        console.warn('[Push] Previous registration attempt timed out — clearing and retrying')
        localStorage.removeItem(PUSH_IN_PROGRESS_KEY)
      } else {
        console.warn('[Push] Detected crash during previous registration attempt — disabling push')
        localStorage.setItem('chessduo_push_disabled', 'true')
        localStorage.removeItem(PUSH_IN_PROGRESS_KEY)
        return
      }
    }

    const lastError = typeof window !== 'undefined' ? localStorage.getItem('chessduo_push_last_error') : null
    if (lastError) {
      console.warn('[Push] Previous crash detected:', lastError)
      try { localStorage.removeItem('chessduo_push_last_error') } catch { /* quota exceeded */ }
    }

    const native = await isCapacitorAvailable()

    if (!native) {
      console.log('[Push] Not on native platform, trying browser push')
      const browserOk = await registerBrowserPush(accessToken)
      if (!browserOk) {
        console.log('[Push] Browser push registration failed or not configured')
      }
      return
    }

    if (fcmRegistered) {
      const existingToken = typeof window !== 'undefined' ? localStorage.getItem(PUSH_FCM_TOKEN_KEY) : null
      if (existingToken) {
        console.log('[Push] Reusing existing FCM token')
        await saveTokenToServer(existingToken, 'android', accessToken)
      }
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
      try { alert(`Push setup failed: ${msg}`) } catch { /* alert may be unavailable */ }
      return
    }

    localStorage.setItem(PUSH_IN_PROGRESS_KEY, String(Date.now()))

    try {
      const permResult = await PushNotifications.requestPermissions()
      if (permResult?.receive !== 'granted') {
        console.log('[Push] Permission not granted')
        return
      }

      PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] Registration fired, token:', token.value.substring(0, 20) + '...')
        if (typeof window !== 'undefined') {
          localStorage.setItem(PUSH_FCM_TOKEN_KEY, token.value)
        }
        await saveTokenToServer(token.value, 'android', accessToken)
      })

      PushNotifications.addListener('registrationError', (err) => {
        const msg = `[Push] FCM registration error: ${JSON.stringify(err)}`
        console.error(msg)
        try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
        try { alert(`Push setup failed: ${msg}. Check Settings to retry.`) } catch { /* alert may be unavailable */ }
      })

      await PushNotifications.register()
      fcmRegistered = true

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
        }
      })
    } finally {
      localStorage.removeItem(PUSH_IN_PROGRESS_KEY)
    }
  } catch (err) {
    const msg = `[Push Setup] ${err instanceof Error ? err.message : String(err)}`
    console.warn(msg)
    try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
    try { alert(`Push setup failed: ${msg}`) } catch { /* alert may be unavailable */ }
  } finally {
    pushInitInProgress = false
  }
}

export async function sendPushNotification(
  receiverId: string,
  type: NotificationType,
  data: Omit<NotificationPayload, 'type'>,
  accessToken?: string,
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

  const authHeader = (accessToken || cachedAccessToken)
    ? { Authorization: `Bearer ${accessToken || cachedAccessToken}` }
    : {}
  if (!accessToken && !cachedAccessToken) {
    console.warn('[Push] No access token, sending notification without auth header')
  }

  try {
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
