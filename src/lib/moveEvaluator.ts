import { Chess, Move } from 'chess.js'

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

export class MoveEvaluator {
  private stockfishReady: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.initStockfish()
    }
  }

  private initStockfish(): void {
    if (typeof window === 'undefined' || typeof URL === 'undefined') {
      console.warn('Stockfish requires browser environment')
      return
    }
    
    try {
      const workerCode = `
        let stockfish = null;
        self.onmessage = function(e) {
          if (e.data === 'init') {
            importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@18.0.5/stockfish-18-asm.js');
            stockfish = Stockfish();
            stockfish.onmessage = function(msg) {
              self.postMessage(msg);
            };
            self.postMessage('ready');
          } else if (stockfish) {
            stockfish.postMessage(e.data);
          }
        };
      `
      
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      const worker = new Worker(workerUrl)
      
      const readyHandler = (e: MessageEvent) => {
        if (e.data === 'ready') {
          this.stockfishReady = true
          console.log('Stockfish loaded successfully')
        }
      }
      
      worker.addEventListener('message', readyHandler)
      worker.postMessage('init')
      
      setTimeout(() => {
        if (!this.stockfishReady) {
          console.warn('Stockfish initialization timeout, using fallback evaluation')
        }
      }, 5000)
    } catch (error) {
      console.warn('Failed to load Stockfish:', error)
    }
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
    const eval1 = await this.evaluateMove(move1, fen)
    const eval2 = await this.evaluateMove(move2, fen)

    if (move1 === move2) {
      return {
        move1,
        move2,
        score1: eval1.score,
        score2: eval2.score,
        winner: 'draw',
        centipawnLoss: 0
      }
    }

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

  async getBestScore(fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    const moves = chess.moves()
    
    if (moves.length === 0) {
      return { move: '', score: 0 }
    }

    let bestMove = moves[0]
    let bestScore = -Infinity

    for (const move of moves) {
      const evalResult = await this.evaluateMove(move, fen)
      if (evalResult.score > bestScore) {
        bestScore = evalResult.score
        bestMove = move
      }
    }

    return {
      move: bestMove,
      score: bestScore
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

    return this.simpleEvaluate(fen)
  }

  private simpleEvaluate(fen: string): number {
    const chess = new Chess(fen)
    
    const pieceValues: Record<string, number> = {
      'P': 100, 'N': 320, 'B': 330, 'R': 500, 'Q': 900, 'K': 20000,
      'p': -100, 'n': -320, 'b': -330, 'r': -500, 'q': -900, 'k': -20000
    }

    let score = 0
    const board = chess.board()

    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const piece = board[row][col]
        if (piece) {
          const value = pieceValues[piece.color === 'w' ? piece.type : piece.type.toLowerCase()]
          const multiplier = piece.color === 'w' ? 1 : -1
          const positionBonus = this.getPositionBonus(piece, row, col)
          score += (value + positionBonus) * multiplier
        }
      }
    }

    if (chess.isCheck()) {
      score += chess.turn() === 'w' ? -50 : 50
    }

    const mobilityScore = this.getMobilityScore(chess)
    score += mobilityScore

    return score
  }

  private getPositionBonus(piece: { type: string; color: 'w' | 'b' }, row: number, col: number): number {
    const pawnBonus: number[][] = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5, -10,  0,  0, -10, -5,  5],
      [5, 10, 10, -20, -20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ]

    const knightBonus: number[][] = [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20,  0,  0,  0,  0, -20, -40],
      [-30,  0, 10, 15, 15, 10,  0, -30],
      [-30,  5, 15, 20, 20, 15,  5, -30],
      [-30,  0, 15, 20, 20, 15,  0, -30],
      [-30,  5, 10, 15, 15, 10,  5, -30],
      [-40, -20,  0,  5,  5,  0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50]
    ]

    const bishopBonus: number[][] = [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10,  0,  0,  0,  0,  0,  0, -10],
      [-10,  0,  5, 10, 10,  5,  0, -10],
      [-10,  5,  5, 10, 10,  5,  5, -10],
      [-10,  0, 10, 10, 10, 10,  0, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10,  5,  0,  0,  0,  0,  5, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20]
    ]

    const rookBonus: number[][] = [
      [0,  0,  0,  0,  0,  0, 0, 0],
      [5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,   0,  0, -5],
      [0,  0,  0,  5,  5,  0,  0,  0]
    ]

    const queenBonus: number[][] = [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10,  0,  0,  0,  0,  0,  0, -10],
      [-10,  0,  5,  5,  5,  5,  0, -10],
      [-5,  0,  5,  5,  5,  5,  0, -5],
      [0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0, -10],
      [-10,  0,  5,  0,  0,  0,  0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20]
    ]

    const kingBonus: number[][] = [
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [20, 20,  0,  0,  0,  0, 20, 20],
      [20, 30, 10,  0,  0, 10, 30, 20]
    ]

    const isBlack = piece.color === 'b'
    let adjustedRow = isBlack ? row : 7 - row

    switch (piece.type) {
      case 'p': return pawnBonus[adjustedRow][col]
      case 'n': return knightBonus[adjustedRow][col]
      case 'b': return bishopBonus[adjustedRow][col]
      case 'r': return rookBonus[adjustedRow][col]
      case 'q': return queenBonus[adjustedRow][col]
      case 'k': return kingBonus[adjustedRow][col]
      default: return 0
    }
  }

  private getMobilityScore(chess: Chess): number {
    const moves = chess.moves()
    const baseMobility = moves.length * 5
    
    if (chess.turn() === 'w') {
      return baseMobility
    } else {
      return -baseMobility
    }
  }
}
