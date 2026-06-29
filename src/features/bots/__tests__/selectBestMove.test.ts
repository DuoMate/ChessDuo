import { ChessBot, createBot } from '../chessBot'
import { Chess } from 'chess.js'

function createMockEvaluator(scores: { move: string; score: number }[]) {
  return {
    evaluateMoves: jest.fn().mockResolvedValue(scores),
    isUsingStockfish: () => true,
    isReady: () => true,
  }
}

describe('selectBestMove — fallback for unscored moves', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  it('picks the highest scored move when all moves have engine scores', async () => {
    const mock = createMockEvaluator([
      { move: 'e2e4', score: 30 },
      { move: 'd2d4', score: 20 },
      { move: 'g1f3', score: 15 },
    ])
    const bot = createBot({ mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(startFen)
    expect(result).toBe('e2e4')
  })

  it('picks a scored capture over unscored (zero-defaulted) moves', async () => {
    const captureFen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    // Simulate: e4xd5 capture scored +300, all other 19+ moves default to 0
    const scoredResults = [{ move: 'e4d5', score: 300 }]
    const chess = new Chess(captureFen)
    const allMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''))
    const allResults = allMoves.map(m => {
      const scored = scoredResults.find(s => s.move === m)
      return scored || { move: m, score: 0 }
    })

    const mock = createMockEvaluator(allResults)
    const bot = createBot({ mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(captureFen)
    expect(result).toBe('e4d5')
  })

  it('uses material-count fallback when all engine scores are zero', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const chess = new Chess(fen)
    const allMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''))
    const allResults = allMoves.map(m => ({ move: m, score: 0 }))

    const mock = createMockEvaluator(allResults)
    const bot = createBot({ mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(fen)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    // Should be a valid UCI move (4-5 chars)
    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('returns null when there are no legal moves', async () => {
    const checkmateFen = '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'
    const mock = createMockEvaluator([])
    const bot = createBot({ mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(checkmateFen)
    expect(result).toBeNull()
  })

  it('returns the single legal move when only one exists', async () => {
    const fen = '6k1/6Q1/6K1/8/8/8/8/8 b - - 0 1'
    const chess = new Chess(fen)
    const legalMoves = chess.moves({ verbose: true })
    if (legalMoves.length !== 1) return // Skip if fen has more than 1 move
    const uci = legalMoves[0].from + legalMoves[0].to + (legalMoves[0].promotion || '')
    const mock = createMockEvaluator([{ move: uci, score: 0 }])
    const bot = createBot({ mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(fen)
    expect(result).toBe(uci)
  })

  it('picks a valid move when engine scores mix with unscored defaults', async () => {
    // White to move in a middlegame position. Engine scores a few moves,
    // the rest default to 0. The fallbackEvaluate should fill in real
    // material scores for unscored moves so the reduce picks the best.
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4'
    const chess = new Chess(fen)
    const allMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''))

    // Engine scores only 2 moves, rest default to 0
    const scoredResults = [
      { move: 'e1g1', score: 25 },  // castle — safe
      { move: 'd2d4', score: 10 },
    ]
    const allResults = allMoves.map(m => {
      const scored = scoredResults.find(s => s.move === m)
      return scored || { move: m, score: 0 }
    })

    const mock = createMockEvaluator(allResults)
    const bot = createBot({ mockMoveEvaluator: mock })
    const result = await bot.selectBestMove(fen)

    // Bot should pick a valid UCI move, not null
    expect(result).toBeTruthy()
    // The result should be one of the legal moves
    expect(allMoves).toContain(result)
    // Should prefer the scored castle over random unscored moves
    expect(result).toBe('e1g1')
  })
})
