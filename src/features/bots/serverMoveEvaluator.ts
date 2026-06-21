const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''
const FETCH_TIMEOUT_MS = 15000
import { evaluationCache } from '../shared/evaluationCache'

interface EvaluateResponse {
  fen: string
  score: number
  depth: number
  timeMs: number
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId))
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

    // Check cache before making HTTP request
    const cachedResults: { move: string; score: number }[] = []
    const uncachedMoves: string[] = []
    for (const move of moves) {
      const cached = evaluationCache.getScore(fen, move)
      if (cached !== null) {
        cachedResults.push({ move, score: cached })
      } else {
        uncachedMoves.push(move)
      }
    }
    
    if (uncachedMoves.length === 0 && cachedResults.length > 0) {
      console.log(`[EVALUATOR] All ${moves.length} moves cached, skipping HTTP`)
      return cachedResults
    }
    
    console.log(`[EVALUATOR] Evaluating ${moves.length} moves: ${fen.substring(0, 60)}... (${cachedResults.length} cached, ${uncachedMoves.length} uncached)`)

    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[EVALUATOR] Request attempt ${attempt + 1}/${retries}...`)
        
        const response = await fetchWithTimeout(`${this.serverUrl}/evaluate-moves`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fen, moves, movetime: 500 })
        }, FETCH_TIMEOUT_MS)

        if (response.ok) {
          const data = await response.json()
          console.log(`[EVALUATOR] Response received`)

          const results = data.moves.map((m: { move: string; score: number }) => {
            console.log(`[EVALUATOR] ${m.move} → score=${m.score}`)
            return { move: m.move, score: m.score }
          })

          console.log(`[EVALUATOR] All scores: ${results.map((r: { move: string; score: number }) => `${r.move}=${r.score}`).join(', ')}`)
          
          // Cache results for future reuse
          evaluationCache.setScores(fen, results)
          
          return [...cachedResults, ...results]
        }

        console.log(`[EVALUATOR] /evaluate-moves failed: ${response.statusText}`)
        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.log(`[EVALUATOR] Attempt ${attempt + 1} failed: ${lastError.message}`)
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('Move evaluation failed after retries')
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
        const response = await fetchWithTimeout(`${this.serverUrl}/evaluate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fen, depth, uciElo })
        }, FETCH_TIMEOUT_MS)

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

    const Chess = (await import('chess.js')).Chess
    const chess = new Chess(fen)
    const verboseMoves = chess.moves({ verbose: true })

    if (verboseMoves.length === 0) {
      return { move: '', score: 0 }
    }

    if (verboseMoves.length === 1) {
      const move = verboseMoves[0]
      return { move: move.from + move.to + (move.promotion || ''), score: 0 }
    }

    const topMovesUci = verboseMoves.slice(0, 6).map(m => m.from + m.to + (m.promotion || ''))
    const results = await this.evaluateMoves(topMovesUci, fen, depth, uciElo)
    
    if (results.length === 0) {
      const randomMove = verboseMoves[Math.floor(Math.random() * verboseMoves.length)]
      return { move: randomMove.from + randomMove.to + (randomMove.promotion || ''), score: 0 }
    }
    
    const best = results.reduce((a, b) => a.score > b.score ? a : b, results[0])

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
        const response = await fetchWithTimeout(`${this.serverUrl}/play-move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fen, uciElo, movetime })
        }, FETCH_TIMEOUT_MS)

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
