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
    } catch {}
    return DEFAULT_TIME
  }

  function getInitialLevel(): number {
    try {
      const saved = localStorage.getItem(SELECTED_LEVEL_KEY)
      if (saved) {
        const val = parseInt(saved, 10)
        if (DIFFICULTY_LEVELS.some(d => d.level === val)) return val
      }
    } catch {}
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
})
