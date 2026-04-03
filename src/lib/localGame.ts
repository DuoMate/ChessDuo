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
  player1Accuracy: number
  player2Accuracy: number
  lastMoveAccuracy: number
  lastMoveAccuracyP2: number
  whiteMovesPlayed: number
  whiteSyncRate: number
  whiteConflicts: number
}

export interface MoveComparison {
  player1Move: string
  player2Move: string
  player1Score: number
  player2Score: number
  player1Accuracy: number
  player2Accuracy: number
  player1Loss: number
  player2Loss: number
  winningMove: string
  winningScore: number
  isSync: boolean
  bestEngineMove: string
  bestEngineScore: number
}

export class LocalGame {
  private gameState: GameState
  private evaluator: MoveEvaluator
  private _status: GameStatus
  private stats: GameStats
  private _lastMove: { from: string; to: string } | null = null
  private _lastMoveComparison: MoveComparison | null = null
  private initialized = false

  constructor() {
    this.gameState = new GameState()
    this.evaluator = new MoveEvaluator()
    this._status = GameStatus.WAITING
    this.stats = {
      movesPlayed: 0,
      syncRate: 0,
      conflicts: 0,
      winningMoves: 0,
      player1Accuracy: 0,
      player2Accuracy: 0,
      lastMoveAccuracy: 100,
      lastMoveAccuracyP2: 100,
      whiteMovesPlayed: 0,
      whiteSyncRate: 0,
      whiteConflicts: 0
    }
    this.initialized = false
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

  get lastMoveComparison(): MoveComparison | null {
    return this._lastMoveComparison
  }

  getCapturedPieces(): CapturedPieces {
    return this.gameState.capturedPieces
  }

  addPlayer(player: Player, team: Team): void {
    if (this.initialized) {
      return
    }
    
    try {
      this.gameState.addPlayer(player, team)
    } catch (e) {
      const error = e as Error
      if (error.message.includes('already has 2 players')) {
        this.initialized = true
        return
      }
      throw e
    }
    
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
    const isBlackTurn = currentTeam === Team.BLACK
    
    const teamColor = isBlackTurn ? '🔴 BLACK' : '🟢 WHITE'
    const player1Id = players[0]
    const player2Id = players[1]
    
    const getPlayerLabel = (playerId: string): string => {
      if (playerId === 'player1') return 'player1 (Human)'
      if (playerId === 'player2') return 'player2 (Teammate)'
      if (playerId === 'player3') return 'player3 (Opponent)'
      if (playerId === 'player4') return 'player4 (Opponent)'
      return playerId
    }
    
    for (const player of players) {
      this.gameState.lockMove(player)
    }

    const player1Move = this.gameState.getSelectedMove(player1Id)!
    const player2Move = this.gameState.getSelectedMove(player2Id)!

    const isSync = player1Move === player2Move

    console.log(`\n${'='.repeat(60)}`)
    console.log(`[TURN] ${teamColor} team to move`)
    console.log(`[MOVES] ${getPlayerLabel(player1Id)}: ${player1Move} | ${getPlayerLabel(player2Id)}: ${player2Move}`)
    
    const bestMoveResult = await this.evaluator.getBestScore(this.gameState.fen)
    const bestMoveScore = bestMoveResult.score
    
    const player1Eval = await this.evaluator.evaluateMove(player1Move, this.gameState.fen)
    const player2Eval = await this.evaluator.evaluateMove(player2Move, this.gameState.fen)
    
    const player1Score = player1Eval.score
    const player2Score = player2Eval.score

    const player1Loss = isSync ? 0 : Math.abs(bestMoveScore - player1Score)
    const player2Loss = isSync ? 0 : Math.abs(bestMoveScore - player2Score)
    
    if (isSync) {
      console.log(`[SYNC] Both players chose the same move: ${player1Move}`)
    }

    const player1Accuracy = this.calculateAccuracy(player1Loss)
    const player2Accuracy = this.calculateAccuracy(player2Loss)

    console.log(`\n[EVALUATION]`)
    console.log(`  [${getPlayerLabel(player1Id)}] ${player1Move}: score=${player1Score} | loss=${player1Loss}cp | accuracy=${player1Accuracy.toFixed(1)}%`)
    console.log(`  [${getPlayerLabel(player2Id)}] ${player2Move}: score=${player2Score} | loss=${player2Loss}cp | accuracy=${player2Accuracy.toFixed(1)}%`)
    console.log(`  [Engine Best] ${bestMoveResult.move}: score=${bestMoveScore}`)
    
    const winningMove = player1Loss < player2Loss ? player1Move : (player2Loss < player1Loss ? player2Move : player1Move)
    const winningScore = winningMove === player1Move ? player1Score : player2Score
    const chosenLoss = winningMove === player1Move ? player1Loss : player2Loss
    const winnerId = winningMove === player1Move ? player1Id : player2Id
    
    console.log(`\n[RESULT] Winner: ${getPlayerLabel(winnerId)} with move ${winningMove}`)
    console.log(`  Centipawn Loss: ${chosenLoss} | Accuracy: ${this.calculateAccuracy(chosenLoss).toFixed(1)}%`)
    console.log(`${'='.repeat(60)}\n`)

    const moveParts = this.getMoveParts(winningMove, this.gameState.fen)
    if (moveParts) {
      this._lastMove = moveParts
    }

    this._lastMoveComparison = {
      player1Move,
      player2Move,
      player1Score,
      player2Score,
      player1Accuracy,
      player2Accuracy,
      player1Loss,
      player2Loss,
      winningMove,
      winningScore,
      isSync,
      bestEngineMove: bestMoveResult.move,
      bestEngineScore: bestMoveScore
    }

    if (!skipStatsUpdate) {
      this.updateStats(isSync, chosenLoss, player1Accuracy, player2Accuracy)
    }
    
    this.gameState.resolve(winningMove)

    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }
  }

  private calculateAccuracy(centipawnLoss: number): number {
    if (centipawnLoss === Infinity || centipawnLoss < 0) return 0
    if (centipawnLoss === 0) return 100
    return Math.max(0, Math.min(100, 100 * 200 / (centipawnLoss + 200)))
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

  private updateStats(isSync: boolean, chosenLoss: number, player1Accuracy: number, player2Accuracy: number): void {
    const isWhiteTeam = this.gameState.currentTeam === Team.WHITE
    
    if (isWhiteTeam) {
      this.stats.whiteMovesPlayed++
      if (isSync) {
        const currentSyncMoves = this.stats.whiteSyncRate * (this.stats.whiteMovesPlayed - 1)
        this.stats.whiteSyncRate = (currentSyncMoves + 1) / this.stats.whiteMovesPlayed
      } else {
        this.stats.whiteConflicts++
        const currentSyncMoves = this.stats.whiteSyncRate * (this.stats.whiteMovesPlayed - 1)
        this.stats.whiteSyncRate = currentSyncMoves / this.stats.whiteMovesPlayed
      }
    }

    this.stats.movesPlayed++
    
    if (isSync) {
      const currentSyncMoves = this.stats.syncRate * (this.stats.movesPlayed - 1)
      this.stats.syncRate = (currentSyncMoves + 1) / this.stats.movesPlayed
    } else {
      this.stats.conflicts++
      const currentSyncMoves = this.stats.syncRate * (this.stats.movesPlayed - 1)
      this.stats.syncRate = currentSyncMoves / this.stats.movesPlayed
    }

    if (isWhiteTeam) {
      this.stats.lastMoveAccuracy = Math.round(player1Accuracy)
      this.stats.lastMoveAccuracyP2 = Math.round(player2Accuracy)

      const totalP1 = this.stats.player1Accuracy * (this.stats.whiteMovesPlayed - 1)
      this.stats.player1Accuracy = (totalP1 + player1Accuracy) / this.stats.whiteMovesPlayed
      
      const totalP2 = this.stats.player2Accuracy * (this.stats.whiteMovesPlayed - 1)
      this.stats.player2Accuracy = (totalP2 + player2Accuracy) / this.stats.whiteMovesPlayed
    }
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
