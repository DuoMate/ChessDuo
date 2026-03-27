import { MoveEvaluator } from '../moveEvaluator'

describe('Move Evaluator', () => {
  let evaluator: MoveEvaluator

  beforeEach(() => {
    evaluator = new MoveEvaluator()
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
})
