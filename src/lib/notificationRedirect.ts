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
    const parsed = JSON.parse(stored) as NotificationRedirect
    if (Date.now() - parsed.timestamp > 30_000) {
      localStorage.removeItem(REDIRECT_KEY)
      return null
    }
    localStorage.removeItem(REDIRECT_KEY)
    return parsed
  } catch {
    localStorage.removeItem(REDIRECT_KEY)
    return null
  }
}

export function getNotificationRedirectRoute(data: NotificationRedirect): string {
  switch (data.type) {
    case 'friend_request':
    case 'invite_accepted':
    case 'chat_message':
      return '/friends'
    case 'game_invite': {
      if (data.roomId) {
        const params = new URLSearchParams()
        params.set('room', data.roomId)
        if (data.code) params.set('code', data.code)
        if (data.joinPlayerId) params.set('playerId', data.joinPlayerId)
        if (data.joinTeam) params.set('team', data.joinTeam)
        return `/duel?${params.toString()}`
      }
      return '/duel'
    }
    default:
      return '/'
  }
}
