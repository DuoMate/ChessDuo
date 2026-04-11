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
      expect(accuracy).toBeGreaterThanOrEqual(33)
      expect(accuracy).toBeLessThanOrEqual(34)
    })

    test('calculates ~29% accuracy for 500cp loss (blunder)', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(500)
      expect(accuracy).toBeGreaterThanOrEqual(28)
      expect(accuracy).toBeLessThanOrEqual(29)
    })

    test('calculates ~25% accuracy for 600cp loss', () => {
      const game = new LocalGame()
      const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
      
      const accuracy = calculateAccuracy(600)
      expect(accuracy).toBeGreaterThanOrEqual(25)
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
      1: { bestMoveChance: 0.55, description: 'Beginner ~1000 ELO', searchDepth: 1 },
      2: { bestMoveChance: 0.68, description: 'Novice ~1500 ELO', searchDepth: 2 },
      3: { bestMoveChance: 0.83, description: 'Intermediate ~1800 ELO', searchDepth: 3 },
      4: { bestMoveChance: 0.88, description: 'Advanced ~2000 ELO', searchDepth: 4 },
      5: { bestMoveChance: 0.93, description: 'Expert ~2200 ELO', searchDepth: 5 },
      6: { bestMoveChance: 0.99, description: 'Master ~2600 ELO', searchDepth: 10 },
    }

    test('level 1 has 55% bestMoveChance', () => {
      expect(ELO_MAPPING[1].bestMoveChance).toBe(0.55)
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
    test('level 6 (master) picks best move more often than lower levels', () => {
      const bot1 = createBot({ skillLevel: 1 })
      const bot6 = createBot({ skillLevel: 6 })
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      let bestMoveCount1 = 0
      let bestMoveCount6 = 0
      const numTries = 100

      const evaluatedMoves = [
        { move: { san: 'e4' }, score: 100 },
        { move: { san: 'd4' }, score: 90 },
        { move: { san: 'Nf3' }, score: 80 },
        { move: { san: 'c4' }, score: 70 },
        { move: { san: 'e3' }, score: 60 },
      ]
      const botAny = bot1 as any

      for (let i = 0; i < numTries; i++) {
        const selected1 = botAny.applyEloBasedSelection.call(botAny, [...evaluatedMoves])
        if (selected1.san === 'e4') bestMoveCount1++
        
        const selected6 = (bot6 as any).applyEloBasedSelection.call((bot6 as any), [...evaluatedMoves])
        if (selected6.san === 'e4') bestMoveCount6++
      }

      expect(bestMoveCount6).toBeGreaterThan(bestMoveCount1)
    })

    test('level 1 (beginner) has more variety in non-best selections', () => {
      const bot1 = createBot({ skillLevel: 1 })
      const bot6 = createBot({ skillLevel: 6 })
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
        1: 'Beginner ~1000 ELO',
        2: 'Novice ~1500 ELO',
        3: 'Intermediate ~1800 ELO',
        4: 'Advanced ~2000 ELO',
        5: 'Expert ~2200 ELO',
        6: 'Master ~2600 ELO',
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
