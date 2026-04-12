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

    const Chess = (await import('chess.js')).Chess
    const chess = new Chess(fen)
    const verboseMoves = chess.moves({ verbose: true })

    const uciMoves = moves.map(move => {
      const normalized = move.replace(/-/g, '')
      const from = normalized.substring(0, 2)
      const to = normalized.substring(2, 4)
      const promotion = normalized.length > 4 ? normalized[4] : undefined
      
      const verbose = verboseMoves.find(vm => 
        (vm.from + vm.to) === normalized ||
        (vm.from + vm.to + (vm.promotion || '')) === normalized
      )
      
      if (verbose) {
        let uci = `${verbose.from}${verbose.to}`
        if (verbose.promotion) uci += verbose.promotion
        return uci
      }
      
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) {
        return normalized
      }
      
      const bySan = verboseMoves.find(vm => vm.san === move)
      if (bySan) {
        let uci = `${bySan.from}${bySan.to}`
        if (bySan.promotion) uci += bySan.promotion
        return uci
      }
      
      return normalized
    })

    console.log(`[EVALUATOR] Evaluating position with MultiPV: ${fen.substring(0, 60)}...`)
    console.log(`[EVALUATOR] Input moves: ${moves.join(', ')}`)
    console.log(`[EVALUATOR] UCI moves for Stockfish: ${uciMoves.join(', ')}`)

    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < retries; attempt++) {
      const attemptStart = Date.now()
      try {
        console.log(`[EVALUATOR] Request attempt ${attempt + 1}/${retries}...`)
        
        const response = await fetch(`${this.serverUrl}/evaluate-multipv`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fen, depth: 12, uciElo, multiPv: 6, movetime: 1500, searchMoves: uciMoves })
        })

        if (!response.ok) {
          throw new Error(`MultiPV evaluation failed: ${response.statusText}`)
        }

        const data = await response.json()
        const elapsed = Date.now() - attemptStart
        
        console.log(`[EVALUATOR] MultiPV response received in ${elapsed}ms`)
        
        const results = data.moves.map((m: { move: string; score: number }) => {
          console.log(`[EVALUATOR] UCI ${m.move} → score=${m.score}`)
          const uci = m.move
          const from = uci.substring(0, 2)
          const to = uci.substring(2, 4)
          const promotion = uci.length > 4 ? uci[4] : undefined
          const verbose = verboseMoves.find(vm => 
            vm.from === from && vm.to === to && (promotion ? vm.promotion === promotion : true)
          )
          const san = verbose ? verbose.san : uci
          console.log(`[EVALUATOR] SAN ${san} (from ${from} to ${to})`)
          return { move: san, score: m.score }
        })
        
        console.log(`[EVALUATOR] All scores: ${results.map((r: { move: string; score: number }) => `${r.move}=${r.score}`).join(', ')}`)
        
        return results
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.log(`[EVALUATOR] Attempt ${attempt + 1} failed: ${lastError.message}`)
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
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

    const Chess = (await import('chess.js')).Chess
    const chess = new Chess(fen)
    const verboseMoves = chess.moves({ verbose: true })
    const moves = chess.moves()

    if (moves.length === 0) {
      return { move: '', score: 0 }
    }

    if (moves.length === 1) {
      return { move: moves[0], score: 0 }
    }

    const uciMoves = verboseMoves.map(m => {
      let uci = `${m.from}${m.to}`
      if (m.promotion) uci += m.promotion
      return uci
    })

    const results = await this.evaluateMoves(uciMoves, fen, depth, uciElo)
    
    if (results.length === 0) {
      console.warn('[EVALUATOR] getBestScore: no results, returning random move')
      const randomMove = moves[Math.floor(Math.random() * moves.length)]
      return { move: randomMove, score: 0 }
    }
    
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
