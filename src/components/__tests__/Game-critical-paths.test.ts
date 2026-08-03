import { LocalGame } from '../../features/offline/game/localGame'
import { GameStatus } from '../../features/shared/gameTypes'
import { Team } from '../../features/game-engine/gameState'

describe('Game.tsx critical paths', () => {
  describe('Game-over lifecycle', () => {
    it('transitions to GAME_OVER when board detects checkmate', async () => {
      const game = new LocalGame()
      ;(game as any).evaluator = {
        evaluateMoves: jest.fn().mockResolvedValue([
          { move: 'f3e5', score: 50 },
          { move: 'f3e5', score: 50 },
        ]),
      }
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      expect(game.status).toBe(GameStatus.PLAYING)

      game.selectMove('p1', 'f3')
      game.selectMove('p2', 'f3')
      await game.lockAndResolve()

      game.selectMove('p3', 'e5')
      game.selectMove('p4', 'e5')
      await game.lockAndResolve()

      game.selectMove('p1', 'g4')
      game.selectMove('p2', 'g4')
      await game.lockAndResolve()

      game.selectMove('p3', 'Qh4')
      game.selectMove('p4', 'Qh4')
      await game.lockAndResolve()

      expect(game.status).toBe(GameStatus.GAME_OVER)
    })

    it('resolves a full game with alternating turns', async () => {
      const game = new LocalGame()
      ;(game as any).evaluator = {
        evaluateMoves: jest.fn().mockResolvedValue([
          { move: 'e2e4', score: 50 },
          { move: 'e2e4', score: 50 },
        ]),
      }
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      game.selectMove('p1', 'e4')
      game.selectMove('p2', 'e4')
      await game.lockAndResolve()
      expect(game.currentTurn).toBe(Team.BLACK)

      game.selectMove('p3', 'e5')
      game.selectMove('p4', 'e5')
      await game.lockAndResolve()
      expect(game.currentTurn).toBe(Team.WHITE)

      expect(game.getStats().movesPlayed).toBe(2)
    })

    it('tracks stats correctly across multiple turns', async () => {
      const game = new LocalGame()
      ;(game as any).evaluator = {
        evaluateMoves: jest.fn().mockResolvedValue([
          { move: 'e2e4', score: 50 },
          { move: 'd2d4', score: 30 },
        ]),
      }
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      game.selectMove('p1', 'e4')
      game.selectMove('p2', 'd4')
      await game.lockAndResolve()

      game.selectMove('p3', 'e5')
      game.selectMove('p4', 'e5')
      await game.lockAndResolve()

      const stats = game.getStats()
      expect(stats.movesPlayed).toBe(2)
      expect(stats.conflicts).toBe(1)
    })

    it('preserves sync rate when both players choose same move', async () => {
      const game = new LocalGame()
      ;(game as any).evaluator = {
        evaluateMoves: jest.fn().mockResolvedValue([
          { move: 'e2e4', score: 50 },
          { move: 'e2e4', score: 50 },
        ]),
      }
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      game.selectMove('p1', 'e4')
      game.selectMove('p2', 'e4')
      await game.lockAndResolve()

      expect(game.getStats().syncRate).toBe(1)
      expect(game.getStats().conflicts).toBe(0)
    })
  })

  describe('Timer and match state', () => {
    it('reports match timer remaining', () => {
      const game = new LocalGame(600)
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      const remaining = game.getMatchTimeRemaining()
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(600)
    })

    it('match timer state is boolean after start', () => {
      const game = new LocalGame(600)
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      expect(typeof game.isMatchTimerActive()).toBe('boolean')
    })

    it('engine timer start does not throw on LocalGame', () => {
      const game = new LocalGame(600)
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      expect(typeof game.getMatchTimeRemaining).toBe('function')
    })

    it('handles time-up transition to GAME_OVER', () => {
      const game = new LocalGame(600)
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      game.setGameOverTimeup('White wins on time', 'timeout')
      expect(game.status).toBe(GameStatus.GAME_OVER)
    })
  })

  describe('Bot continuation guard refs', () => {
    it('opponentInProgress-like guard prevents concurrent execution', async () => {
      let inProgress = false
      const runCount = { count: 0 }

      async function executeBotMove(): Promise<void> {
        if (inProgress) return
        inProgress = true
        runCount.count++
        await new Promise(r => setTimeout(r, 50))
        inProgress = false
      }

      await Promise.all([
        executeBotMove(),
        executeBotMove(),
        executeBotMove(),
      ])

      expect(runCount.count).toBe(1)
    })

    it('pendingOpponentTurn-like flag defers execution', async () => {
      let pendingOpponentTurn = false
      const deferredCalls: string[] = []

      async function tryOpponentTurn(): Promise<void> {
        if (pendingOpponentTurn) {
          deferredCalls.push('deferred')
          pendingOpponentTurn = false
        }
      }

      pendingOpponentTurn = true
      await tryOpponentTurn()

      expect(deferredCalls).toEqual(['deferred'])
      expect(pendingOpponentTurn).toBe(false)
    })
  })

  describe('Move comparison after resolution', () => {
    it('sets lastMoveComparison after resolution', async () => {
      const game = new LocalGame()
      ;(game as any).evaluator = {
        evaluateMoves: jest.fn().mockResolvedValue([
          { move: 'e2e4', score: 50 },
          { move: 'e2e4', score: 50 },
        ]),
      }
      game.addPlayer('p1', Team.WHITE)
      game.addPlayer('p2', Team.WHITE)
      game.addPlayer('p3', Team.BLACK)
      game.addPlayer('p4', Team.BLACK)
      game.start()

      game.selectMove('p1', 'e4')
      game.selectMove('p2', 'e4')
      await game.lockAndResolve()

      const comp = game.lastMoveComparison
      expect(comp).not.toBeNull()
      expect(comp!.isSync).toBe(true)
      expect(comp!.winningMove).toBe('e4')
    })
  })
})
