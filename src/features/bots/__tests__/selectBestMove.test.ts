import { ChessBot, createBot } from '../chessBot'
import { Chess } from 'chess.js'

function createMockEvaluator(scores: { move: string; score: number }[]) {
  return {
    evaluateMoves: jest.fn().mockResolvedValue(scores),
    isUsingStockfish: () => true,
    isReady: () => true,
  }
}

describe('selectBestMove — uses humanized pipeline via pickSmartMoveAsync', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  it('returns a valid UCI move from scored engine results', async () => {
    const mock = createMockEvaluator([
      { move: 'e2e4', score: 30 },
      { move: 'd2d4', score: 20 },
      { move: 'g1f3', score: 15 },
    ])
    const chess = new Chess(startFen)
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to)
    const bot = createBot({ skillLevel: 6, mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(startFen)
    expect(result).toBeTruthy()
    expect(legalMoves).toContain(result)
  })

  it('returns a valid UCI move even with mixed scored/unscored results', async () => {
    const captureFen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    const scoredResults = [{ move: 'e4d5', score: 300 }]
    const chess = new Chess(captureFen)
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''))
    const allResults = legalMoves.map(m => {
      const scored = scoredResults.find(s => s.move === m)
      return scored || { move: m, score: 0 }
    })

    const mock = createMockEvaluator(allResults)
    const bot = createBot({ skillLevel: 6, mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(captureFen)
    expect(result).toBeTruthy()
    expect(legalMoves).toContain(result)
  })

  it('returns a valid UCI move when all engine scores are zero', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const chess = new Chess(fen)
    const allMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''))
    const allResults = allMoves.map(m => ({ move: m, score: 0 }))

    const mock = createMockEvaluator(allResults)
    const bot = createBot({ skillLevel: 6, mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(fen)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('returns null when there are no legal moves', async () => {
    const checkmateFen = '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'
    const mock = createMockEvaluator([])
    const bot = createBot({ skillLevel: 6, mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(checkmateFen)
    expect(result).toBeNull()
  })

  it('returns the single legal move when only one exists', async () => {
    const fen = '6k1/6Q1/6K1/8/8/8/8/8 b - - 0 1'
    const chess = new Chess(fen)
    const legalMoves = chess.moves({ verbose: true })
    if (legalMoves.length !== 1) return
    const uci = legalMoves[0].from + legalMoves[0].to + (legalMoves[0].promotion || '')
    const mock = createMockEvaluator([{ move: uci, score: 0 }])
    const bot = createBot({ skillLevel: 6, mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(fen)
    expect(result).toBe(uci)
  })

  it('BLACK side: picks the best side-to-move scored move (white-perspective normalization)', async () => {
    // Regression: evaluateMovesWithFallback must normalize Stockfish's
    // side-to-move scores to white perspective before the black ascending
    // sort. Without it, black picks its WORST move (weaker bot).
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
    const chess = new Chess(fen)
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''))

    // Side-to-move (black) perspective: +120 = good for black, -120 = bad for black.
    const scored = [
      { move: 'g8f6', score: 120 },
      { move: 'h7h6', score: -120 },
    ]
    const allResults = legalMoves.map(m => scored.find(s => s.move === m) || { move: m, score: 0 })

    const mock = createMockEvaluator(allResults)
    const bot = createBot({ skillLevel: 6, mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(fen)
    expect(result).toBe('g8f6')
  })
})
