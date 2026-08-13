import type { NotificationPayload, NotificationType } from './types'
import { storeNotificationRedirect, getNotificationRedirectRoute } from '@/lib/notificationRedirect'

const PUSH_IN_PROGRESS_KEY = 'chessduo_push_in_progress'
const PUSH_FCM_TOKEN_KEY = 'chessduo_fcm_token'
const CRASH_GUARD_TIMEOUT_MS = 30_000
const SW_READY_TIMEOUT_MS = 15_000

let fcmRegistered = false
let pushInitInProgress = false
let cachedAccessToken = ''
let lastErrorStoreAttempts = 0

function getApiBase(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    if (origin === 'http://localhost' || origin === 'https://localhost' || origin.startsWith('capacitor://')) {
      console.warn('[Push] API base resolved to native localhost origin with no NEXT_PUBLIC_SITE_URL — push registration will fail')
    }
    return origin
  }
  return ''
}

function logPushError(msg: string): void {
  console.warn(msg)
  try {
    if (Date.now() - lastErrorStoreAttempts > 5_000) {
      lastErrorStoreAttempts = Date.now()
      localStorage.setItem('chessduo_push_last_error', msg)
    }
  } catch { /* quota exceeded */ }
}

function waitForServiceWorkerReady(timeoutMs: number): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.reject(new Error('Service Worker not supported'))
  }
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) =>
      setTimeout(() => reject(new Error(`navigator.serviceWorker.ready timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ])
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
  const authToken = accessToken || cachedAccessToken
  if (!authToken) {
    const msg = '[Push] No access token available, cannot register token — are you signed in?'
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
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token, platform }),
  })

  const resText = await res.text()
  console.log('[Push] Registration response:', res.status, resText)

  if (res.ok) {
      console.log('[Push] Token registered successfully')
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

  const pushInProgress = typeof window !== 'undefined' ? localStorage.getItem(PUSH_IN_PROGRESS_KEY) : null
  if (pushInProgress) {
    const startedAt = parseInt(pushInProgress, 10)
    if (Date.now() - startedAt > CRASH_GUARD_TIMEOUT_MS) {
      try { localStorage.removeItem(PUSH_IN_PROGRESS_KEY) } catch { /* quota exceeded */ }
    } else {
      console.warn('[Push] Browser push init already in progress, skipping')
      return false
    }
  }
  try {
    if (typeof window !== 'undefined') localStorage.setItem(PUSH_IN_PROGRESS_KEY, String(Date.now()))

    let registration: ServiceWorkerRegistration
    try {
      registration = await waitForServiceWorkerReady(SW_READY_TIMEOUT_MS)
    } catch (err) {
      logPushError(`[Push Web] Service worker not ready: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }

    const existingSubscription = await registration.pushManager.getSubscription()

    if (existingSubscription) {
      if (vapidKeyChanged) {
        console.log('[Push] VAPID key changed — unsubscribing old subscription and creating new one')
        await existingSubscription.unsubscribe()
      } else if (Notification.permission !== 'granted') {
        console.log('[Push] Permission revoked since subscription was created — unsubscribing stale subscription')
        await existingSubscription.unsubscribe()
      } else {
        console.log('[Push] Existing browser subscription found, reusing')
        await saveTokenToServer(JSON.stringify(existingSubscription), 'web', accessToken)
        try { localStorage.setItem(PUSH_VAPID_KEY, vapidPublicKey) } catch { /* quota exceeded */ }
        return true
      }
    }

    let permission: NotificationPermission = Notification.permission
    if (permission === 'denied') {
      console.log('[Push] Browser notification permission denied in OS')
      return false
    }
    if (permission !== 'granted') {
      permission = await Notification.requestPermission()
    }
    if (permission !== 'granted') {
      console.log('[Push] Browser notification permission denied')
      return false
    }

    let registrationAfterPermission: ServiceWorkerRegistration
    try {
      registrationAfterPermission = await waitForServiceWorkerReady(SW_READY_TIMEOUT_MS)
    } catch (err) {
      logPushError(`[Push Web] Service worker not ready: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource
    const subscription = await registrationAfterPermission.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    try { localStorage.setItem(PUSH_VAPID_KEY, vapidPublicKey) } catch { /* quota exceeded */ }
    await saveTokenToServer(JSON.stringify(subscription), 'web', accessToken)
    return true
  } catch (err) {
    logPushError(`[Push Web] ${err instanceof Error ? err.message : String(err)}`)
    return false
  } finally {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(PUSH_IN_PROGRESS_KEY) } catch { /* quota exceeded */ }
    }
  }
}

export function clearCachedAccessToken(): void { cachedAccessToken = '' }

export function setCachedAccessToken(token: string): void { cachedAccessToken = token }

export async function resetPushState(): Promise<void> {
  fcmRegistered = false
  pushInitInProgress = false
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(PUSH_FCM_TOKEN_KEY) } catch { /* quota exceeded */ }
    try { localStorage.removeItem(PUSH_IN_PROGRESS_KEY) } catch { /* quota exceeded */ }
  }
}

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
        const msg = '[Push] Detected crash during previous registration attempt — disabling push. Re-enable from Settings.'
        console.warn(msg)
        try { localStorage.setItem('chessduo_push_disabled', 'true') } catch { /* quota exceeded */ }
        try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
        try { localStorage.removeItem(PUSH_IN_PROGRESS_KEY) } catch { /* quota exceeded */ }
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
      logPushError(msg)
      return
    }

    localStorage.setItem(PUSH_IN_PROGRESS_KEY, String(Date.now()))

    try {
      const permResult = await PushNotifications.requestPermissions()
      if (permResult?.receive !== 'granted') {
        console.log('[Push] Permission not granted')
        return
      }

      try {
        await PushNotifications.createChannel({
          id: 'chessduo_default',
          name: 'ChessDuo Notifications',
          description: 'Game invites, friend requests, and chat messages',
          importance: 4, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'default',
          vibration: true,
          lights: true,
        })
        console.log('[Push] Notification channel created')
      } catch (err) {
        console.warn('[Push] createChannel failed (may already exist):', err)
      }

      PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] Registration fired, token:', token.value.substring(0, 20) + '...')
        if (typeof window !== 'undefined') {
          localStorage.setItem(PUSH_FCM_TOKEN_KEY, token.value)
        }
        await saveTokenToServer(token.value, 'android', cachedAccessToken || undefined)
      })

      PushNotifications.addListener('registrationError', (err) => {
        const msg = `[Push] FCM registration error: ${JSON.stringify(err)}`
        logPushError(msg)
      })

      await PushNotifications.register()
      fcmRegistered = true

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        try {
          const data = notification?.data as Record<string, string> | undefined
          const type = data?.type as NotificationType | undefined
          const title = notification?.title || 'ChessDuo'
          const body = notification?.body || ''

          console.log('[Push] Foreground notification received:', type, title)

          if (type === 'chat_message' || type === 'friend_request' || type === 'invite_accepted' || type === 'game_invite') {
            try { storeNotificationRedirect({
              type,
              senderId: data?.senderId,
              senderName: data?.senderName,
              roomId: data?.roomId,
              code: data?.code,
              joinPlayerId: data?.joinPlayerId,
              joinTeam: data?.joinTeam,
            }) } catch { /* redirect store is best-effort; badge updates via Realtime anyway */ }
          }

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const route = getNotificationRedirectRoute({
                type: type!,
                senderId: data?.senderId,
                roomId: data?.roomId,
                code: data?.code,
                joinPlayerId: data?.joinPlayerId,
                joinTeam: data?.joinTeam,
                timestamp: Date.now(),
              })
              const n = new Notification(title, { body, icon: '/favicon.ico', tag: `chessduo-${type || 'default'}` })
              n.onclick = () => {
                n.close()
                if (route && route !== '/') {
                  window.location.href = route
                }
              }
            } catch { /* Notification constructor may be unavailable in Capacitor WebView — system tray handles background case */ }
          }
        } catch (err) {
          console.warn('[Push] Foreground notification handler error:', err)
        }
      })

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        try {
          const data = notification?.notification?.data as Record<string, string> | undefined
          if (!data) return
          const type = data.type as NotificationType | undefined
          if (!type) return
          // Store redirect so it survives the hard navigation (cold-start recovery).
          // The consumed flag + 30s TTL in consumeNotificationRedirect prevent
          // boomerang navigation on subsequent page loads.
          if (type === 'chat_message' || type === 'friend_request' || type === 'invite_accepted' || type === 'game_invite') {
            try { storeNotificationRedirect({
              type,
              senderId: data?.senderId,
              senderName: data?.senderName,
              roomId: data?.roomId,
              code: data?.code,
              joinPlayerId: data?.joinPlayerId,
              joinTeam: data?.joinTeam,
            }) } catch { /* redirect store is best-effort */ }
          }
          const route = getNotificationRedirectRoute({
            type,
            senderId: data.senderId,
            roomId: data.roomId,
            code: data.code,
            joinPlayerId: data.joinPlayerId,
            joinTeam: data.joinTeam,
            timestamp: Date.now(),
          })
          window.location.replace(route)
        } catch (err) {
          const msg = `[Push Crash] ${err instanceof Error ? err.message : String(err)} | data: ${JSON.stringify(notification)}`
          console.error(msg)
          try { localStorage.setItem('chessduo_push_last_error', msg) } catch { /* quota exceeded */ }
        }
      })
    } finally {
      try { localStorage.removeItem(PUSH_IN_PROGRESS_KEY) } catch { /* quota exceeded */ }
    }
  } catch (err) {
    const msg = `[Push Setup] ${err instanceof Error ? err.message : String(err)}`
    logPushError(msg)
  } finally {
    pushInitInProgress = false
  }
}

export async function sendPushNotification(
  receiverId: string,
  type: NotificationType,
  data: Omit<NotificationPayload, 'type'>,
  accessToken?: string,
): Promise<{ success: boolean; sent: number; failed: number }> {
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

  const authToken = accessToken || cachedAccessToken
  if (!authToken) {
    console.warn('[Push] No access token, cannot send notification')
    return { success: false, sent: 0, failed: 1 }
  }

  try {
    console.log('[Push] Sending notification to:', receiverId, 'type:', type)

    const res = await fetch(`${getApiBase()}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        userId: receiverId,
        title: titles[type],
        body: bodies[type](data),
        data: {
          type,
          senderId: data.senderId || '',
          senderName: data.senderName || '',
          snippet: data.snippet || '',
          roomId: data.roomId || '',
          code: data.code || '',
          joinPlayerId: data.joinPlayerId || '',
          joinTeam: data.joinTeam || '',
        },
      }),
    })

    const resText = await res.text()
    console.log('[Push] Send response:', res.status, resText)

    if (!res.ok) {
      console.error('[Push] Send failed:', res.status, resText)
      return { success: false, sent: 0, failed: 1 }
    }

    try {
      const body = JSON.parse(resText) as { sent?: number; failed?: number }
      return { success: true, sent: body.sent ?? 1, failed: body.failed ?? 0 }
    } catch {
      return { success: true, sent: 1, failed: 0 }
    }
  } catch (err) {
    console.error('[Push] Send error:', err instanceof Error ? err.message : String(err))
    return { success: false, sent: 0, failed: 1 }
  }
}
