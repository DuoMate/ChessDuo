import { DuelGame } from '../duelGame'

describe('DuelGame engine', () => {
  let game: DuelGame

  beforeEach(() => {
    game = new DuelGame('room-1', 'player1', 'WHITE', 300)
  })

  describe('initial state', () => {
    it('starts in waiting status', () => {
      expect(game.status).toBe('waiting')
    })

    it('has initial FEN', () => {
      expect(game.fen).toContain('rnbqkbnr')
    })

    it('white moves first', () => {
      expect(game.currentTurn).toBe('w')
    })

    it('has no winner initially', () => {
      expect(game.winner).toBeNull()
    })

    it('timers start at the time limit', () => {
      expect(game.whiteTimeRemaining).toBe(300)
      expect(game.blackTimeRemaining).toBe(300)
    })

    it('timer is inactive before game starts', () => {
      expect(game.matchTimerActive).toBe(false)
    })
  })

  describe('setOnStateChange and setOnOpponentMove', () => {
    it('accepts state change callback', () => {
      expect(() => game.setOnStateChange(jest.fn())).not.toThrow()
    })

    it('accepts opponent move callback', () => {
      expect(() => game.setOnOpponentMove(jest.fn())).not.toThrow()
    })
  })

  describe('makeMove', () => {
    beforeEach(() => {
      (game as any)._status = 'playing'
    })

    it('applies a valid UCI move successfully', async () => {
      const result = await game.makeMove('e2e4')
      expect(result.success).toBe(true)
      expect(game.currentTurn).toBe('b')
    })

    it('returns error for invalid move', async () => {
      const result = await game.makeMove('e2e5')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('records SAN move in history', async () => {
      await game.makeMove('e2e4')
      expect(game.moveHistory).toContain('e4')
    })

    it('returns error when game is already over', async () => {
      (game as any)._status = 'game_over'
      const result = await game.makeMove('e2e4')
      expect(result.success).toBe(false)
    })

    it('canMove returns false after game over', async () => {
      (game as any)._status = 'game_over'
      expect(game.canMove()).toBe(false)
    })
  })

  describe('state snapshot', () => {
    it('returns current game state', () => {
      const state = game.state
      expect(state.status).toBe('waiting')
      expect(state.fen).toBeDefined()
      expect(state.currentTurn).toBe('w')
      expect(state.moveHistory).toEqual([])
    })

    it('reflects updated state after moves', async () => {
      (game as any)._status = 'playing'
      await game.makeMove('e2e4')
      const state = game.state
      expect(state.currentTurn).toBe('b')
      expect(state.moveHistory.length).toBe(1)
    })
  })

  describe('turn tracking', () => {
    it('isMyTurn returns true for white player on white turn', () => {
      (game as any)._status = 'playing'
      expect(game.isMyTurn()).toBe(true)
    })

    it('isMyTurn returns false for black player on white turn', () => {
      const blackGame = new DuelGame('room-1', 'player2', 'BLACK', 300)
      ;(blackGame as any)._status = 'playing'
      expect(blackGame.isMyTurn()).toBe(false)
    })

    it('isPlayerWhite is correct', () => {
      expect(game.isPlayerWhite()).toBe(true)
      const blackGame = new DuelGame('room-1', 'player2', 'BLACK', 300)
      expect(blackGame.isPlayerWhite()).toBe(false)
    })
  })

  describe('setGameOver', () => {
    it('sets winner and result', () => {
      game.setGameOver('white', 'White wins', 'checkmate')
      expect(game.winner).toBe('white')
      expect(game.gameResult).toBe('White wins')
      expect(game.status).toBe('game_over')
    })
  })

  describe('resign', () => {
    it('sets game over with opponent winning', () => {
      (game as any)._status = 'playing'
      game.resign()
      expect(game.status).toBe('game_over')
      expect(game.winner).toBe('black')
    })
  })

  describe('cleanup', () => {
    it('destroy does not throw', () => {
      expect(() => game.destroy()).not.toThrow()
    })
  })
})
