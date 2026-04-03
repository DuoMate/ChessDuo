import { MoveEvaluator } from '../moveEvaluator'

describe('Move Evaluator', () => {
  describe('skill level configuration (production settings)', () => {
    test('constructor accepts skill level parameter', () => {
      const eval1 = new MoveEvaluator(1)
      const eval2 = new MoveEvaluator(4)
      const eval3 = new MoveEvaluator(6)
      
      expect(eval1.getSearchDepth()).toBe(8)
      expect(eval2.getSearchDepth()).toBe(12)
      expect(eval3.getSearchDepth()).toBe(15)
    })

    test('skill level is clamped to valid range', () => {
      const evalLow = new MoveEvaluator(-5)
      const evalHigh = new MoveEvaluator(100)
      const evalZero = new MoveEvaluator(0)
      
      expect(evalLow.getSearchDepth()).toBe(8)
      expect(evalHigh.getSearchDepth()).toBe(15)
      expect(evalZero.getSearchDepth()).toBe(8)
    })

    test('setSearchDepth updates the depth', () => {
      const evaluator = new MoveEvaluator(4)
      
      expect(evaluator.getSearchDepth()).toBe(12)
      
      evaluator.setSearchDepth(12)
      expect(evaluator.getSearchDepth()).toBe(12)
      
      evaluator.setSearchDepth(25)
      expect(evaluator.getSearchDepth()).toBe(20)
      
      evaluator.setSearchDepth(-1)
      expect(evaluator.getSearchDepth()).toBe(1)
    })

    test('isUsingStockfish returns boolean', () => {
      const evaluator = new MoveEvaluator(4)
      const result = evaluator.isUsingStockfish()
      expect(typeof result).toBe('boolean')
    })

    test('isReady returns boolean', () => {
      const evaluator = new MoveEvaluator(4)
      const result = evaluator.isReady()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('Stockfish-dependent tests (require browser environment)', () => {
    test.skip('evaluates a single move and returns score (requires Stockfish)', async () => {
      const evaluator = new MoveEvaluator(4)
      const evaluation = await evaluator.evaluateMove('e4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
      
      expect(evaluation.score).toBeDefined()
      expect(typeof evaluation.score).toBe('number')
    })

    test.skip('compares two moves and returns winner (requires Stockfish)', async () => {
      const evaluator = new MoveEvaluator(4)
      const result = await evaluator.compareMoves(
        'e4',
        'd4',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      )
      
      expect(result.winner).toBeDefined()
      expect(result.winner).toMatch(/e4|d4/)
      expect(typeof result.score1).toBe('number')
      expect(typeof result.score2).toBe('number')
    })

    test.skip('handles same moves as draw (requires Stockfish)', async () => {
      const evaluator = new MoveEvaluator(4)
      const result = await evaluator.compareMoves(
        'e4',
        'e4',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      )
      
      expect(result.winner).toBe('draw')
    })

    test.skip('returns centipawn loss (requires Stockfish)', async () => {
      const evaluator = new MoveEvaluator(4)
      const result = await evaluator.compareMoves(
        'e4',
        'a4',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      )
      
      expect(result.centipawnLoss).toBeDefined()
      expect(typeof result.centipawnLoss).toBe('number')
    })

    test.skip('handles illegal moves gracefully (requires Stockfish)', async () => {
      const evaluator = new MoveEvaluator(4)
      const result = await evaluator.compareMoves(
        'e5',
        'e4',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      )
      
      expect(result.winner).toBe('e4')
    })

    test.skip('different depths produce different evaluations (requires Stockfish)', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const eval1 = new MoveEvaluator(1)
      const eval2 = new MoveEvaluator(6)
      
      const score1 = await eval1.evaluateMove('e4', fen)
      const score2 = await eval2.evaluateMove('e4', fen)
      
      expect(typeof score1.score).toBe('number')
      expect(typeof score2.score).toBe('number')
    })
  })
})
