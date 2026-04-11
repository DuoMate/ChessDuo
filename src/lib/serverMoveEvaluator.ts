const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

interface EvaluateResponse {
  fen: string
  score: number
  depth: number
  timeMs: number
}

export class ServerMoveEvaluator {
  private serverUrl: string

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || SERVER_URL
  }

  async evaluateMove(move: string, fen: string, depth: number = 15, uciElo: number = 2600): Promise<{ move: string; score: number }> {
    const chess = new (await import('chess.js')).Chess(fen)
    chess.move(move)
    const newFen = chess.fen()
    chess.undo()

    const score = await this.evaluatePosition(newFen, depth, uciElo)

    return {
      move,
      score
    }
  }

  async evaluateMoves(moves: string[], fen: string, depth: number = 15, uciElo: number = 2600, retries: number = 3): Promise<{ move: string; score: number }[]> {
    if (!this.serverUrl) {
      throw new Error('Stockfish server URL not configured')
    }

    const chess = await import('chess.js')
    const c = new chess.Chess(fen)
    const fromFens: string[] = []

    for (const move of moves) {
      c.reset()
      c.load(fen)
      c.move(move)
      fromFens.push(c.fen())
      c.undo()
    }

    console.log(`[EVALUATOR] Batch evaluating ${moves.length} moves from FEN: ${fen.substring(0, 60)}...`)
    console.log(`[EVALUATOR] Moves: ${moves.join(', ')}`)

    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < retries; attempt++) {
      const attemptStart = Date.now()
      try {
        console.log(`[EVALUATOR] Request attempt ${attempt + 1}/${retries}...`)
        
        const response = await fetch(`${this.serverUrl}/evaluate-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ positions: fromFens, depth, uciElo })
        })

        if (!response.ok) {
          throw new Error(`Batch evaluation failed: ${response.statusText}`)
        }

        const data = await response.json()
        const elapsed = Date.now() - attemptStart
        
        console.log(`[EVALUATOR] Batch response received in ${elapsed}ms`)
        
        const results = moves.map((move, i) => {
          const score = data.results[i].score
          console.log(`[EVALUATOR] ${move} → score=${score}`)
          return { move, score }
        })
        
        console.log(`[EVALUATOR] All scores: ${results.map(r => `${r.move}=${r.score}`).join(', ')}`)
        
        return results
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.log(`[EVALUATOR] Attempt ${attempt + 1} failed: ${lastError.message}`)
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('Batch evaluation failed after retries')
  }

  async evaluatePosition(fen: string, depth: number = 15, uciElo: number = 2600, retries: number = 3): Promise<number> {
    if (!this.serverUrl) {
      throw new Error('Stockfish server URL not configured')
    }

    console.log(`[EVALUATOR] Evaluating position: ${fen.substring(0, 60)}...`)

    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < retries; attempt++) {
      const attemptStart = Date.now()
      try {
        const response = await fetch(`${this.serverUrl}/evaluate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fen, depth, uciElo })
        })

        if (!response.ok) {
          throw new Error(`Evaluation failed: ${response.statusText}`)
        }

        const data: EvaluateResponse = await response.json()
        const elapsed = Date.now() - attemptStart
        console.log(`[EVALUATOR] Position score=${data.score} (depth=${data.depth}, time=${elapsed}ms)`)
        return data.score
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.log(`[EVALUATOR] Attempt ${attempt + 1} failed: ${lastError.message}`)
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('Evaluation failed after retries')
  }

  async getBestScore(fen: string, depth: number = 15, uciElo: number = 2600): Promise<{ move: string; score: number }> {
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

    const results = await this.evaluateMoves(moves, fen, depth, uciElo)
    const best = results.reduce((a, b) => a.score > b.score ? a : b)

    return { move: best.move, score: best.score }
  }

  isUsingStockfish(): boolean {
    return !!this.serverUrl
  }

  isReady(): boolean {
    return !!this.serverUrl
  }
}

export function createServerEvaluator(serverUrl?: string): ServerMoveEvaluator {
  return new ServerMoveEvaluator(serverUrl)
}
