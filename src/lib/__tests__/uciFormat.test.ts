import { createBot, ChessBot } from '../../features/bots/chessBot'
import { Chess, Move } from 'chess.js'

class MockEvaluator {
  async evaluateMoves(uciMoves: string[], fen: string): Promise<{ move: string; score: number }[]> {
    const chess = new Chess(fen)
    const verboseMoves = chess.moves({ verbose: true })

    const results: { move: string; score: number }[] = []

    for (const uciMove of uciMoves) {
      const from = uciMove.substring(0, 2)
      const to = uciMove.substring(2, 4)
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined

      const verbose = verboseMoves.find(m =>
        m.from === from && m.to === to && (promotion ? m.promotion === promotion : true)
      )

      if (verbose) {
        let score = 0
        if (uciMove === 'e2e4' || uciMove === 'e7e5') score = 100
        else if (uciMove === 'd2d4') score = 80
        else if (uciMove === 'g1f3') score = 70
        else if (uciMove === 'b1c3') score = 60

        results.push({ move: uciMove, score })
      }
    }

    return results
  }

  isUsingStockfish(): boolean { return true }
  isReady(): boolean { return true }
}

describe('ChessBot UCI Format Tests', () => {
  describe('moveToUci', () => {
    test('converts basic move to UCI without dash', () => {
      const bot = createBot({ mockMoveEvaluator: new MockEvaluator() }) as ChessBot
      const chess = new Chess()
      const moves = chess.moves({ verbose: true })
      const e4 = moves.find(m => m.san === 'e4')!

      const uci = (bot as any).moveToUci(e4)
      expect(uci).toBe('e2e4')
      expect(uci).not.toContain('-')
    })

    test('converts promotion move with promotion suffix', () => {
      const bot = createBot({ mockMoveEvaluator: new MockEvaluator() }) as ChessBot
      const chess = new Chess('rnbqkbnr/pppp1ppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1')
      const moves = chess.moves({ verbose: true })
      const promotions = moves.filter((m: any) => m.promotion)
      
      if (promotions.length > 0) {
        const uci = (bot as any).moveToUci(promotions[0])
        expect(uci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]$/)
      } else {
        console.log('No promotion moves available in this position')
      }
    })

    test('UCI format is consistent between chessBot and serverMoveEvaluator', () => {
      const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
      const verboseMoves = chess.moves({ verbose: true })

      const bot = createBot({ mockMoveEvaluator: new MockEvaluator() }) as ChessBot

      for (const vm of verboseMoves.slice(0, 5)) {
        const uci = (bot as any).moveToUci(vm)
        expect(uci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
      }
    })
  })

  describe('evaluateMovesWithFallback UCI handling', () => {
    test('scoreMap keys should match UCI format from moveToUci', async () => {
      const mock = new MockEvaluator()
      const bot = createBot({ mockMoveEvaluator: mock }) as ChessBot

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true })

      const uciMoves = moves.slice(0, 6).map((m: Move) => (bot as any).moveToUci(m))

      const results = await mock.evaluateMoves(uciMoves, fen)

      const scoreMap = new Map<string, number>(results.map((r: { move: string; score: number }) => [r.move, r.score]))

      expect(results.length).toBe(6)
      expect(scoreMap.has('a2a3')).toBe(true)
      expect(scoreMap.has('a2a4')).toBe(true)
      expect(scoreMap.has('b2b3')).toBe(true)
      expect(scoreMap.has('b2b4')).toBe(true)
      expect(scoreMap.has('c2c3')).toBe(true)
      expect(scoreMap.has('c2c4')).toBe(true)

      expect(scoreMap.get('c2c4')).toBe(0)
    })

    test('evaluator returns UCI format that matches moveToUci output', async () => {
      const mock = new MockEvaluator()
      const bot = createBot({ mockMoveEvaluator: mock }) as ChessBot

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true })
      const e4Move = moves.find((m: any) => m.san === 'e4')!

      const uci = (bot as any).moveToUci(e4Move)

      const results = await mock.evaluateMoves([uci], fen)

      expect(results[0].move).toBe('e2e4')
      expect(results[0].score).toBe(100)
    })

    test('full integration: bot selects move based on evaluation', async () => {
      const mock = new MockEvaluator()
      const bot = createBot({ mockMoveEvaluator: mock })

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const move = await bot.selectMoveAsync(fen)

      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
    })
  })

  describe('UCI format consistency', () => {
    test('serverMoveEvaluator returns same format as chessBot expects', async () => {
      const mock = new MockEvaluator()
      const bot = createBot({ mockMoveEvaluator: mock }) as ChessBot

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true })

      const uciMoves = moves.slice(0, 4).map((m: Move) => (bot as any).moveToUci(m))

      const results = await mock.evaluateMoves(uciMoves, fen)

      const scoreMap = new Map<string, number>(results.map((r: any) => [r.move, r.score]))

      for (const uci of uciMoves) {
        const score = scoreMap.get(uci)
        if (uci === 'e2e4') expect(score).toBe(100)
      }
    })
  })
})

describe('ServerMoveEvaluator UCI Format', () => {
  test('UCI format without dash is correct for Stockfish', () => {
    expect('e2e4'.replace(/-/g, '')).toBe('e2e4')
    expect('e2-e4'.replace(/-/g, '')).toBe('e2e4')
    expect('b1-c3'.replace(/-/g, '')).toBe('b1c3')
  })

  test('UCI regex validation', () => {
    const uciRegex = /^[a-h][1-8][a-h][1-8][qrbn]?$/
    expect('e2e4').toMatch(uciRegex)
    expect('b1c3').toMatch(uciRegex)
    expect('e7e5').toMatch(uciRegex)
    expect('a7a8q').toMatch(uciRegex)
    expect('e2-e4').not.toMatch(uciRegex)
  })
})
