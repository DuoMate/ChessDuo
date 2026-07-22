describe('home page persistence', () => {
  const TIME_OPTIONS = [
    { seconds: 180, label: '3 min' },
    { seconds: 300, label: '5 min' },
    { seconds: 600, label: '10 min' },
    { seconds: 900, label: '15 min' },
    { seconds: 1800, label: '30 min' },
  ]

  const DIFFICULTY_LEVELS = [
    { level: 1, label: 'Beginner' },
    { level: 2, label: 'Novice' },
    { level: 3, label: 'Intermediate' },
    { level: 4, label: 'Advanced' },
    { level: 5, label: 'Expert' },
    { level: 6, label: 'Master' },
  ]

  const SELECTED_TIME_KEY = 'chessduo_selected_time'
  const SELECTED_LEVEL_KEY = 'chessduo_selected_level'
  const DEFAULT_TIME = 600
  const DEFAULT_LEVEL = 3

  function getInitialTime(): number {
    try {
      const saved = localStorage.getItem(SELECTED_TIME_KEY)
      if (saved) {
        const val = parseInt(saved, 10)
        if (TIME_OPTIONS.some(o => o.seconds === val)) return val
      }
    } catch { /* SSR guard */ }
    return DEFAULT_TIME
  }

  function getInitialLevel(): number {
    try {
      const saved = localStorage.getItem(SELECTED_LEVEL_KEY)
      if (saved) {
        const val = parseInt(saved, 10)
        if (DIFFICULTY_LEVELS.some(d => d.level === val)) return val
      }
    } catch { /* SSR guard */ }
    return DEFAULT_LEVEL
  }

  beforeEach(() => {
    localStorage.clear()
  })

  describe('getInitialTime', () => {
    it('returns default time when nothing saved', () => {
      expect(getInitialTime()).toBe(DEFAULT_TIME)
    })

    it('returns saved time when valid', () => {
      localStorage.setItem(SELECTED_TIME_KEY, '900')
      expect(getInitialTime()).toBe(900)
    })

    it('returns default when saved time is invalid', () => {
      localStorage.setItem(SELECTED_TIME_KEY, '999')
      expect(getInitialTime()).toBe(DEFAULT_TIME)
    })

    it('returns default when saved time is not a number', () => {
      localStorage.setItem(SELECTED_TIME_KEY, 'abc')
      expect(getInitialTime()).toBe(DEFAULT_TIME)
    })
  })

  describe('getInitialLevel', () => {
    it('returns default level when nothing saved', () => {
      expect(getInitialLevel()).toBe(DEFAULT_LEVEL)
    })

    it('returns saved level when valid', () => {
      localStorage.setItem(SELECTED_LEVEL_KEY, '5')
      expect(getInitialLevel()).toBe(5)
    })

    it('returns default when saved level is invalid', () => {
      localStorage.setItem(SELECTED_LEVEL_KEY, '99')
      expect(getInitialLevel()).toBe(DEFAULT_LEVEL)
    })

    it('returns default when saved level is not a number', () => {
      localStorage.setItem(SELECTED_LEVEL_KEY, 'hard')
      expect(getInitialLevel()).toBe(DEFAULT_LEVEL)
    })
  })

  describe('offline pending game (Welcome → Got it bug fix)', () => {
    // The welcome page stores { level, time, color } and removes the key, then pushes /game?...
    // The home page's offline auto-start effect reads the same key, removes it, and navigates.
    // We test the home-page side here (the welcome-page redirect is in welcome/page.tsx).

    function readAndClearPendingOfflineGame(): { level?: number; time?: number; color?: string } | null {
      const raw = localStorage.getItem('chessduo_pending_offline_game')
      if (!raw) return null
      localStorage.removeItem('chessduo_pending_offline_game')
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }

    it('parses a valid pending game including color', () => {
      localStorage.setItem('chessduo_pending_offline_game', JSON.stringify({ level: 4, time: 600, color: 'black' }))
      const parsed = readAndClearPendingOfflineGame()
      expect(parsed).toEqual({ level: 4, time: 600, color: 'black' })
    })

    it('parses a pending game without color (backward compatible)', () => {
      localStorage.setItem('chessduo_pending_offline_game', JSON.stringify({ level: 3, time: 300 }))
      const parsed = readAndClearPendingOfflineGame()
      expect(parsed).toEqual({ level: 3, time: 300 })
    })

    it('returns null and removes key for malformed JSON', () => {
      localStorage.setItem('chessduo_pending_offline_game', 'not-json{')
      const parsed = readAndClearPendingOfflineGame()
      expect(parsed).toBeNull()
    })

    it('removes the key after reading (idempotent)', () => {
      localStorage.setItem('chessduo_pending_offline_game', JSON.stringify({ level: 2, time: 600 }))
      readAndClearPendingOfflineGame()
      expect(localStorage.getItem('chessduo_pending_offline_game')).toBeNull()
    })
  })
})
