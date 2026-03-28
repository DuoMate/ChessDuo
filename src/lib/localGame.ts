import { Chess } from 'chess.js'
import { GameState, GamePhase, Team, Player, CapturedPieces } from './gameState'
import { MoveEvaluator } from './moveEvaluator'

export enum GameStatus {
  WAITING = 'WAITING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface GameStats {
  movesPlayed: number
  syncRate: number
  conflicts: number
  winningMoves: number
  averageAccuracy: number
  lastMoveAccuracy: number
}

export class LocalGame {
  private gameState: GameState
  private evaluator: MoveEvaluator
  private _status: GameStatus
  private stats: GameStats
  private _lastMove: { from: string; to: string } | null = null

  constructor() {
    this.gameState = new GameState()
    this.evaluator = new MoveEvaluator()
    this._status = GameStatus.WAITING
    this.stats = {
      movesPlayed: 0,
      syncRate: 0,
      conflicts: 0,
      winningMoves: 0,
      averageAccuracy: 0,
      lastMoveAccuracy: 100
    }
  }

  get status(): GameStatus {
    return this._status
  }

  get currentTurn(): Team {
    return this.gameState.currentTeam
  }

  get board(): Chess {
    return this.gameState.board
  }

  get lastMove(): { from: string; to: string } | null {
    return this._lastMove
  }

  getCapturedPieces(): CapturedPieces {
    return this.gameState.capturedPieces
  }

  addPlayer(player: Player, team: Team): void {
    this.gameState.addPlayer(player, team)
    
    const whitePlayers = this.gameState.getPlayers(Team.WHITE)
    const blackPlayers = this.gameState.getPlayers(Team.BLACK)
    
    if (whitePlayers.length === 2 && blackPlayers.length === 2) {
      this._status = GameStatus.READY
    }
  }

  start(): void {
    this.gameState.startMatch()
    this._status = GameStatus.PLAYING
  }

  selectMove(player: Player, move: string): void {
    this.gameState.selectMove(player, move)
  }

  getSelectedMove(player: Player): string | null {
    return this.gameState.getSelectedMove(player)
  }

  getHiddenMove(player: Player): string | null {
    if (this.gameState.phase !== GamePhase.LOCKED) {
      return null
    }
    return this.gameState.getSelectedMove(player)
  }

  async lockAndResolve(skipStatsUpdate: boolean = false): Promise<void> {
    const currentTeam = this.gameState.currentTeam
    const players = this.gameState.getPlayers(currentTeam)
    
    for (const player of players) {
      this.gameState.lockMove(player)
    }

    const move1 = this.gameState.getSelectedMove(players[0])!
    const move2 = this.gameState.getSelectedMove(players[1])!

    const comparison = await this.evaluator.compareMoves(
      move1,
      move2,
      this.gameState.fen
    )

    const bestScore = await this.evaluator.getBestScore(this.gameState.fen)
    const playerScore = await this.evaluator.evaluateMove(move1, this.gameState.fen)
    
    let centipawnLoss = comparison.centipawnLoss
    if (bestScore.score !== -Infinity && playerScore.score !== -Infinity) {
      centipawnLoss = Math.abs(bestScore.score - playerScore.score)
    }

    const moveParts = this.getMoveParts(move1, this.gameState.fen)
    if (moveParts) {
      this._lastMove = moveParts
    }

    if (!skipStatsUpdate) {
      this.updateStats(move1 === move2, comparison.winner !== 'draw', centipawnLoss)
    }
    
    this.gameState.resolve()

    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }
  }

  private getMoveParts(move: string, fen: string): { from: string; to: string } | null {
    try {
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true })
      const matchedMove = moves.find(m => m.san === move || m.san.replace(/[+#]/g, '') === move)
      if (matchedMove) {
        return { from: matchedMove.from, to: matchedMove.to }
      }
    } catch {
      return null
    }
    return null
  }

  private updateStats(isSync: boolean, won: boolean, centipawnLoss: number): void {
    this.stats.movesPlayed++
    
    if (isSync) {
      const currentSyncMoves = this.stats.syncRate * (this.stats.movesPlayed - 1)
      this.stats.syncRate = (currentSyncMoves + 1) / this.stats.movesPlayed
    } else {
      this.stats.conflicts++
      const currentSyncMoves = this.stats.syncRate * (this.stats.movesPlayed - 1)
      this.stats.syncRate = currentSyncMoves / this.stats.movesPlayed
    }

    if (won) {
      this.stats.winningMoves++
    }

    const moveAccuracy = Math.max(0, Math.min(100, 100 - (centipawnLoss / 10)))
    this.stats.lastMoveAccuracy = Math.round(moveAccuracy)

    const totalAccuracy = this.stats.averageAccuracy * (this.stats.movesPlayed - 1)
    this.stats.averageAccuracy = (totalAccuracy + moveAccuracy) / this.stats.movesPlayed
  }

  getStats(): GameStats {
    return { ...this.stats }
  }

  isGameOver(): boolean {
    return this.gameState.board.isGameOver()
  }

  getResult(): string {
    const board = this.gameState.board
    if (board.isCheckmate()) {
      return board.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
    }
    if (board.isStalemate()) {
      return 'Draw by stalemate'
    }
    if (board.isThreefoldRepetition()) {
      return 'Draw by threefold repetition'
    }
    if (board.isInsufficientMaterial()) {
      return 'Draw by insufficient material'
    }
    if (board.isDraw()) {
      return 'Draw'
    }
    return 'Game in progress'
  }

  getGameOverReason(): string | null {
    const board = this.gameState.board
    if (board.isCheckmate()) {
      return 'checkmate'
    }
    if (board.isStalemate()) {
      return 'stalemate'
    }
    if (board.isThreefoldRepetition()) {
      return 'threefoldRepetition'
    }
    if (board.isInsufficientMaterial()) {
      return 'insufficientMaterial'
    }
    if (board.isDraw()) {
      return 'draw'
    }
    return null
  }
}
