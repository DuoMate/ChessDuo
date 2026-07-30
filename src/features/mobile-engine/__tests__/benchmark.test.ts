/**
 * Benchmark & Correctness Test Suite
 *
 * Validates MultiPV=2 + lazy init against expected behavior.
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

describe('Benchmark — MultiPV=2 correctness', () => {
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

  describe('Lazy init: worker lifecycle', () => {
    it('does NOT create Worker at construction (memory savings)', () => {
      const evaluator = new BrowserMoveEvaluator()
      expect(globalThis.Worker).not.toHaveBeenCalled()
      expect(evaluator.isReady()).toBe(false)
    })

    it('creates Worker only on first evaluation call', async () => {
      const evaluator = new BrowserMoveEvaluator()
      expect(globalThis.Worker).not.toHaveBeenCalled()

      const promise = evaluator.evaluateMoves(['e2e4'], INITIAL_FEN).catch(() => {})
      await new Promise(r => setTimeout(r, 10))

      expect(globalThis.Worker).toHaveBeenCalledTimes(1)
    })

    it('terminate() kills worker and allows re-creation', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const p1 = evaluator.evaluateMoves(['e2e4'], INITIAL_FEN).catch(() => {})
      await new Promise(r => setTimeout(r, 10))
      expect(mockWorker.terminate).not.toHaveBeenCalled()

      evaluator.terminate()
      expect(mockWorker.terminate).toHaveBeenCalled()
      expect(evaluator.isReady()).toBe(false)

      const newMockWorker = createMockWorker()
      ;(globalThis as any).Worker = jest.fn(() => newMockWorker)

      const p2 = evaluator.evaluateMoves(['d2d4'], INITIAL_FEN).catch(() => {})
      await new Promise(r => setTimeout(r, 10))
      expect(globalThis.Worker).toHaveBeenCalledTimes(1)
    })
  })

  describe('MultiPV=2: scored move filtering', () => {
    it('only returns moves that received a PV score from the engine', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const moves = ['e2e4', 'd2d4', 'g1f3', 'c2c4', 'b1c3']
      const resultPromise = evaluator.evaluateMoves(moves, INITIAL_FEN)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result).toHaveLength(2)
      const scoredMoves = result.map(r => r.move)
      expect(scoredMoves).toContain('e2e4')
      expect(scoredMoves).toContain('d2d4')
      expect(scoredMoves).not.toContain('g1f3')
      expect(scoredMoves).not.toContain('c2c4')
      expect(scoredMoves).not.toContain('b1c3')
    })

    it('all returned moves have non-zero, real engine scores', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const moves = ['e2e4', 'd2d4', 'g1f3']
      const resultPromise = evaluator.evaluateMoves(moves, INITIAL_FEN)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 28 multipv 1 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('info depth 10 score cp 15 multipv 2 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('bestmove d2d4')

      const result = await resultPromise
      for (const r of result) {
        expect(r.score).not.toBe(0)
      }
    })

    it('returns only 1 move when MultiPV=2 catches only 1 relevant move', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const resultPromise = evaluator.evaluateMoves(['e2e4', 'd2d4'], INITIAL_FEN)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result).toHaveLength(1)
      expect(result[0].move).toBe('e2e4')
    })
  })

  describe('getBestScore: bestmove-based (single engine call)', () => {
    it('returns the engine bestmove + last known score', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const resultPromise = evaluator.getBestScore(INITIAL_FEN, 500)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 14 score cp 32 pv e2e4 e7e5 g1f3')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.move).toBe('e2e4')
      expect(result.score).toBe(32)
    })

    it('uses last info line score regardless of intermediate updates', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const resultPromise = evaluator.getBestScore(INITIAL_FEN, 500)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 8 score cp 20 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 12 score cp 25 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('info depth 16 score cp 28 pv e2e4 e7e5 g1f3 b8c6')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.score).toBe(28)
      expect(result.move).toBe('e2e4')
    })

    it('uses most recent PV move as bestMove when info lines provide it', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const resultPromise = evaluator.getBestScore(INITIAL_FEN, 500)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 18 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 15 score cp 22 pv d2d4 d7d5 g1f3')
      ;(mockWorker as any)._emit('bestmove d2d4')

      const result = await resultPromise
      expect(result.move).toBe('d2d4')
      expect(result.score).toBe(22)
    })
  })

  describe('Resolution simulation: 2-move comparison', () => {
    it('correctly identifies the better move between 2 candidates', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const resultPromise = evaluator.evaluateMoves(['e2e4', 'd2d4'], INITIAL_FEN)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
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

  describe('MultiPV overhead simulation', () => {
    it('uses smaller search space than MultiPV=6 would', () => {
      const evaluator = new BrowserMoveEvaluator()

      evaluator.evaluateMoves(['e2e4'], INITIAL_FEN).catch(() => {})
      const calls = (mockWorker.postMessage as jest.Mock).mock.calls.map((c: string[]) => c[0])
      const multiPvCommand = calls.find((c: string) => c.includes('MultiPV'))

      expect(multiPvCommand).toBe('setoption name MultiPV value 2')
    })
  })

  describe('Caching: evaluateMoves still caches scored results', () => {
    it('caches only engine-scored moves (not unscored ones)', async () => {
      const evaluator = new BrowserMoveEvaluator()

      const moves = ['e2e4', 'd2d4', 'g1f3']
      const resultPromise = evaluator.evaluateMoves(moves, INITIAL_FEN)

      await new Promise(r => setTimeout(r, 10))
      mockUciReady(mockWorker)
      await new Promise(r => setTimeout(r, 50))

      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      await resultPromise

      expect(evaluationCache.getScore(INITIAL_FEN, 'e2e4')).toBe(30)
      expect(evaluationCache.getScore(INITIAL_FEN, 'd2d4')).toBe(20)
      expect(evaluationCache.getScore(INITIAL_FEN, 'g1f3')).toBeNull()
    })
  })
})
