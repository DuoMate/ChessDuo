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

    for (const move of moves) {
      c.reset()
      c.load(fen)
      c.move(move)
      fromFens.push(c.fen())
      c.undo()
    }

    const response = await fetch(`${this.serverUrl}/evaluate-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ positions: fromFens, depth })
    })

    if (!response.ok) {
      throw new Error(`Batch evaluation failed: ${response.statusText}`)
    }

    const data = await response.json()
    return moves.map((move, i) => ({
      move,
      score: data.results[i].score
    }))
  }

  async evaluatePosition(fen: string, depth: number = 15): Promise<number> {
    if (!this.serverUrl) {
      throw new Error('Stockfish server URL not configured')
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

    const response = await fetch(`${this.serverUrl}/evaluate-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ positions: [fen], depth })
    })

    if (!response.ok) {
      throw new Error(`Evaluation failed: ${response.statusText}`)
    }

    const data = await response.json()
    return { move: moves[0], score: data.results[0].score }
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