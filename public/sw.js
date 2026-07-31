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

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const newSub = await self.registration.pushManager.getSubscription()
        const oldSub = event.oldSubscription
        // Post data to the server so it can clean up the old token and
        // store the new one. The main page's useNotificationRedirect hook
        // will handle re-registration on next visit.
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const client of clients) {
          client.postMessage({
            type: 'push-subscription-change',
            oldEndpoint: oldSub?.endpoint,
            newEndpoint: newSub?.endpoint,
          })
        }
      } catch {
        // Silent — the server-side cleanup path on next send handles this
      }
    })(),
  )
})
