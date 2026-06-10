import { LocalGame, GameStatus } from '../../features/offline/game/localGame'
import { Team } from '../../features/game-engine/gameState'
import { checkRateLimit } from '../../lib/rateLimit'

describe('Bug Bounty — GameInterface Extensions', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
  })

  describe('setTurnState', () => {
    test('is available on LocalGame without throwing', () => {
      expect(() => game.setTurnState('selecting')).not.toThrow()
    })

    test('setTurnState does not change existing game state', () => {
      game.addPlayer('w1', Team.WHITE)
      game.addPlayer('w2', Team.WHITE)
      game.addPlayer('b1', Team.BLACK)
      game.addPlayer('b2', Team.BLACK)
      game.start()

      const statusBefore = game.status
      const turnBefore = game.currentTurn

      game.setTurnState('selecting')
      game.setTurnState('waiting_for_teammate')

      expect(game.status).toBe(statusBefore)
      expect(game.currentTurn).toBe(turnBefore)
    })
  })

  describe('getCoordinatorId', () => {
    test('returns empty string for LocalGame', () => {
      expect(game.getCoordinatorId()).toBe('')
    })

    test('returns empty string after players are added', () => {
      game.addPlayer('w1', Team.WHITE)
      game.addPlayer('w2', Team.WHITE)
      game.addPlayer('b1', Team.BLACK)
      game.addPlayer('b2', Team.BLACK)

      expect(game.getCoordinatorId()).toBe('')
    })
  })

  describe('isCoordinator', () => {
    test('returns false for LocalGame', () => {
      expect(game.isCoordinator()).toBe(false)
    })

    test('returns false after game start in offline mode', () => {
      game.addPlayer('w1', Team.WHITE)
      game.addPlayer('w2', Team.WHITE)
      game.addPlayer('b1', Team.BLACK)
      game.addPlayer('b2', Team.BLACK)
      game.start()

      expect(game.isCoordinator()).toBe(false)
    })
  })

  describe('getTurnState', () => {
    test('returns selecting for fresh game', () => {
      expect(game.getTurnState()).toBe('selecting')
    })
  })

  describe('getPlayerTeam', () => {
    test('returns null for unknown player', () => {
      expect(game.getPlayerTeam('unknown')).toBeNull()
    })

    test('returns WHITE for white team player', () => {
      game.addPlayer('w1', Team.WHITE)
      expect(game.getPlayerTeam('w1')).toBe('WHITE')
    })

    test('returns BLACK for black team player', () => {
      game.addPlayer('b1', Team.BLACK)
      expect(game.getPlayerTeam('b1')).toBe('BLACK')
    })
  })
})

describe('Bug Bounty — Rate Limiting', () => {
  describe('checkRateLimit', () => {
    test('allows requests within limit', () => {
      const result = checkRateLimit('test-123', 10)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    test('decrements remaining counter', () => {
      checkRateLimit('test-456', 5)
      const result = checkRateLimit('test-456', 5)
      expect(result.remaining).toBe(3)
    })

    test('blocks requests over limit', () => {
      const key = 'test-over-limit'
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, 5)
      }
      const result = checkRateLimit(key, 5)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    test('separate keys have independent limits', () => {
      checkRateLimit('key-a', 3)
      checkRateLimit('key-a', 3)
      const resultA = checkRateLimit('key-a', 3)
      expect(resultA.remaining).toBe(0)

      const resultB = checkRateLimit('key-b', 3)
      expect(resultB.allowed).toBe(true)
      expect(resultB.remaining).toBe(2)
    })

    test('returns resetIn as a positive number', () => {
      const result = checkRateLimit('test-reset', 10)
      expect(result.resetIn).toBeGreaterThan(0)
    })

    test('each request consumes one credit from the remaining count', () => {
      const key = 'test-consumption'
      const r1 = checkRateLimit(key, 10)
      const r2 = checkRateLimit(key, 10)
      expect(r2.remaining).toBe(r1.remaining - 1)
    })
  })
})

describe('Bug Bounty — LocalGame Stubs (No Side Effects)', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
  })

  describe('isFourPlayer', () => {
    test('returns false for standard LocalGame', () => {
      expect(game.isFourPlayer()).toBe(false)
    })
  })

  describe('setMatchTimeRemaining', () => {
    test('sets and returns match time remaining', () => {
      game.setMatchTimeRemaining(600)
      expect(game.getMatchTimeRemaining()).toBe(600)
    })
  })

  describe('game over state', () => {
    test('getResult returns game in progress initially', () => {
      expect(game.getResult()).toBe('Game in progress')
    })

    test('getGameOverReason returns null initially', () => {
      expect(game.getGameOverReason()).toBeNull()
    })
  })
})
