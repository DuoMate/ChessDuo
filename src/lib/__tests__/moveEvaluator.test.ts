import { MoveEvaluator } from '../moveEvaluator'

describe('Move Evaluator', () => {
  let evaluator: MoveEvaluator

  beforeEach(() => {
    evaluator = new MoveEvaluator(10)
  })

  test('evaluates a single move and returns score', async () => {
    const evaluation = await evaluator.evaluateMove('e4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    
    expect(evaluation.score).toBeDefined()
    expect(typeof evaluation.score).toBe('number')
  })

  test('compares two moves and returns winner', async () => {
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

  test('handles same moves as draw', async () => {
    const result = await evaluator.compareMoves(
      'e4',
      'e4',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    )
    
    expect(result.winner).toBe('draw')
  })

  test('returns centipawn loss', async () => {
    const result = await evaluator.compareMoves(
      'e4',
      'a4',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    )
    
    expect(result.centipawnLoss).toBeDefined()
    expect(typeof result.centipawnLoss).toBe('number')
  })

  test('handles illegal moves gracefully', async () => {
    const result = await evaluator.compareMoves(
      'e5',
      'e4',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    )
    
    expect(result.winner).toBe('e4')
  })

  describe('search depth configuration', () => {
    test('constructor accepts search depth parameter', () => {
      const eval1 = new MoveEvaluator(5)
      const eval2 = new MoveEvaluator(15)
      
      expect(eval1.getSearchDepth()).toBe(5)
      expect(eval2.getSearchDepth()).toBe(15)
    })

    test('search depth is clamped to valid range', () => {
      const evalLow = new MoveEvaluator(-5)
      const evalHigh = new MoveEvaluator(100)
      const evalZero = new MoveEvaluator(0)
      
      expect(evalLow.getSearchDepth()).toBe(1)
      expect(evalHigh.getSearchDepth()).toBe(20)
      expect(evalZero.getSearchDepth()).toBe(1)
    })

    test('setSearchDepth updates the depth', () => {
      const evaluator = new MoveEvaluator(5)
      
      expect(evaluator.getSearchDepth()).toBe(5)
      
      evaluator.setSearchDepth(8)
      expect(evaluator.getSearchDepth()).toBe(8)
      
      evaluator.setSearchDepth(25)
      expect(evaluator.getSearchDepth()).toBe(20)
      
      evaluator.setSearchDepth(-1)
      expect(evaluator.getSearchDepth()).toBe(1)
    })

    test('different depths produce different evaluations', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const eval1 = new MoveEvaluator(1)
      const eval2 = new MoveEvaluator(10)
      
      const score1 = await eval1.evaluateMove('e4', fen)
      const score2 = await eval2.evaluateMove('e4', fen)
      
      expect(typeof score1.score).toBe('number')
      expect(typeof score2.score).toBe('number')
    })
  })
})
