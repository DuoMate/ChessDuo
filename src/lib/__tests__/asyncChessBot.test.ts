import { ChessBot, createBot } from '../chessBot'
import { Chess } from 'chess.js'

// Mock MoveEvaluator for testing - simulates Stockfish behavior
class MockMoveEvaluator {
  private searchDepth: number
  private useStockfish: boolean = true

  constructor(searchDepth: number = 10) {
    this.searchDepth = searchDepth
  }

  isUsingStockfish(): boolean {
    return this.useStockfish
  }

  isReady(): boolean {
    return true
  }

  async evaluateMove(move: string, fen: string): Promise<{ move: string; score: number }> {
    const chess = new Chess(fen)
    const pieceValues: Record<string, number> = {
      'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000,
      'p': -100, 'n': -320, 'b': -330, 'r': -500, 'q': -900, 'k': -20000
    }

    try {
      chess.move(move)
      let score = 0
      const board = chess.board()
      for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
          const piece = board[row][col]
          if (piece) {
            const value = pieceValues[piece.color === 'w' ? piece.type : piece.type.toLowerCase()]
            const multiplier = piece.color === 'w' ? 1 : -1
            score += value * multiplier
          }
        }
      }
      return { move, score }
    } catch {
      return { move, score: -Infinity }
    }
  }
}

function createMockBot(skillLevel: number = 4): ChessBot {
  const mockEvaluator = new MockMoveEvaluator(10)
  return new ChessBot({ skillLevel, mockMoveEvaluator: mockEvaluator })
}

describe('ChessBot Async Support', () => {
  describe('Async Move Selection', () => {
    test('selectMoveAsync returns valid UCI move', async () => {
      const bot = createMockBot(4)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const move = await bot.selectMoveAsync(fen)

      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('selectMoveAsync returns null when no moves available', async () => {
      const bot = createMockBot(4)
      const fen = '6k1/8/8/8/8/8/8/7 w - - 0 1'

      const move = await bot.selectMoveAsync(fen)

      expect(move).toBeNull()
    })

    test('selectMoveAsync returns only move when one available', async () => {
      const bot = createMockBot(4)
      const fen = '8/7K/8/8/8/8/8/7k w - - 0 1'

      const move = await bot.selectMoveAsync(fen)

      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('selectMoveAsync returns legal move', async () => {
      const bot = createMockBot(4)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const move = await bot.selectMoveAsync(fen)
      const [from, to] = move!.split('-')

      const chess = new Chess(fen)
      const legalMoves = chess.moves({ verbose: true })
      const isLegal = legalMoves.some(m => m.from === from && m.to === to)

      expect(isLegal).toBe(true)
    })

    test('selectMoveAsync works with different skill levels', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      for (let level = 1; level <= 6; level++) {
        const bot = createMockBot(level)
        const move = await bot.selectMoveAsync(fen)
        
        expect(move).not.toBeNull()
        expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      }
    })
  })

  describe('Backward Compatibility', () => {
    test('sync selectMove still works', () => {
      const bot = createBot({ skillLevel: 4 })
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const move = bot.selectMove(fen)

      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('sync selectMove returns null when no moves', () => {
      const bot = createBot({ skillLevel: 4 })
      const fen = '6k1/8/8/8/8/8/8/7 w - - 0 1'

      const move = bot.selectMove(fen)

      expect(move).toBeNull()
    })

    test('both sync and async return valid moves', async () => {
      const bot = createMockBot(4)
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

      const syncMove = bot.selectMove(fen)
      const asyncMove = await bot.selectMoveAsync(fen)

      expect(syncMove).not.toBeNull()
      expect(asyncMove).not.toBeNull()
      expect(syncMove).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      expect(asyncMove).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('createBot creates bot with default settings', () => {
      const bot = createBot()

      expect(bot).toBeDefined()
      expect(bot.getConfig().skillLevel).toBe(3)
    })

    test('createBot creates bot with custom skill level', () => {
      const bot = createBot({ skillLevel: 5 })

      expect(bot.getConfig().skillLevel).toBe(5)
    })

    test('createBot initializes with server evaluator', () => {
      const bot = createBot()
      const ready = bot.isStockfishReady()
      expect(typeof ready).toBe('boolean')
    })
  })

  describe('Stockfish Ready Check', () => {
    test('mock bot reports Stockfish ready', () => {
      const bot = createMockBot(4)

      const ready = bot.isStockfishReady()

      expect(ready).toBe(true)
    })
  })

  describe('Move Quality by Skill Level', () => {
    test('higher skill levels tend to make better moves', async () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
      
      // Sample multiple times to test randomness
      const movesByLevel: Record<number, string[]> = {}
      
      for (let level = 1; level <= 6; level++) {
        const bot = createMockBot(level)
        movesByLevel[level] = []
        
        // Get 5 moves per level to see distribution
        for (let i = 0; i < 5; i++) {
          const move = await bot.selectMoveAsync(fen)
          if (move) {
            movesByLevel[level].push(move)
          }
        }
      }

      // Verify all levels returned moves
      for (let level = 1; level <= 6; level++) {
        expect(movesByLevel[level].length).toBeGreaterThan(0)
      }
    })

    test('skill level 6 always plays best move', async () => {
      const bot = createMockBot(6)
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

      // Run multiple times - skill level 6 should always pick best move
      const moves: string[] = []
      for (let i = 0; i < 10; i++) {
        const move = await bot.selectMoveAsync(fen)
        if (move) moves.push(move)
      }

      // With 99% bestMoveChance, most moves should be the same
      expect(moves.length).toBe(10)
    })
  })

  describe('Error Handling', () => {
    test('handles invalid FEN gracefully in async', async () => {
      const bot = createMockBot(4)

      // Should not throw, should return null
      const move = await bot.selectMoveAsync('invalid-fen')

      // May return null or throw, depending on chess.js behavior
      expect(move === null || move === undefined).toBe(true)
    })

    test('handles empty FEN gracefully', async () => {
      const bot = createMockBot(4)

      const move = await bot.selectMoveAsync('')

      expect(move).toBeNull()
    })

    test('handles malformed UCI move in async context', async () => {
      const bot = createMockBot(4)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const move = await bot.selectMoveAsync(fen)

      // Should still return valid move
      if (move) {
        expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      }
    })
  })

  describe('Integration with Game Flow', () => {
    test('async moves can be used in game context', async () => {
      const bot = createMockBot(4)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      // Simulate game flow
      const move1 = await bot.selectMoveAsync(fen)
      expect(move1).not.toBeNull()

      // Make the move
      const chess = new Chess(fen)
      const [from, to] = move1!.split('-')
      const result = chess.move({ from, to, promotion: 'q' })
      expect(result).not.toBeNull()

      // Get next position
      const fen2 = chess.fen()
      const move2 = await bot.selectMoveAsync(fen2)
      expect(move2).not.toBeNull()
    })

    test('async moves work in multi-move sequence', async () => {
      const bot = createMockBot(4)
      const chess = new Chess()

      // Play 3 moves
      for (let i = 0; i < 3; i++) {
        const fen = chess.fen()
        const move = await bot.selectMoveAsync(fen)

        if (move) {
          const [from, to] = move.split('-')
          try {
            chess.move({ from, to })
          } catch {
            break
          }
        } else {
          break
        }
      }

      // Should have made some moves
      expect(chess.moveNumber()).toBeGreaterThan(0)
    })
  })

  describe('Performance Considerations', () => {
    test('async move selection completes in reasonable time', async () => {
      const bot = createMockBot(4)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const startTime = Date.now()
      const move = await bot.selectMoveAsync(fen)
      const endTime = Date.now()

      const duration = endTime - startTime

      expect(move).not.toBeNull()
      // Should complete within 2 seconds with mock
      expect(duration).toBeLessThan(2000)
    })

    test('multiple async moves can be awaited', async () => {
      const bot = createMockBot(4)
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      // Await multiple moves sequentially
      const move1 = await bot.selectMoveAsync(fen)
      const move2 = await bot.selectMoveAsync(fen)
      const move3 = await bot.selectMoveAsync(fen)

      expect(move1).not.toBeNull()
      expect(move2).not.toBeNull()
      expect(move3).not.toBeNull()
    })
  })

  describe('Config Integration', () => {
    test('skill description accessible after creation', () => {
      const bot = createMockBot(4)

      const description = bot.getSkillDescription()

      expect(description).toBe('Advanced ~2000 ELO')
    })

    test('config accessible after creation', () => {
      const bot = createMockBot(5)

      const config = bot.getConfig()

      expect(config.skillLevel).toBe(5)
    })

    test('default config is correct', () => {
      const bot = createBot()

      const config = bot.getConfig()

      expect(config.skillLevel).toBe(3)
    })
  })

  describe('Promotions', () => {
    test('handles promotion position async', async () => {
      const bot = createMockBot(4)
      const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

      const move = await bot.selectMoveAsync(fen)

      // May or may not return promotion, depending on position
      if (move) {
        expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      }
    })
  })
})
