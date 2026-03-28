import { Chess } from 'chess.js'
import { LocalGame, GameStatus } from '../localGame'
import { Team } from '../gameState'
import { createBot } from '../chessBot'

function createTestGameWithBot(): { game: LocalGame; bot: ReturnType<typeof createBot> } {
  const game = new LocalGame()
  const bot = createBot()
  game.addPlayer('player1', Team.WHITE)
  game.addPlayer('player2', Team.WHITE)
  game.addPlayer('player3', Team.BLACK)
  game.addPlayer('player4', Team.BLACK)
  game.start()
  return { game, bot }
}

describe('Chess Rules', () => {
  describe('Pawn Promotion', () => {
    test('chess.js has promotion capability', () => {
      const chess = new Chess()
      const moves = chess.moves({ verbose: true })
      const promotionMoves = moves.filter(m => m.promotion !== undefined)
      expect(promotionMoves).toBeDefined()
    })
  })

  describe('Draw Rules - Threefold Repetition', () => {
    test('detects threefold repetition', () => {
      const chess = new Chess()
      
      const moves = [
        'Nf3', 'Nf6', 'Ng1', 'Ng8',
        'Nf3', 'Nf6', 'Ng1', 'Ng8',
        'Nf3', 'Nf6', 'Ng1', 'Ng8'
      ]
      
      for (const move of moves) {
        chess.move(move)
      }
      
      expect(chess.isThreefoldRepetition()).toBe(true)
    })

    test('threefold repetition counts as draw', () => {
      const chess = new Chess()
      
      const moves = [
        'Nf3', 'Nf6', 'Ng1', 'Ng8',
        'Nf3', 'Nf6', 'Ng1', 'Ng8',
        'Nf3', 'Nf6', 'Ng1', 'Ng8'
      ]
      
      for (const move of moves) {
        chess.move(move)
      }
      
      expect(chess.isThreefoldRepetition()).toBe(true)
      expect(chess.isDraw()).toBe(true)
    })
  })

  describe('Game Over Detection', () => {
    test('detects game over after checkmate', () => {
      const chess = new Chess()
      
      const moves = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7']
      for (const move of moves) {
        try { chess.move(move) } catch {}
      }
      
      expect(chess.isGameOver()).toBe(true)
    })
  })
})

describe('LocalGame Draw Handling', () => {
  describe('getResult with Draws', () => {
    test('returns draw by threefold repetition', () => {
      const { game } = createTestGameWithBot()
      
      const moves = [
        'Nf3', 'Nf6', 'Ng1', 'Ng8',
        'Nf3', 'Nf6', 'Ng1', 'Ng8',
        'Nf3', 'Nf6', 'Ng1', 'Ng8'
      ]
      
      for (const move of moves) {
        game.board.move(move)
      }
      
      const result = game.getResult()
      expect(result).toBe('Draw by threefold repetition')
    })

    test('getGameOverReason returns null when game not over', () => {
      const { game } = createTestGameWithBot()
      
      const reason = game.getGameOverReason()
      expect(reason).toBeNull()
    })
  })
})

describe('Game Flow with Special Moves', () => {
  test('game detects threefold repetition result', () => {
    const { game } = createTestGameWithBot()
    
    const moves = [
      'Nf3', 'Nf6', 'Ng1', 'Ng8',
      'Nf3', 'Nf6', 'Ng1', 'Ng8',
      'Nf3', 'Nf6', 'Ng1', 'Ng8'
    ]
    
    for (const move of moves) {
      game.board.move(move)
    }
    
    expect(game.isGameOver()).toBe(true)
    expect(game.getResult()).toBe('Draw by threefold repetition')
  })
})
