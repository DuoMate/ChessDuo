import { Chess } from 'chess.js'

export interface MoveEvaluation {
  move: string
  score: number
  centipawnLoss?: number
}

export interface MoveComparison {
  move1: string
  move2: string
  score1: number
  score2: number
  winner: string
  centipawnLoss: number
}

type StockfishInstance = {
  postMessage: (msg: string) => void
  addMessageListener: (fn: (line: string) => void) => void
  removeMessageListener: (fn: (line: string) => void) => void
  terminate: () => void
}

export class MoveEvaluator {
  private stockfish: StockfishInstance | null = null
  private ready: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.initStockfish()
    }
  }

  private initStockfish(): void {
    // Stockfish WASM requires SharedArrayBuffer which needs COOP/COEP headers
    // For now, use fallback evaluation. Can add server-side Stockfish later.
    console.warn('Stockfish requires COOP/COEP headers. Using fallback evaluation.')
  }

  async evaluateMove(move: string, fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    
    try {
      chess.move(move)
      const newFen = chess.fen()
      chess.undo()
      
      const score = await this.getEngineScore(newFen)
      
      return {
        move,
        score
      }
    } catch {
      return {
        move,
        score: -Infinity
      }
    }
  }

  async compareMoves(
    move1: string,
    move2: string,
    fen: string
  ): Promise<MoveComparison> {
    if (move1 === move2) {
      return {
        move1,
        move2,
        score1: 0,
        score2: 0,
        winner: 'draw',
        centipawnLoss: 0
      }
    }

    const eval1 = await this.evaluateMove(move1, fen)
    const eval2 = await this.evaluateMove(move2, fen)

    let winner: string
    if (eval1.score === -Infinity && eval2.score === -Infinity) {
      winner = 'draw'
    } else if (eval1.score === -Infinity) {
      winner = move2
    } else if (eval2.score === -Infinity) {
      winner = move1
    } else if (eval1.score > eval2.score) {
      winner = move1
    } else if (eval2.score > eval1.score) {
      winner = move2
    } else {
      winner = move1
    }

    const centipawnLoss = Math.abs(eval1.score - eval2.score)

    return {
      move1,
      move2,
      score1: eval1.score,
      score2: eval2.score,
      winner,
      centipawnLoss
    }
  }

  private async getEngineScore(fen: string): Promise<number> {
    const chess = new Chess(fen)
    
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) {
        return chess.turn() === 'w' ? -10000 : 10000
      }
      return 0
    }

    if (this.stockfish && this.ready) {
      try {
        const score = await this.evaluateWithStockfish(fen)
        if (score !== null) {
          return score
        }
      } catch {
        // Fall back to simple evaluation
      }
    }
    
    return this.simpleEvaluate(fen)
  }

  private evaluateWithStockfish(fen: string): Promise<number | null> {
    return new Promise((resolve) => {
      if (!this.stockfish) {
        resolve(null)
        return
      }

      const timeout = setTimeout(() => {
        resolve(null)
      }, 2000)

      let score: number | null = null

      const messageHandler = (line: string) => {
        if (line.startsWith('info') && line.includes('score cp')) {
          const match = line.match(/score cp (-?\d+)/)
          if (match) {
            score = parseInt(match[1], 10)
          }
        } else if (line.startsWith('bestmove')) {
          clearTimeout(timeout)
          this.stockfish?.removeMessageListener(messageHandler)
          resolve(score)
        }
      }

      this.stockfish.addMessageListener(messageHandler)
      this.stockfish.postMessage(`position fen ${fen}`)
      this.stockfish.postMessage('go depth 10')
    })
  }

  private simpleEvaluate(fen: string): number {
    const chess = new Chess(fen)
    
    const pieceValues: Record<string, number> = {
      'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000,
      'p': -100, 'n': -320, 'b': -330, 'r': -500, 'q': -900, 'k': -20000
    }

    let score = 0
    const board = chess.board()

    for (const row of board) {
      for (const piece of row) {
        if (piece) {
          score += pieceValues[piece.color === 'w' ? piece.type : piece.type.toLowerCase()] * 
                   (piece.color === 'w' ? 1 : -1)
        }
      }
    }

    if (chess.isCheck()) {
      score += pieceValues[chess.turn() === 'w' ? 'K' : 'k'] > 0 ? -50 : 50
    }

    return score
  }
}
