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

    console.log(`[EVALUATOR] Evaluating ${moves.length} moves: ${fen.substring(0, 60)}...`)
    console.log(`[EVALUATOR] Moves: ${moves.join(', ')}`)

    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[EVALUATOR] Request attempt ${attempt + 1}/${retries}...`)
        
        const response = await fetch(`${this.serverUrl}/evaluate-moves`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fen, moves, uciElo, movetime: 1500 })
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`[EVALUATOR] Response received`)

          const results = data.moves.map((m: { move: string; score: number }) => {
            console.log(`[EVALUATOR] ${m.move} → score=${m.score}`)
            return { move: m.move, score: m.score }
          })

          console.log(`[EVALUATOR] All scores: ${results.map((r: { move: string; score: number }) => `${r.move}=${r.score}`).join(', ')}`)
          return results
        }

        console.log(`[EVALUATOR] /evaluate-moves failed: ${response.statusText}, trying fallback...`)
        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.log(`[EVALUATOR] Attempt ${attempt + 1} failed: ${lastError.message}`)
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    console.log(`[EVALUATOR] Falling back to /evaluate-multipv...`)
    return this.evaluateMovesMultiPV(moves, fen, depth, uciElo)
  }

  private async evaluateMovesMultiPV(moves: string[], fen: string, depth: number, uciElo: number): Promise<{ move: string; score: number }[]> {
    try {
      const response = await fetch(`${this.serverUrl}/evaluate-multipv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fen, depth: 12, uciElo, multiPv: Math.min(moves.length, 10), movetime: 1500 })
      })

      if (!response.ok) {
        throw new Error(`MultiPV evaluation failed: ${response.statusText}`)
      }

      const data = await response.json()
      const results = data.moves.map((m: { move: string; score: number }) => {
        console.log(`[EVALUATOR] MultiPV ${m.move} → score=${m.score}`)
        return { move: m.move, score: m.score }
      })

      console.log(`[EVALUATOR] MultiPV scores: ${results.map((r: { move: string; score: number }) => `${r.move}=${r.score}`).join(', ')}`)
      return results
    } catch (error) {
      console.error(`[EVALUATOR] MultiPV fallback also failed: ${error}`)
      throw error
    }
  }

    throw lastError || new Error('MultiPV evaluation failed after retries')
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

  async playMove(fen: string, uciElo: number = 2600, movetime: number = 2000): Promise<string> {
    if (!this.serverUrl) {
      throw new Error('Stockfish server URL not configured')
    }

    console.log(`[EVALUATOR] Stockfish playing move from FEN: ${fen.substring(0, 60)}... (UCI_Elo: ${uciElo})`)

    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < 3; attempt++) {
      const attemptStart = Date.now()
      try {
        const response = await fetch(`${this.serverUrl}/play-move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fen, uciElo, movetime })
        })

        if (!response.ok) {
          throw new Error(`Play move failed: ${response.statusText}`)
        }

        const data = await response.json()
        const elapsed = Date.now() - attemptStart
        console.log(`[EVALUATOR] Stockfish played ${data.move} (time=${elapsed}ms, UCI_Elo=${data.uciElo})`)
        return data.move
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.log(`[EVALUATOR] Play move attempt ${attempt + 1} failed: ${lastError.message}`)
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('Play move failed after retries')
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
