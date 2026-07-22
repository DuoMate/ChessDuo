import {
  storePendingAction,
  consumePendingAction,
  clearPendingAction,
  hasPendingAction,
} from '../../lib/pendingAction'

describe('pendingAction', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('storePendingAction', () => {
    test('stores a start_offline action', () => {
      storePendingAction({ type: 'start_offline', level: 3, time: 600, color: 'white' })
      expect(hasPendingAction()).toBe(true)
    })

    test('stores a start_online action', () => {
      storePendingAction({ type: 'start_online', time: 300, color: 'random' })
      expect(hasPendingAction()).toBe(true)
    })

    test('stores a start_four_player action', () => {
      storePendingAction({ type: 'start_four_player', time: 600 })
      expect(hasPendingAction()).toBe(true)
    })

    test('stores a start_duel action', () => {
      storePendingAction({ type: 'start_duel', friendId: 'friend-1', friendName: 'Alice', time: 600 })
      expect(hasPendingAction()).toBe(true)
    })

    test('stores a join_by_code action', () => {
      storePendingAction({ type: 'join_by_code', code: 'ABC123' })
      expect(hasPendingAction()).toBe(true)
    })

    test('stores a navigate action', () => {
      storePendingAction({ type: 'navigate', route: '/duel?room=123' })
      expect(hasPendingAction()).toBe(true)
    })

    test('last store overwrites previous', () => {
      storePendingAction({ type: 'start_online', time: 300, color: 'white' })
      storePendingAction({ type: 'start_four_player', time: 600 })
      const consumed = consumePendingAction()
      expect(consumed).toEqual({ type: 'start_four_player', time: 600 })
    })
  })

  describe('consumePendingAction', () => {
    test('returns the stored action and clears it', () => {
      storePendingAction({ type: 'start_online', time: 600, color: 'white' })
      const action = consumePendingAction()
      expect(action).toEqual({ type: 'start_online', time: 600, color: 'white' })
      expect(hasPendingAction()).toBe(false)
      expect(consumePendingAction()).toBeNull()
    })

    test('returns null when nothing is stored', () => {
      expect(consumePendingAction()).toBeNull()
    })

    test('returns null when TTL has expired', () => {
      storePendingAction({ type: 'navigate', route: '/friends' })
      jest.advanceTimersByTime(5 * 60 * 1000 + 1)
      expect(consumePendingAction()).toBeNull()
      expect(hasPendingAction()).toBe(false)
    })

    test('returns action when within TTL', () => {
      storePendingAction({ type: 'navigate', route: '/friends' })
      jest.advanceTimersByTime(4 * 60 * 1000)
      const action = consumePendingAction()
      expect(action).toEqual({ type: 'navigate', route: '/friends' })
    })

    test('clears key even on malformed JSON', () => {
      localStorage.setItem('chessduo_pending_action', 'not-json')
      expect(consumePendingAction()).toBeNull()
      expect(localStorage.getItem('chessduo_pending_action')).toBeNull()
    })
  })

  describe('clearPendingAction', () => {
    test('clears without consuming', () => {
      storePendingAction({ type: 'join_by_code', code: 'XYZ' })
      clearPendingAction()
      expect(hasPendingAction()).toBe(false)
      expect(consumePendingAction()).toBeNull()
    })

    test('is safe to call when nothing is stored', () => {
      expect(() => clearPendingAction()).not.toThrow()
    })
  })

  describe('hasPendingAction', () => {
    test('returns false when nothing is stored', () => {
      expect(hasPendingAction()).toBe(false)
    })

    test('returns true when action is stored and within TTL', () => {
      storePendingAction({ type: 'navigate', route: '/' })
      expect(hasPendingAction()).toBe(true)
    })

    test('returns false after TTL expires', () => {
      storePendingAction({ type: 'navigate', route: '/' })
      jest.advanceTimersByTime(5 * 60 * 1000 + 1)
      expect(hasPendingAction()).toBe(false)
    })

    test('does not clear the key on check (non-destructive)', () => {
      storePendingAction({ type: 'start_online', time: 300, color: 'black' })
      expect(hasPendingAction()).toBe(true)
      expect(hasPendingAction()).toBe(true) // still there
      expect(consumePendingAction()).not.toBeNull()
    })
  })
})
