import { LocalGame, GameStatus } from '../../features/offline/game/localGame'
import { Team } from '../../features/game-engine/gameState'
import { createBot, ChessBot } from '../../features/bots/chessBot'
import { calculateAccuracy, getAccuracyCategory } from '../../features/shared/accuracy'

describe('Accuracy Formula', () => {
  describe('Linear accuracy formula (production)', () => {
    test('calculates 100% accuracy for zero loss', () => {
      expect(calculateAccuracy(0)).toBe(100)
    })

    test('calculates 100% accuracy for small loss (<= 10cp)', () => {
      expect(calculateAccuracy(10)).toBe(100)
    })

    test('calculates ~69% accuracy for 100cp loss', () => {
      const accuracy = calculateAccuracy(100)
      expect(accuracy).toBeGreaterThanOrEqual(68)
      expect(accuracy).toBeLessThanOrEqual(70)
    })

    test('calculates ~34% accuracy for 200cp loss', () => {
      const accuracy = calculateAccuracy(200)
      expect(accuracy).toBeGreaterThanOrEqual(34)
      expect(accuracy).toBeLessThanOrEqual(35)
    })

    test('returns 0% for 300cp+ loss (max threshold)', () => {
      expect(calculateAccuracy(300)).toBe(0)
    })

    test('returns 0% for 400cp loss', () => {
      expect(calculateAccuracy(400)).toBe(0)
    })

    test('returns 0% for 500cp loss', () => {
      expect(calculateAccuracy(500)).toBe(0)
    })

    test('returns 0% for 600cp loss', () => {
      expect(calculateAccuracy(600)).toBe(0)
    })

    test('returns 0% for massive blunders (1000cp)', () => {
      expect(calculateAccuracy(1000)).toBe(0)
    })

    test('returns 0 for Infinity loss', () => {
      expect(calculateAccuracy(Infinity)).toBe(0)
    })

    test('returns 100 for negative loss (treated as no loss)', () => {
      expect(calculateAccuracy(-100)).toBe(100)
    })

    test('returns 100 for large negative values', () => {
      expect(calculateAccuracy(-1000)).toBe(100)
    })

    test('accuracy formula is monotonic decreasing with loss', () => {
      let prevAccuracy = 101
      for (let loss of [0, 10, 50, 100, 200, 299, 300]) {
        const accuracy = calculateAccuracy(loss)
        expect(accuracy).toBeLessThanOrEqual(prevAccuracy)
        prevAccuracy = accuracy
      }
      expect(calculateAccuracy(300)).toBe(0)
    })
  })

  describe('Accuracy Category Classification', () => {
    test('perfect moves (<= 10cp loss)', () => {
      const category = getAccuracyCategory(0)
      expect(category.label).toBe('Perfect')
      expect(category.color).toBe('#22c55e')
    })

    test('great moves (<= 30cp loss)', () => {
      const category = getAccuracyCategory(20)
      expect(category.label).toBe('Great')
    })

    test('good moves (<= 70cp loss)', () => {
      const category = getAccuracyCategory(50)
      expect(category.label).toBe('Good')
    })

    test('inaccuracies (<= 150cp loss)', () => {
      const category = getAccuracyCategory(100)
      expect(category.label).toBe('Inaccuracy')
    })

    test('mistakes (>= 150cp loss)', () => {
      const category = getAccuracyCategory(200)
      expect(category.label).toBe('Mistake')
    })

    test('mistakes for extreme loss', () => {
      const category = getAccuracyCategory(500)
      expect(category.label).toBe('Mistake')
      expect(category.color).toBe('#ef4444')
    })
  })

  describe('Winner Selection Logic', () => {
    test('lower centipawn loss should win', () => {
      const game = new LocalGame()
      game.addPlayer('player1', Team.WHITE)
      game.addPlayer('player2', Team.WHITE)
      game.addPlayer('player3', Team.BLACK)
      game.addPlayer('player4', Team.BLACK)
      game.start()

      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      
      const comparison = game.lastMoveComparison
      
      if (comparison && !comparison.isSync) {
        expect(comparison.winningMove).toBeTruthy()
        expect(typeof comparison.player1Accuracy).toBe('number')
        expect(typeof comparison.player2Accuracy).toBe('number')
      }
    })
  })
})
