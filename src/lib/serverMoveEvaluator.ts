const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

interface EvaluateResponse {
  fen: string
  score: number
  depth: number
  timeMs: number
}

interface CacheEntry {
  score: number
  timestamp: number
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>()
  private maxSize: number
  private ttl: number

  constructor(maxSize = 500, ttlMs = 300000) {
    this.maxSize = maxSize
    this.ttl = ttlMs
  }

  get(key: string): number | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }
    return entry.score
  }

  set(key: string, score: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, { score, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }
}

export class ServerMoveEvaluator {
  private serverUrl: string
  private cache: SimpleCache

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || SERVER_URL
    this.cache = new SimpleCache(500, 5 * 60 * 1000)
  }

  async evaluateMove(move: string, fen: string): Promise<{ move: string; score: number }> {
    const chess = new (await import('chess.js')).Chess(fen)
    chess.move(move)
    const newFen = chess.fen()
    chess.undo()

    const score = await this.evaluatePosition(newFen)

    return {
      move,
      score
    }
  }

  async evaluateMoves(moves: string[], fen: string, depth: number = 15): Promise<{ move: string; score: number }[]> {
    if (!this.serverUrl) {
      throw new Error('Stockfish server URL not configured')
    }

    const chess = await import('chess.js')
    const c = new chess.Chess(fen)
    const fromFens: string[] = []
    const cacheKeys: string[] = []
    const uncachedIndices: number[] = []
    const uncachedFens: string[] = []
    const results: (number | undefined)[] = new Array(moves.length)

    for (let i = 0; i < moves.length; i++) {
      c.reset()
      c.load(fen)
      c.move(moves[i])
      const cacheKey = `${c.fen()}:${depth}`
      cacheKeys.push(cacheKey)
      
      const cached = this.cache.get(cacheKey)
      if (cached !== undefined) {
        results[i] = cached
      } else {
        uncachedIndices.push(i)
        uncachedFens.push(c.fen())
      }
    }

    if (uncachedFens.length > 0) {
      const response = await fetch(`${this.serverUrl}/evaluate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ positions: uncachedFens, depth })
      })

      if (!response.ok) {
        throw new Error(`Batch evaluation failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      for (let i = 0; i < uncachedIndices.length; i++) {
        const idx = uncachedIndices[i]
        const score = data.results[i].score
        results[idx] = score
        this.cache.set(cacheKeys[idx], score)
      }
    }

    return moves.map((move, i) => ({
      move,
      score: results[i]!
    }))
  }

  async evaluatePosition(fen: string, depth: number = 15): Promise<number> {
    if (!this.serverUrl) {
      throw new Error('Stockfish server URL not configured')
    }

    const cacheKey = `${fen}:${depth}`
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const response = await fetch(`${this.serverUrl}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fen, depth })
    })

    if (!response.ok) {
      throw new Error(`Evaluation failed: ${response.statusText}`)
    }

    const data: EvaluateResponse = await response.json()
    this.cache.set(cacheKey, data.score)
    return data.score
  }

  async getBestScore(fen: string, depth: number = 15): Promise<{ move: string; score: number }> {
    if (!this.serverUrl) {
      throw new Error('Stockfish server URL not configured')
    }

    const chess = new (await import('chess.js')).Chess(fen)
    const moves = chess.moves()

    if (moves.length === 0) {
      return { move: '', score: 0 }
    }

    if (moves.length === 1) {
      return { move: moves[0], score: 0 }
    }

    const results = await this.evaluateMoves(moves, fen, depth)
    const best = results.reduce((a, b) => a.score > b.score ? a : b)

    return { move: best.move, score: best.score }
  }

  isUsingStockfish(): boolean {
    return !!this.serverUrl
  }

  isReady(): boolean {
    return !!this.serverUrl
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export function createServerEvaluator(serverUrl?: string): ServerMoveEvaluator {
  return new ServerMoveEvaluator(serverUrl)
}
