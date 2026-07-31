const REDIRECT_KEY = 'chessduo_notification_redirect'

export interface NotificationRedirect {
  type: string
  senderId?: string
  roomId?: string
  code?: string
  joinPlayerId?: string
  joinTeam?: string
  timestamp: number
}

export function storeNotificationRedirect(data: Omit<NotificationRedirect, 'timestamp'>): void {
  try {
    localStorage.setItem(REDIRECT_KEY, JSON.stringify({ ...data, timestamp: Date.now() }))
  } catch { /* quota exceeded */ }
}

export function consumeNotificationRedirect(): NotificationRedirect | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(REDIRECT_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as NotificationRedirect & { consumed?: boolean }
    // Don't delete on read — keep the redirect so it survives a failed/unmounted
    // navigation. A `consumed` flag prevents re-consumption within the 30s window.
    if (Date.now() - parsed.timestamp > 30_000) {
      localStorage.removeItem(REDIRECT_KEY)
      return null
    }
    if (parsed.consumed) return null
    parsed.consumed = true
    localStorage.setItem(REDIRECT_KEY, JSON.stringify(parsed))
    return parsed
  } catch {
    localStorage.removeItem(REDIRECT_KEY)
    return null
  }
}

export function clearNotificationRedirect(): void {
  try { localStorage.removeItem(REDIRECT_KEY) } catch { /* quota exceeded */ }
}

export function getNotificationRedirectRoute(data: NotificationRedirect): string {
  switch (data.type) {
    case 'friend_request':
    case 'invite_accepted':
    case 'chat_message':
      return '/friends'
    case 'game_invite': {
      // Require all essential params — partial URLs trigger "Invalid Duel Link"
      if (data.roomId && data.joinPlayerId && data.joinTeam) {
        const params = new URLSearchParams()
        params.set('room', data.roomId)
        if (data.code) params.set('code', data.code)
        params.set('playerId', data.joinPlayerId)
        params.set('team', data.joinTeam)
        return `/duel?${params.toString()}`
      }
      if (data.roomId) {
        return `/duel?room=${data.roomId}`
      }
      return '/duel'
    }
    default:
      return '/'
  }
}
