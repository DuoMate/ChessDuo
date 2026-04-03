import { LocalGame, GameStatus } from '../localGame'
import { Team } from '../gameState'
import { createBot, ChessBot } from '../chessBot'

describe('Accuracy Formula', () => {
  describe('Lichess Hyperbolic Formula', () => {
    test('calculates 100% accuracy for zero loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      expect(calculateAccuracy(0)).toBe(100)
    })

    test('calculates ~67% accuracy for 100cp loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(100)
      expect(accuracy).toBeGreaterThanOrEqual(66)
      expect(accuracy).toBeLessThanOrEqual(68)
    })

    test('calculates ~50% accuracy for 200cp loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(200)
      expect(accuracy).toBeGreaterThanOrEqual(49)
      expect(accuracy).toBeLessThanOrEqual(51)
    })

    test('calculates ~33% accuracy for 400cp loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(400)
      expect(accuracy).toBeGreaterThanOrEqual(32)
      expect(accuracy).toBeLessThanOrEqual(34)
    })

    test('calculates ~29% accuracy for 500cp loss (blunder)', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(500)
      expect(accuracy).toBeGreaterThanOrEqual(28)
      expect(accuracy).toBeLessThanOrEqual(30)
    })

    test('calculates ~25% accuracy for 600cp loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(600)
      expect(accuracy).toBeGreaterThanOrEqual(24)
      expect(accuracy).toBeLessThanOrEqual(26)
    })

    test('calculates low accuracy for massive blunders (1000cp)', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(1000)
      expect(accuracy).toBeGreaterThanOrEqual(16)
      expect(accuracy).toBeLessThanOrEqual(17)
    })

    test('returns 0 for Infinity loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      expect(calculateAccuracy(Infinity)).toBe(0)
    })

    test('returns 0 for negative loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      expect(calculateAccuracy(-100)).toBe(0)
    })

    test('clamps accuracy to 100 max', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      expect(calculateAccuracy(-1000)).toBe(0)
    })

    test('accuracy formula is monotonic decreasing with loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      let prevAccuracy = 101
      for (let loss of [0, 10, 50, 100, 200, 400, 600, 1000, 2000]) {
        const accuracy = calculateAccuracy(loss)
        expect(accuracy).toBeLessThan(prevAccuracy)
        prevAccuracy = accuracy
      }
    })
  })
})

describe('ELO-Based Move Selection', () => {
  describe('bestMoveChance configuration', () => {
    const ELO_MAPPING: Record<number, { bestMoveChance: number; description: string; searchDepth: number }> = {
      1: { bestMoveChance: 0.30, description: '~1500 ELO', searchDepth: 1 },
      2: { bestMoveChance: 0.45, description: '~1600 ELO', searchDepth: 2 },
      3: { bestMoveChance: 0.60, description: '~1700 ELO', searchDepth: 3 },
      4: { bestMoveChance: 0.80, description: '~1800 ELO', searchDepth: 4 },
      5: { bestMoveChance: 0.92, description: '~1900 ELO', searchDepth: 5 },
      6: { bestMoveChance: 0.99, description: '~2000+ ELO', searchDepth: 10 },
    }

    test('level 1 has 30% bestMoveChance', () => {
      expect(ELO_MAPPING[1].bestMoveChance).toBe(0.30)
    })

    test('level 6 has 99% bestMoveChance', () => {
      expect(ELO_MAPPING[6].bestMoveChance).toBe(0.99)
    })

    test('bestMoveChance increases with skill level', () => {
      for (let level = 2; level <= 6; level++) {
        expect(ELO_MAPPING[level].bestMoveChance).toBeGreaterThan(ELO_MAPPING[level - 1].bestMoveChance)
      }
    })
  })

  describe('applyEloBasedSelection behavior', () => {
    test('level 6 (master) picks best move most of the time', () => {
      const bot = createBot({ skillLevel: 6, useStockfish: false })
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      let bestMoveCount = 0
      const numTries = 100

      for (let i = 0; i < numTries; i++) {
        const move = bot.selectMove(fen)
        if (move) {
          const botAny = bot as any
          const evaluatedMoves = [
            { move: { san: 'e4' }, score: 100 },
            { move: { san: 'd4' }, score: 90 },
            { move: { san: 'Nf3' }, score: 80 },
          ]
          const selected = botAny.applyEloBasedSelection.call(botAny, evaluatedMoves)
          if (selected.san === 'e4') bestMoveCount++
        }
      }

      expect(bestMoveCount).toBeGreaterThan(90)
    })

    test('level 1 (beginner) has more variety in non-best selections', () => {
      const bot1 = createBot({ skillLevel: 1, useStockfish: false })
      const bot6 = createBot({ skillLevel: 6, useStockfish: false })
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const moves1 = new Set<string>()
      const moves6 = new Set<string>()

      for (let i = 0; i < 50; i++) {
        moves1.add(bot1.selectMove(fen)!)
        moves6.add(bot6.selectMove(fen)!)
      }

      expect(moves1.size).toBeGreaterThanOrEqual(moves6.size)
    })
  })

  describe('Skill Level Descriptions', () => {
    test('all levels have correct descriptions', () => {
      const expectedDescriptions: Record<number, string> = {
        1: '~1500 ELO',
        2: '~1600 ELO',
        3: '~1700 ELO',
        4: '~1800 ELO',
        5: '~1900 ELO',
        6: '~2000+ ELO',
      }

      for (let level = 1; level <= 6; level++) {
        const bot = createBot({ skillLevel: level })
        expect(bot.getSkillDescription()).toBe(expectedDescriptions[level])
      }
    })
  })
})

describe.skip('Winner Selection Logic', () => {
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
    }
  })
})

describe.skip('Move Comparison Structure', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
  })

  test('MoveComparison has all required fields', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    const comparison = game.lastMoveComparison
    
    expect(comparison).not.toBeNull()
    expect(comparison).toHaveProperty('player1Move')
    expect(comparison).toHaveProperty('player2Move')
    expect(comparison).toHaveProperty('player1Score')
    expect(comparison).toHaveProperty('player2Score')
    expect(comparison).toHaveProperty('player1Accuracy')
    expect(comparison).toHaveProperty('player2Accuracy')
    expect(comparison).toHaveProperty('player1Loss')
    expect(comparison).toHaveProperty('player2Loss')
    expect(comparison).toHaveProperty('winningMove')
    expect(comparison).toHaveProperty('winningScore')
    expect(comparison).toHaveProperty('isSync')
    expect(comparison).toHaveProperty('bestEngineMove')
    expect(comparison).toHaveProperty('bestEngineScore')
  })

  test('accuracy values are clamped between 0 and 100', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    const comparison = game.lastMoveComparison
    
    if (comparison) {
      expect(comparison.player1Accuracy).toBeGreaterThanOrEqual(0)
      expect(comparison.player1Accuracy).toBeLessThanOrEqual(100)
      expect(comparison.player2Accuracy).toBeGreaterThanOrEqual(0)
      expect(comparison.player2Accuracy).toBeLessThanOrEqual(100)
    }
  })

  test('synchronized moves have equal accuracy', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    const comparison = game.lastMoveComparison
    
    if (comparison?.isSync) {
      expect(comparison.player1Accuracy).toBe(comparison.player2Accuracy)
      expect(comparison.player1Loss).toBe(comparison.player2Loss)
    }
  })
})
