import { CoachEngine, normalizeEngineScore } from '../coachEngine'

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
      for (const fn of [...listeners]) fn(event)
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

describe('CoachEngine', () => {
  let mockWorker: ReturnType<typeof createMockWorker>
  let originalWorker: typeof Worker

  beforeEach(() => {
    mockWorker = createMockWorker()
    originalWorker = globalThis.Worker
    ;(globalThis as any).Worker = jest.fn(() => mockWorker)
  })

  afterEach(() => {
    ;(globalThis as any).Worker = originalWorker
  })

  describe('normalizeEngineScore', () => {
    it('keeps centipawn scores', () => {
      expect(normalizeEngineScore(30, null)).toBe(30)
      expect(normalizeEngineScore(-120, null)).toBe(-120)
    })
    it('maps mate scores to near-checkmate values', () => {
      expect(normalizeEngineScore(null, 3)).toBe(9997)
      expect(normalizeEngineScore(null, -2)).toBe(-9998)
    })
  })

  describe('initialisation', () => {
    it('creates a dedicated Worker and configures MultiPV 3', async () => {
      new CoachEngine()
      await new Promise((r) => setTimeout(r, 10))
      expect(globalThis.Worker).toHaveBeenCalledWith('/stockfish/stockfish.js')
      const calls = (mockWorker.postMessage as jest.Mock).mock.calls.map((c: string[]) => c[0])
      expect(calls).toContain('uci')
      expect(calls).toContain('setoption name MultiPV value 3')
      expect(calls).toContain('isready')
    })

    it('becomes ready after readyok', async () => {
      const engine = new CoachEngine()
      await new Promise((r) => setTimeout(r, 10))
      expect(engine.isReady()).toBe(false)
      mockUciReady(mockWorker)
      await new Promise((r) => setTimeout(r, 20))
      expect(engine.isReady()).toBe(true)
    })
  })

  describe('analyzeTopMoves', () => {
    it('returns ranked top moves parsed from MultiPV info lines', async () => {
      const engine = new CoachEngine()
      mockUciReady(mockWorker)
      await new Promise((r) => setTimeout(r, 20))

      const resultPromise = engine.analyzeTopMoves(INITIAL_FEN, 3)
      await new Promise((r) => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('info depth 10 score cp 20 multipv 2 pv d2d4 d7d5')
      ;(mockWorker as any)._emit('info depth 10 score cp 10 multipv 3 pv g1f3 g8f6')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.map((m) => m.san)).toEqual(['e4', 'd4', 'Nf3'])
      expect(result[0].cp).toBe(30)
    })

    it('sorts by score regardless of MultiPV index order', async () => {
      const engine = new CoachEngine()
      mockUciReady(mockWorker)
      await new Promise((r) => setTimeout(r, 20))

      const resultPromise = engine.analyzeTopMoves(INITIAL_FEN, 3)
      await new Promise((r) => setTimeout(r, 10))
      ;(mockWorker as any)._emit('info depth 10 score cp 10 multipv 1 pv g1f3 g8f6')
      ;(mockWorker as any)._emit('info depth 10 score cp 30 multipv 2 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result[0].san).toBe('e4')
    })
  })

  describe('scoreMove', () => {
    it('returns the score for a single move via searchmoves', async () => {
      const engine = new CoachEngine()
      mockUciReady(mockWorker)
      await new Promise((r) => setTimeout(r, 20))

      const resultPromise = engine.scoreMove(INITIAL_FEN, 'e2e4')
      await new Promise((r) => setTimeout(r, 10))
      const calls = (mockWorker.postMessage as jest.Mock).mock.calls.map((c: string[]) => c[0])
      expect(calls.some((c) => c.includes('searchmoves e2e4'))).toBe(true)
      ;(mockWorker as any)._emit('info depth 10 score cp 25 multipv 1 pv e2e4 e7e5')
      ;(mockWorker as any)._emit('bestmove e2e4')

      const result = await resultPromise
      expect(result.uci).toBe('e2e4')
      expect(result.cp).toBe(25)
    })
  })

  describe('terminate', () => {
    it('terminates the worker', async () => {
      const engine = new CoachEngine()
      await new Promise((r) => setTimeout(r, 10))
      engine.terminate()
      expect(mockWorker.terminate).toHaveBeenCalled()
      expect(engine.isReady()).toBe(false)
    })
  })
})
