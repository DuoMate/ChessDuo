import { GameState, GamePhase, Team } from '../../features/game-engine/gameState'
import { LocalGame, GameStatus } from '../../features/offline/game/localGame'

describe('Match Timer', () => {
  describe('GameState match timer', () => {
    let gameState: GameState

    beforeEach(() => {
      gameState = new GameState(600)
    })

    test('initializes with configured time', () => {
      expect(gameState.getMatchTimeRemaining()).toBe(600)
    })

    test('accepts custom time in constructor', () => {
      const gs = new GameState(300)
      expect(gs.getMatchTimeRemaining()).toBe(300)
    })

    test('defaults to 600 seconds if not specified', () => {
      const gs = new GameState()
      expect(gs.getMatchTimeRemaining()).toBe(600)
    })

    test('match timer is not active by default', () => {
      expect(gameState.isMatchTimerActive()).toBe(false)
    })

    test('can set match time remaining', () => {
      gameState.setMatchTimeRemaining(120)
      expect(gameState.getMatchTimeRemaining()).toBe(120)
    })

    test('can activate match timer', () => {
      gameState.setMatchTimerActive(true)
      expect(gameState.isMatchTimerActive()).toBe(true)
    })

    test('can deactivate match timer', () => {
      gameState.setMatchTimerActive(true)
      gameState.setMatchTimerActive(false)
      expect(gameState.isMatchTimerActive()).toBe(false)
    })

    test('startPendingTurn does not reset match timer', () => {
      gameState.addPlayer('w1', Team.WHITE)
      gameState.addPlayer('w2', Team.WHITE)
      gameState.addPlayer('b1', Team.BLACK)
      gameState.addPlayer('b2', Team.BLACK)
      gameState.startMatch()
      gameState.setMatchTimeRemaining(123)
      gameState.startPendingTurn(gameState.fen)
      expect(gameState.getMatchTimeRemaining()).toBe(123)
    })
  })

  describe('LocalGame match timer delegation', () => {
    let game: LocalGame

    beforeEach(() => {
      game = new LocalGame(300)
    })

    test('initializes with configured time', () => {
      expect(game.getMatchTimeRemaining()).toBe(300)
    })

    test('defaults to 600 seconds', () => {
      const g = new LocalGame()
      expect(g.getMatchTimeRemaining()).toBe(600)
    })

    test('delegates setMatchTimeRemaining to GameState', () => {
      game.setMatchTimeRemaining(100)
      expect(game.getMatchTimeRemaining()).toBe(100)
    })

    test('delegates match timer active state', () => {
      expect(game.isMatchTimerActive()).toBe(false)
      game.setMatchTimerActive(true)
      expect(game.isMatchTimerActive()).toBe(true)
    })

    test('getEvaluator returns evaluator instance', () => {
      const evaluator = game.getEvaluator()
      expect(evaluator).toBeDefined()
    })

    test('setGameOverTimeup sets game over state', () => {
      game.addPlayer('player1', Team.WHITE)
      game.addPlayer('player2', Team.WHITE)
      game.addPlayer('player3', Team.BLACK)
      game.addPlayer('player4', Team.BLACK)
      game.start()

      game.setGameOverTimeup('White wins by timeout', 'timeout')
      expect(game.status).toBe(GameStatus.GAME_OVER)
      expect(game.getResult()).toBe('White wins by timeout')
      expect(game.getGameOverReason()).toBe('timeout')
    })

    test('setGameOverResult and setGameOverReason work independently', () => {
      game.setGameOverResult('Custom result')
      game.setGameOverReason('custom')
      expect(game.getResult()).toBe('Custom result')
      expect(game.getGameOverReason()).toBe('custom')
    })
  })

  describe('LocalGame getResult with timeout', () => {
    let game: LocalGame

    beforeEach(() => {
      game = new LocalGame(300)
      game.addPlayer('player1', Team.WHITE)
      game.addPlayer('player2', Team.WHITE)
      game.addPlayer('player3', Team.BLACK)
      game.addPlayer('player4', Team.BLACK)
      game.start()
    })

    test('returns stored timeout result before board state', () => {
      game.setGameOverTimeup('White wins by timeout', 'timeout')
      expect(game.getResult()).toBe('White wins by timeout')
    })

    test('returns stored timeout reason before board state', () => {
      game.setGameOverTimeup('Draw by timeout', 'timeout')
      expect(game.getGameOverReason()).toBe('timeout')
    })
  })
})
