self.addEventListener('push', (event) => {
  let payload = {}
  try {
    if (event.data) {
      payload = event.data.json()
    }
  } catch { /* invalid JSON — show generic notification */ }

  const title = payload.title || 'ChessDuo'
  const options = {
    body: payload.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    tag: payload.tag || 'chessduo-default',
    requireInteraction: true,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const type = data.type

  let url = '/'
  if (type === 'friend_request' && data.senderId) {
    url = `/invite/${data.senderId}`
  } else if (type === 'game_invite' && data.roomId) {
    url = `/duel?room=${data.roomId}`
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing && 'focus' in existing) {
        existing.focus()
        existing.postMessage({ type: 'notification-click', url })
      } else {
        self.clients.openWindow(url)
      }
    }),
  )
})
