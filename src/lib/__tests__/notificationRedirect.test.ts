import {
  storeNotificationRedirect,
  consumeNotificationRedirect,
  clearNotificationRedirect,
  getNotificationRedirectRoute,
  type NotificationRedirect,
} from '@/lib/notificationRedirect'

const REDIRECT_KEY = 'chessduo_notification_redirect'

beforeEach(() => {
  localStorage.clear()
})

describe('getNotificationRedirectRoute', () => {
  it('routes friend_request to /friends', () => {
    const route = getNotificationRedirectRoute({
      type: 'friend_request',
      senderId: 'sender-1',
      timestamp: Date.now(),
    })
    expect(route).toBe('/friends')
  })

  it('routes invite_accepted to /friends', () => {
    const route = getNotificationRedirectRoute({
      type: 'invite_accepted',
      senderId: 'sender-1',
      timestamp: Date.now(),
    })
    expect(route).toBe('/friends')
  })

  it('routes chat_message with senderId to /friends?openChat=<senderId>', () => {
    const route = getNotificationRedirectRoute({
      type: 'chat_message',
      senderId: 'sender-1',
      timestamp: Date.now(),
    })
    expect(route).toBe('/friends?openChat=sender-1')
  })

  it('routes chat_message without senderId to /friends', () => {
    const route = getNotificationRedirectRoute({
      type: 'chat_message',
      timestamp: Date.now(),
    })
    expect(route).toBe('/friends')
  })

  it('routes game_invite with all params to /duel with full query string', () => {
    const route = getNotificationRedirectRoute({
      type: 'game_invite',
      roomId: 'room-uuid',
      code: 'ABC123',
      joinPlayerId: 'player-2',
      joinTeam: 'BLACK',
      timestamp: Date.now(),
    })
    expect(route).toBe('/duel?room=room-uuid&code=ABC123&playerId=player-2&team=BLACK')
  })

  it('routes game_invite with missing joinPlayerId to partial /duel URL', () => {
    const route = getNotificationRedirectRoute({
      type: 'game_invite',
      roomId: 'room-uuid',
      code: 'ABC123',
      // joinPlayerId and joinTeam omitted
      timestamp: Date.now(),
    })
    expect(route).toBe('/duel?room=room-uuid')
  })

  it('routes game_invite with no roomId to /duel', () => {
    const route = getNotificationRedirectRoute({
      type: 'game_invite',
      timestamp: Date.now(),
    })
    expect(route).toBe('/duel')
  })

  it('routes unknown type to /', () => {
    const route = getNotificationRedirectRoute({
      type: 'unknown_type',
      timestamp: Date.now(),
    })
    expect(route).toBe('/')
  })
})

describe('storeNotificationRedirect / consumeNotificationRedirect', () => {
  it('stores and consumes a redirect', () => {
    storeNotificationRedirect({
      type: 'friend_request',
      senderId: 'sender-1',
    })
    const consumed = consumeNotificationRedirect()
    expect(consumed).not.toBeNull()
    expect(consumed!.type).toBe('friend_request')
    expect(consumed!.senderId).toBe('sender-1')
  })

  it('returns null when no redirect is stored', () => {
    const consumed = consumeNotificationRedirect()
    expect(consumed).toBeNull()
  })

  it('returns null for expired redirect (30s+)', () => {
    const expiredData: NotificationRedirect = {
      type: 'friend_request',
      senderId: 'sender-1',
      timestamp: Date.now() - 31_000,
    }
    localStorage.setItem(REDIRECT_KEY, JSON.stringify(expiredData))
    const consumed = consumeNotificationRedirect()
    expect(consumed).toBeNull()
    // Expired redirect should be cleaned up
    expect(localStorage.getItem(REDIRECT_KEY)).toBeNull()
  })

  it('keeps redirect in localStorage after consumption (B3 fix)', () => {
    storeNotificationRedirect({
      type: 'game_invite',
      roomId: 'room-uuid',
    })
    consumeNotificationRedirect()
    // B3 fix: redirect is NOT deleted on consume — it survives for retry
    const stillThere = localStorage.getItem(REDIRECT_KEY)
    expect(stillThere).not.toBeNull()
  })

  it('consumed flag prevents re-consumption within 30s window', () => {
    storeNotificationRedirect({
      type: 'friend_request',
      senderId: 'sender-1',
    })
    const first = consumeNotificationRedirect()
    expect(first).not.toBeNull()

    // Second consume should return null because `consumed` flag is set
    const second = consumeNotificationRedirect()
    expect(second).toBeNull()
  })
})

describe('clearNotificationRedirect', () => {
  it('removes the redirect from localStorage', () => {
    storeNotificationRedirect({
      type: 'friend_request',
      senderId: 'sender-1',
    })
    clearNotificationRedirect()
    expect(localStorage.getItem(REDIRECT_KEY)).toBeNull()
  })

  it('is a no-op when no redirect exists', () => {
    expect(() => clearNotificationRedirect()).not.toThrow()
  })
})

describe('storeNotificationRedirect handles localStorage quota', () => {
  it('does not throw when storage fails', () => {
    const originalSetItem = localStorage.setItem
    localStorage.setItem = jest.fn(() => { throw new Error('quota exceeded') })

    expect(() => {
      storeNotificationRedirect({
        type: 'friend_request',
        senderId: 'sender-1',
      })
    }).not.toThrow()

    localStorage.setItem = originalSetItem
  })
})

describe('integration: store → consume → clear', () => {
  it('full lifecycle works correctly', () => {
    storeNotificationRedirect({
      type: 'game_invite',
      roomId: 'room-uuid',
      code: 'ABC',
      joinPlayerId: 'player-2',
      joinTeam: 'BLACK',
    })

    const consumed = consumeNotificationRedirect()
    expect(consumed).not.toBeNull()

    const route = getNotificationRedirectRoute(consumed!)
    expect(route).toBe('/duel?room=room-uuid&code=ABC&playerId=player-2&team=BLACK')

    clearNotificationRedirect()
    expect(localStorage.getItem(REDIRECT_KEY)).toBeNull()
  })
})
