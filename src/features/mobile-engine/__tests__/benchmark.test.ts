/**
 * Benchmark & Correctness Test Suite
 *
 * Validates MultiPV=6 + eager init against expected behavior.
 * Uses mock Worker — no actual Stockfish execution.
 */

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

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('Benchmark — MultiPV=6 correctness', () => {
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

  describe('Eager init: worker lifecycle', () => {
    it('creates Worker at construction', async () => {
      new BrowserMoveEvaluator()
      expect(globalThis.Worker).toHaveBeenCalled()
    })

    it('is not ready until worker sends readyok', async () => {
      const evaluator = new BrowserMoveEvaluator()
      expect(evaluator.isReady()).toBe(false)
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))
      expect(evaluator.isReady()).toBe(true)
    })

    it('reuses the same Worker for multiple calls', async () => {
      const evaluator = new BrowserMoveEvaluator()
      expect(globalThis.Worker).toHaveBeenCalledTimes(1)

      const p1 = evaluator.evaluateMoves(['e2e4', 'd2d4'], INITIAL_FEN).catch(() => {})
      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)

      expect(globalThis.Worker).toHaveBeenCalledTimes(1)
    })
  })

  describe('MultiPV=6: scored move padding', () => {
    it('returns ALL moves — unscored moves padded with score=0', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))
      expect(evaluator.isReady()).toBe(true)

      const moves = ['e2e4', 'd2d4', 'g1f3', 'c2c4', 'b1c3']
      const resultPromise = evaluator.evaluateMoves(moves, INITIAL_FEN)

      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result).toHaveLength(5)
      const scoredMoves = result.map(r => r.move)
      expect(scoredMoves).toContain('e2e4')
      expect(scoredMoves).toContain('d2d4')
      expect(scoredMoves).toContain('g1f3')
      expect(scoredMoves).toContain('c2c4')
      expect(scoredMoves).toContain('b1c3')
    })

    it('scored moves have non-zero engine scores, unscored padded to 0', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const moves = ['e2e4', 'd2d4', 'g1f3']
      const resultPromise = evaluator.evaluateMoves(moves, INITIAL_FEN)

      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 28 multipv 1 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('info depth 10 score cp 15 multipv 2 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('bestmove d2d4')

      const result = await resultPromise
      const scoreMap: Record<string, number> = {}
      for (const r of result) scoreMap[r.move] = r.score
      expect(scoreMap['d2d4']).toBe(28)
      expect(scoreMap['e2e4']).toBe(15)
      expect(scoreMap['g1f3']).toBe(0)
    })

    it('pads unscored moves with 0 even when only 1 PV line returned', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const resultPromise = evaluator.evaluateMoves(['e2e4', 'd2d4'], INITIAL_FEN)

      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result).toHaveLength(2)
      const scoreMap: Record<string, number> = {}
      for (const r of result) scoreMap[r.move] = r.score
      expect(scoreMap['e2e4']).toBe(30)
      expect(scoreMap['d2d4']).toBe(0)
    })
  })

  describe('getBestScore: uses MultiPV-driven uciEvaluate', () => {
    it('returns the best-scored move from MultiPV results', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const resultPromise = evaluator.getBestScore(INITIAL_FEN)

      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 14 score cp 32 multipv 1 pv e2e4 e7e5 g1f3')
      ;(mockWorker as any)._emit('info depth 14 score cp 18 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.move).toBe('e2e4')
      expect(result.score).toBe(32)
    })

    it('returns random move + score=0 when no MultiPV output', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const resultPromise = evaluator.getBestScore(INITIAL_FEN)

      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.move).not.toBe('')
    })
  })

  describe('Resolution simulation: 2-move comparison', () => {
    it('correctly identifies the better move between 2 candidates', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const resultPromise = evaluator.evaluateMoves(['e2e4', 'd2d4'], INITIAL_FEN)

      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      const better = result.reduce((a, b) => a.score > b.score ? a : b)
      expect(better.move).toBe('e2e4')
      expect(better.score).toBe(30)

      const worse = result.find(r => r.move !== better.move)!
      expect(worse.move).toBe('d2d4')
      expect(worse.score).toBe(20)

      const loss = better.score - worse.score
      expect(loss).toBe(10)
    })
  })

  describe('MultiPV configuration', () => {
    it('uses MultiPV=6 for broad PV coverage', () => {
      const evaluator = new BrowserMoveEvaluator()

      evaluator.evaluateMoves(['e2e4'], INITIAL_FEN).catch(() => {})
      const calls = (mockWorker.postMessage as jest.Mock).mock.calls.map((c: string[]) => c[0])
      const multiPvCommand = calls.find((c: string) => c.includes('MultiPV'))

      expect(multiPvCommand).toBe('setoption name MultiPV value 6')
    })
  })

  describe('Caching: evaluateMoves caches all results (including 0-padded)', () => {
    it('caches ALL moves — scored and unscored (0-padded)', async () => {
      const evaluator = new BrowserMoveEvaluator()
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      const moves = ['e2e4', 'd2d4', 'g1f3']
      const resultPromise = evaluator.evaluateMoves(moves, INITIAL_FEN)

      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      await resultPromise

      expect(evaluationCache.getScore(INITIAL_FEN, 'e2e4')).toBe(30)
      expect(evaluationCache.getScore(INITIAL_FEN, 'd2d4')).toBe(20)
      expect(evaluationCache.getScore(INITIAL_FEN, 'g1f3')).toBe(0)
    })
  })
})
