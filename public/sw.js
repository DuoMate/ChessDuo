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
  if (type === 'friend_request' || type === 'invite_accepted') {
    url = '/friends'
  } else if (type === 'chat_message') {
    url = '/friends'
  } else if (type === 'game_invite' && data.roomId) {
    let duelUrl = `/duel?room=${data.roomId}`
    if (data.code) duelUrl += `&code=${data.code}`
    if (data.joinPlayerId) duelUrl += `&playerId=${data.joinPlayerId}`
    if (data.joinTeam) duelUrl += `&team=${data.joinTeam}`
    url = duelUrl
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing && 'focus' in existing) {
        existing.focus()
        existing.postMessage({ type: 'notification-click', url, data })
      } else {
        self.clients.openWindow(url)
      }
    }),
  )
})
