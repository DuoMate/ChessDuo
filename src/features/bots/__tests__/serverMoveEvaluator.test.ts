import { ServerMoveEvaluator } from '../serverMoveEvaluator'

describe('ServerMoveEvaluator — fetch timeout', () => {
  const originalFetch = global.fetch
  const serverUrl = 'http://localhost:9999'

  beforeEach(() => {
    jest.useFakeTimers()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch
  })

  test('fetchWithTimeout aborts after timeout and rejects', async () => {
    const evaluator = new ServerMoveEvaluator(serverUrl)
    ;(global.fetch as jest.Mock).mockImplementation((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        }
      })
    })

    const promise = evaluator.evaluateMoves(['e2e4'], 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 15, 2600, 1)
    jest.advanceTimersByTime(16000)
    await expect(promise).rejects.toThrow()
  })

  test('fetchWithTimeout resolves before timeout', async () => {
    const evaluator = new ServerMoveEvaluator(serverUrl)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        moves: [{ move: 'e2e4', score: 25 }]
      })
    })

    const result = await evaluator.evaluateMoves(['e2e4'], 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 15, 2600, 1)
    expect(result).toHaveLength(1)
    expect(result[0].move).toBe('e2e4')
    expect(result[0].score).toBe(25)
  })

  test('fetchWithTimeout passes AbortController signal to fetch', async () => {
    const evaluator = new ServerMoveEvaluator(serverUrl)
    ;(global.fetch as jest.Mock).mockImplementation((_url: string, options: RequestInit) => {
      expect(options.signal).toBeDefined()
      expect(options.signal).toBeInstanceOf(AbortSignal)
      return Promise.resolve({ ok: true, json: async () => ({ moves: [] }) })
    })

    await evaluator.evaluateMoves(['e2e4'], 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 15, 2600, 1)
  })
})
