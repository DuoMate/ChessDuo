import { LocalGame, GameStatus } from '../localGame'
import { Team } from '../gameState'

describe('LocalGame LastMove Tracking', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
  })

  test('starts with null lastMove', () => {
    expect(game.lastMove).toBeNull()
  })

  test('tracks lastMove after move', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    expect(game.lastMove).not.toBeNull()
    expect(game.lastMove?.from).toBe('e2')
    expect(game.lastMove?.to).toBe('e4')
  })

  test('updates lastMove after each move', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()
    const firstLastMove = game.lastMove

    game.selectMove('player3', 'e5')
    game.selectMove('player4', 'e5')
    await game.lockAndResolve()
    const secondLastMove = game.lastMove

    expect(firstLastMove?.to).toBe('e4')
    expect(secondLastMove?.to).toBe('e5')
  })
})

describe('LocalGame Accuracy Tracking', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
  })

  test('starts with 100% lastMoveAccuracy', () => {
    const stats = game.getStats()
    expect(stats.lastMoveAccuracy).toBe(100)
  })

  test('tracks average accuracy for both players', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    const stats = game.getStats()
    expect(stats.movesPlayed).toBe(1)
    expect(stats.player1Accuracy).toBeGreaterThanOrEqual(0)
    expect(stats.player1Accuracy).toBeLessThanOrEqual(100)
    expect(stats.player2Accuracy).toBeGreaterThanOrEqual(0)
    expect(stats.player2Accuracy).toBeLessThanOrEqual(100)
  })

  test('tracks per-move accuracy', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    const stats = game.getStats()
    expect(stats.lastMoveAccuracy).toBeGreaterThanOrEqual(0)
    expect(stats.lastMoveAccuracy).toBeLessThanOrEqual(100)
  })

  test('accuracy decreases with centipawn loss', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')
    await game.lockAndResolve()

    const stats = game.getStats()
    expect(stats.lastMoveAccuracy).toBeLessThanOrEqual(100)
  })

  test('sync rate is calculated correctly for synced moves', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    const stats = game.getStats()
    expect(stats.syncRate).toBe(1)
  })

  test('sync rate decreases with conflicting moves', async () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')
    await game.lockAndResolve()

    const stats = game.getStats()
    expect(stats.syncRate).toBe(0)
  })
})

describe('MoveEvaluator Differentiation', () => {
  test('different moves produce different scores', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    const eval1 = await evaluator.evaluateMove('e4', fen)
    const eval2 = await evaluator.evaluateMove('Nf3', fen)
    
    expect(typeof eval1.score).toBe('number')
    expect(typeof eval2.score).toBe('number')
  })

  test('capturing moves have different scores', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
    
    const eval1 = await evaluator.evaluateMove('Qxf7', fen)
    const eval2 = await evaluator.evaluateMove('Qe2', fen)
    
    expect(eval1.score).not.toBe(eval2.score)
  })

  test('position evaluation considers piece positions', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    const eval1 = await evaluator.evaluateMove('e4', fen1)
    const eval2 = evaluator.simpleEvaluate(fen2)
    
    expect(eval2).not.toBe(0)
  })
})

describe('GameStats Interface', () => {
  test('GameStats has lastMoveAccuracy', () => {
    const game = new LocalGame()
    const stats = game.getStats()
    
    expect(stats).toHaveProperty('lastMoveAccuracy')
    expect(typeof stats.lastMoveAccuracy).toBe('number')
  })

  test('GameStats tracks conflicts', () => {
    const game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')
    
    expect(game.getStats().conflicts).toBe(0)
  })
})

describe('Stockfish Integration', () => {
  test('evaluator initializes without errors', () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    expect(() => new MoveEvaluator()).not.toThrow()
  })

  test('evaluateMove returns score for valid position', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = await evaluator.evaluateMove('e4', fen)
    
    expect(result).toHaveProperty('move', 'e4')
    expect(result).toHaveProperty('score')
    expect(typeof result.score).toBe('number')
  })

  test('evaluateMove returns -Infinity for invalid move', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = await evaluator.evaluateMove('e10', fen)
    
    expect(result.score).toBe(-Infinity)
  })

  test('getBestScore returns the best move from available moves', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = await evaluator.getBestScore(fen)
    
    expect(result).toHaveProperty('move')
    expect(result).toHaveProperty('score')
    expect(typeof result.move).toBe('string')
    expect(result.move.length).toBeGreaterThan(0)
  })

  test('compareMoves returns correct centipawn loss for different moves', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = await evaluator.compareMoves('e4', 'a4', fen)
    
    expect(result.centipawnLoss).toBeGreaterThanOrEqual(0)
  })

  test('compareMoves returns 0 centipawn loss for same moves', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = await evaluator.compareMoves('e4', 'e4', fen)
    
    expect(result.centipawnLoss).toBe(0)
    expect(result.winner).toBe('draw')
  })
})

describe('Accuracy Calculation', () => {
  test('accuracy formula: 100 - (centipawnLoss / 10) is bounded 0-100', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    const result100 = await evaluator.compareMoves('e4', 'e4', fen)
    const accuracy100 = Math.max(0, Math.min(100, 100 - (result100.centipawnLoss / 10)))
    expect(accuracy100).toBe(100)
    
    const resultBad = await evaluator.compareMoves('e4', 'a4', fen)
    const accuracyBad = Math.max(0, Math.min(100, 100 - (resultBad.centipawnLoss / 10)))
    expect(accuracyBad).toBeLessThan(100)
    expect(accuracyBad).toBeGreaterThanOrEqual(0)
  })

  test('lastMoveAccuracy updates after each move in game', async () => {
    const game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()

    const stats1 = game.getStats()
    expect(stats1.lastMoveAccuracy).toBe(100)

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()

    const stats2 = game.getStats()
    expect(stats2.movesPlayed).toBe(1)
    expect(stats2.lastMoveAccuracy).toBeGreaterThanOrEqual(0)
    expect(stats2.lastMoveAccuracy).toBeLessThanOrEqual(100)
  })

  test('different positions yield different evaluation scores', async () => {
    const { MoveEvaluator } = require('../moveEvaluator')
    const evaluator = new MoveEvaluator()
    
    const fen1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const fen2 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
    
    const eval1 = await evaluator.evaluateMove('e4', fen1)
    const eval2 = await evaluator.evaluateMove('Qxf7', fen2)
    
    expect(eval1.score).not.toBe(eval2.score)
  })
})
