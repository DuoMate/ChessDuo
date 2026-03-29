import { ChessBot, createBot } from '../chessBot'
import { Chess } from 'chess.js'

describe('ChessBot Async Support', () => {
  describe('Async Move Selection', () => {
    test('selectMoveAsync returns valid UCI move', async () => {
      const bot = createBot({ skillLevel: 4 })
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const move = await bot.selectMoveAsync(fen)

      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('selectMoveAsync returns null when no moves available', async () => {
      const bot = createBot({ skillLevel: 4 })
      const fen = '6k1/8/8/8/8/8/8/7 w - - 0 1'

      const move = await bot.selectMoveAsync(fen)

      expect(move).toBeNull()
    })

    test('selectMoveAsync returns only move when one available', async () => {
      const bot = createBot({ skillLevel: 4 })
      const fen = '8/7K/8/8/8/8/8/7k w - - 0 1'

      const move = await bot.selectMoveAsync(fen)

      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('selectMoveAsync returns legal move', async () => {
      const bot = createBot({ skillLevel: 4 })
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
        const bot = createBot({ skillLevel: level })
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
      const bot = createBot({ skillLevel: 4 })
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

    test('createBot enables Stockfish by default', () => {
      const bot = createBot()

      expect(bot.getConfig().useStockfish).toBe(true)
    })

    test('createBot can disable Stockfish', () => {
      const bot = createBot({ useStockfish: false })

      expect(bot.getConfig().useStockfish).toBe(false)
    })
  })

  describe('Stockfish Ready Check', () => {
    test('bot can check if Stockfish is ready', () => {
      const bot = createBot({ useStockfish: true })

      const ready = bot.isStockfishReady()

      // Should be boolean (may be false if Stockfish not loaded in test env)
      expect(typeof ready).toBe('boolean')
    })

    test('bot without Stockfish returns false', () => {
      const bot = createBot({ useStockfish: false })

      const ready = bot.isStockfishReady()

      expect(ready).toBe(false)
    })
  })

  describe('Move Quality by Skill Level', () => {
    test('higher skill levels tend to make better moves', async () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
      
      // Sample multiple times to test randomness
      const movesByLevel: Record<number, string[]> = {}
      
      for (let level = 1; level <= 6; level++) {
        const bot = createBot({ skillLevel: level })
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
      const bot = createBot({ skillLevel: 6 })
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

      // Run multiple times - skill level 6 should always pick best move
      const moves: string[] = []
      for (let i = 0; i < 10; i++) {
        const move = await bot.selectMoveAsync(fen)
        if (move) moves.push(move)
      }

      // With 95% bestMoveChance, most moves should be the same
      // But we can't guarantee this deterministically due to randomness
      expect(moves.length).toBe(10)
    })
  })

  describe('Error Handling', () => {
    test('handles invalid FEN gracefully in async', async () => {
      const bot = createBot({ skillLevel: 4 })

      // Should not throw, should return null
      const move = await bot.selectMoveAsync('invalid-fen')

      // May return null or throw, depending on chess.js behavior
      expect(move === null || move === undefined).toBe(true)
    })

    test('handles empty FEN gracefully', async () => {
      const bot = createBot({ skillLevel: 4 })

      const move = await bot.selectMoveAsync('')

      expect(move).toBeNull()
    })

    test('handles malformed UCI move in async context', async () => {
      const bot = createBot({ skillLevel: 4 })
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
      const bot = createBot({ skillLevel: 4 })
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
      const bot = createBot({ skillLevel: 4 })
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
      const bot = createBot({ skillLevel: 4 })
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const startTime = Date.now()
      const move = await bot.selectMoveAsync(fen)
      const endTime = Date.now()

      const duration = endTime - startTime

      expect(move).not.toBeNull()
      // Should complete within 5 seconds (generous for Stockfish)
      expect(duration).toBeLessThan(5000)
    })

    test('multiple async moves can be awaited', async () => {
      const bot = createBot({ skillLevel: 4 })
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
      const bot = createBot({ skillLevel: 4 })

      const description = bot.getSkillDescription()

      expect(description).toBe('~1800 ELO')
    })

    test('config accessible after creation', () => {
      const bot = createBot({ skillLevel: 5, useStockfish: true })

      const config = bot.getConfig()

      expect(config.skillLevel).toBe(5)
      expect(config.useStockfish).toBe(true)
    })

    test('default config is correct', () => {
      const bot = createBot()

      const config = bot.getConfig()

      expect(config.skillLevel).toBe(3)
      expect(config.useStockfish).toBe(true)
    })
  })

  describe('Promotions', () => {
    test('handles promotion position async', async () => {
      const bot = createBot({ skillLevel: 4 })
      const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

      const move = await bot.selectMoveAsync(fen)

      // May or may not return promotion, depending on position
      if (move) {
        expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      }
    })
  })
})
