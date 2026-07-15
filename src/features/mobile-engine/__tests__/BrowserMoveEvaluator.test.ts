import { BrowserMoveEvaluator } from '../BrowserMoveEvaluator'
import { evaluationCache } from '../../shared/evaluationCache'

function createMockWorker(): Worker {
  const listeners: Array<(e: MessageEvent) => void> = []
  const worker = {
    postMessage: jest.fn(),
    addEventListener: jest.fn((_type: string, fn: (e: MessageEvent) => void) => {
      listeners.push(fn)
    }),
    removeEventListener: jest.fn((_type: string, fn: (e: MessageEvent) => void) => {
      const idx = listeners.indexOf(fn)
      if (idx >= 0) listeners.splice(idx, 1)
    }),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
    terminate: jest.fn(),
    _emit: (data: string) => {
      const event = { data } as MessageEvent<string>
      for (const fn of listeners) fn(event)
      if (worker.onmessage) worker.onmessage(event)
    },
  } as unknown as Worker
  return worker
}

function mockUciReady(worker: Worker): void {
  const calls = (worker.postMessage as jest.Mock).mock.calls.map((c: string[]) => c[0])
  if (calls.includes('uci') && calls.includes('isready')) {
    ;(worker as any)._emit('readyok')
  }
}

describe('BrowserMoveEvaluator', () => {
  let mockWorker: ReturnType<typeof createMockWorker>
  let originalWorker: typeof Worker

  beforeEach(() => {
    evaluationCache.clear()
    mockWorker = createMockWorker()
    originalWorker = globalThis.Worker
    ;(globalThis as any).Worker = jest.fn(() => mockWorker)
  })

  afterEach(() => {
    ;(globalThis as any).Worker = originalWorker
  })

  describe('constructor and initialization', () => {
    test('creates a Worker with the correct path', () => {
      new BrowserMoveEvaluator()
      expect(globalThis.Worker).toHaveBeenCalledWith('/stockfish/stockfish.js')
    })

    test('sends UCI init commands to worker', () => {
      new BrowserMoveEvaluator()
      const calls = (mockWorker.postMessage as jest.Mock).mock.calls.map((c: string[]) => c[0])
      expect(calls).toContain('uci')
      expect(calls).toContain('setoption name MultiPV value 6')
      expect(calls).toContain('isready')
    })

    test('isReady is false before worker sends readyok', () => {
      const evaluator = new BrowserMoveEvaluator()
      expect(evaluator.isReady()).toBe(false)
    })

    test('isReady becomes true after worker sends readyok', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))
      expect(evaluator.isReady()).toBe(true)
    })

    test('isUsingStockfish returns true', () => {
      const evaluator = new BrowserMoveEvaluator()
      expect(evaluator.isUsingStockfish()).toBe(true)
    })
  })

  describe('error handling', () => {
    test('getInitError returns null on successful init', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))
      expect(evaluator.getInitError()).toBeNull()
    })

    test('getInitError returns error when Worker creation fails', () => {
      ;(globalThis as any).Worker = jest.fn(() => {
        throw new Error('Worker not supported')
      })
      const evaluator = new BrowserMoveEvaluator()
      expect(evaluator.getInitError()).toContain('Failed to create Stockfish worker')
    })

    test('throws when evaluating before engine is ready', async () => {
      const evaluator = new BrowserMoveEvaluator()
      await expect(
        evaluator.evaluateMoves(['e2e4'], 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
      ).rejects.toThrow()
    })
  })

  describe('evaluateMoves', () => {
    test('sends position and go commands with searchmoves', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const moves = ['e2e4', 'd2d4', 'g1f3']

      const resultPromise = evaluator.evaluateMoves(moves, fen)

      await new Promise(r => setTimeout(r, 10))
      const calls = (mockWorker.postMessage as jest.Mock).mock.calls.map((c: string[]) => c[0])
      expect(calls.some((c: string) => c === `position fen ${fen}`)).toBe(true)
      expect(calls.some((c: string) => c.includes('go movetime'))).toBe(true)
      expect(calls.some((c: string) => c.includes('searchmoves'))).toBe(true)
    })

    test('resolves with scores parsed from UCI info output', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const moves = ['e2e4', 'd2d4']

      const resultPromise = evaluator.evaluateMoves(moves, fen)

      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 10 score cp 25 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 15 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result).toHaveLength(2)
      const e4 = result.find(r => r.move === 'e2e4')
      const d4 = result.find(r => r.move === 'd2d4')
      expect(e4?.score).toBe(25)
      expect(d4?.score).toBe(15)
    })

    test('handles mate scores', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const resultPromise = evaluator.evaluateMoves(['e2e4'], 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')

      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 5 score mate 2 pv e2e4 e7e5 g1f3')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result[0].score).toBe(9998)
    })
  })

  describe('playMove', () => {
    test('returns the bestmove from UCI output', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
      const resultPromise = evaluator.playMove(fen, 1000)

      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('bestmove e7e5')

      const result = await resultPromise
      expect(result).toBe('e7e5')
    })

    test('rejects when bestmove is (none)', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const resultPromise = evaluator.playMove('8/8/8/8/8/8/8/8 w - - 0 1', 500)
      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('bestmove (none)')

      await expect(resultPromise).rejects.toThrow('No best move found')
    })
  })

  describe('evaluatePosition', () => {
    test('returns the best score from evaluated moves', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const resultPromise = evaluator.evaluatePosition(fen)

      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const score = await resultPromise
      expect(score).toBe(30)
    })
  })

  describe('evaluateMove', () => {
    test('returns the move and a score from resulting position', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const resultPromise = evaluator.evaluateMove('e2e4', fen)

      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e7e5 g1f3')
      ;(mockWorker as any)._emit('bestmove e7e5')

      const result = await resultPromise
      expect(result.move).toBe('e2e4')
      expect(typeof result.score).toBe('number')
    })
  })

  describe('getBestScore', () => {
    test('returns the single top move and score', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const resultPromise = evaluator.getBestScore(fen)

      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.move).toBe('e2e4')
      expect(result.score).toBe(30)
    })

    test('returns empty move for checkmate position (no legal moves)', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const result = await evaluator.getBestScore('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1')
      expect(result.move).toBe('')
      expect(result.score).toBe(0)
    })

    test('returns a single scored move from evaluation', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const resultPromise = evaluator.getBestScore(fen)

      await new Promise(r => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.move).toBe('e2e4')
      expect(result.score).toBe(30)
    })
  })
})
