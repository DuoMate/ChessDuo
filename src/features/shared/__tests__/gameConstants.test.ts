import { INSIGHTS_FREE_LIMIT } from '../gameConstants'

describe('gameConstants', () => {
  describe('INSIGHTS_FREE_LIMIT', () => {
    test('is defined', () => {
      expect(INSIGHTS_FREE_LIMIT).toBeDefined()
    })

    test('is exactly 3', () => {
      expect(INSIGHTS_FREE_LIMIT).toBe(3)
    })

    test('is a positive integer', () => {
      expect(Number.isInteger(INSIGHTS_FREE_LIMIT)).toBe(true)
      expect(INSIGHTS_FREE_LIMIT).toBeGreaterThan(0)
    })
  })

  describe('CHECKMATE_SCORE', () => {
    test('is a large positive number', () => {
      const { CHECKMATE_SCORE } = require('../gameConstants')
      expect(CHECKMATE_SCORE).toBeGreaterThan(1000)
    })
  })

  describe('DEFAULT_TEAM_TIMER_SECONDS', () => {
    test('is a reasonable value', () => {
      const { DEFAULT_TEAM_TIMER_SECONDS } = require('../gameConstants')
      expect(DEFAULT_TEAM_TIMER_SECONDS).toBeGreaterThan(0)
      expect(DEFAULT_TEAM_TIMER_SECONDS).toBeLessThanOrEqual(3600)
    })
  })
})
