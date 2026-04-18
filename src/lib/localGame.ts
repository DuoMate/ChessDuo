import { Chess, Move } from 'chess.js'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from './gameState'
import { ServerMoveEvaluator } from './serverMoveEvaluator'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

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
  player1Category: { label: string; color: string; emoji: string }
  player2Category: { label: string; color: string; emoji: string }
  winningMove: string
  winningScore: number
  isSync: boolean
  bestEngineMove: string
  bestEngineScore: number
  turnStartFen: string
  winnerId: 'player1' | 'player2'
  loserId: 'player1' | 'player2' | null
  loserFrom: string
  loserTo: string
}

export class LocalGame {
  private gameState: GameState
  private evaluator: ServerMoveEvaluator
  private _status: GameStatus
  private stats: GameStats
  private _lastMove: { from: string; to: string } | null = null
  private _lastMoveComparison: MoveComparison | null = null
  private initialized = false

  constructor() {
    this.gameState = new GameState()
    
    if (SERVER_URL) {
      console.log(`[LocalGame] Using server evaluator: ${SERVER_URL}`)
      this.evaluator = new ServerMoveEvaluator(SERVER_URL)
    } else {
      console.warn('[LocalGame] No server URL configured - evaluations will fail')
      this.evaluator = new ServerMoveEvaluator('')
    }
    
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
    this.startPendingTurn()
  }

  startPendingTurn(): void {
    const fen = this.gameState.fen
    this.gameState.startPendingTurn(fen)
  }

  setPendingMove(player: Player, move: string, from: string, to: string, piece: string): void {
    this.gameState.setPendingMove(player, move, from, to, piece)
  }

  lockPendingMove(player: Player): void {
    this.gameState.lockPendingMove(player)
  }

  lockMove(player: Player): void {
    this.gameState.lockMove(player)
  }

  isPendingMoveLocked(player: Player): boolean {
    return this.gameState.isPendingMoveLocked(player)
  }

  isBothPendingLocked(): boolean {
    return this.gameState.isBothPendingLocked()
  }

  getPendingMoves(): { human: PendingMoveInfo | null; teammate: PendingMoveInfo | null } {
    return this.gameState.getPendingMoves()
  }

  getTurnStartFen(): string {
    return this.gameState.getTurnStartFen()
  }

  getTeamTimer(): number {
    return this.gameState.getTeamTimer()
  }

  setTeamTimer(seconds: number): void {
    this.gameState.setTeamTimer(seconds)
  }

  isTimerActive(): boolean {
    return this.gameState.isTimerActive()
  }

  setTimerActive(active: boolean): void {
    this.gameState.setTimerActive(active)
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

  async resolvePendingMoves(skipStatsUpdate: boolean = false): Promise<{ winnerId: string; winningMove: string }> {
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

    const pendingMoves = this.gameState.getPendingMoves()
    const humanMove = pendingMoves.human
    const teammateMove = pendingMoves.teammate

    if (!humanMove || !teammateMove) {
      throw new Error('Both pending moves must be set before resolving')
    }

    const player1Move = humanMove.move
    const player2Move = teammateMove.move
    const player1From = humanMove.from
    const player1To = humanMove.to
    const player2From = teammateMove.from
    const player2To = teammateMove.to

    const isSync = player1Move === player2Move

    console.log(`\n${'='.repeat(60)}`)
    console.log(`[TURN] ${teamColor} team to move`)
    console.log(`[MOVES] ${getPlayerLabel(player1Id)}: ${player1Move} | ${getPlayerLabel(player2Id)}: ${player2Move}`)
     
     const turnStartFen = this.gameState.getTurnStartFen()
     
     const player1Uci = player1From + player1To
     const player2Uci = player2From + player2To
     
     const Chess = (await import('chess.js')).Chess
     const chess = new Chess(turnStartFen)
     const verboseMoves = chess.moves({ verbose: true })
     const topMovesUci = verboseMoves.slice(0, 6).map(m => m.from + m.to + (m.promotion || ''))
     const evalResults = await this.evaluator.evaluateMoves(topMovesUci, turnStartFen)
     
     const scoreMap = new Map<string, number>(evalResults.map(r => [r.move, r.score]))
     
     const bestResult = evalResults.reduce((a, b) => a.score > b.score ? a : b, evalResults[0])
     const bestMoveScore = bestResult?.score ?? 0
     const bestMoveUci = bestResult?.move ?? ''
     
     const player1Score = scoreMap.get(player1Uci) ?? 0
     const player2Score = scoreMap.get(player2Uci) ?? 0

     const player1Loss = Math.abs(bestMoveScore - player1Score)
     const player2Loss = Math.abs(bestMoveScore - player2Score)
     
     if (isSync) {
       console.log(`[SYNC] Both players chose the same move: ${player1Move}`)
     }

     const player1Accuracy = this.calculateAccuracy(player1Loss)
     const player2Accuracy = this.calculateAccuracy(player2Loss)
     const player1Category = this.getAccuracyCategory(player1Loss)
     const player2Category = this.getAccuracyCategory(player2Loss)

     console.log(`\n[EVALUATION] (from: ${turnStartFen.substring(0, 50)}...)`)
     console.log(`  [Optimal] ${bestMoveUci}: score=${bestMoveScore}`)
     console.log(`  [${getPlayerLabel(player1Id)}] ${player1Move} (${player1Uci}): score=${player1Score} | loss=${player1Loss}cp | accuracy=${player1Accuracy.toFixed(1)}%`)
     console.log(`  [${getPlayerLabel(player2Id)}] ${player2Move} (${player2Uci}): score=${player2Score} | loss=${player2Loss}cp | accuracy=${player2Accuracy.toFixed(1)}%`)
    
    const winningMove = player1Loss < player2Loss ? player1Move : (player2Loss < player1Loss ? player2Move : player1Move)
     const winningScore = winningMove === player1Move ? player1Score : player2Score
     const chosenLoss = winningMove === player1Move ? player1Loss : player2Loss
     const winnerId: 'player1' | 'player2' = isSync ? 'player1' : (winningMove === player1Move ? 'player1' : 'player2')
     const loserId: 'player1' | 'player2' | null = isSync ? null : (winningMove === player1Move ? 'player2' : 'player1')
     const loserFrom = isSync ? '' : (winningMove === player1Move ? player2From : player1From)
     const loserTo = isSync ? '' : (winningMove === player1Move ? player2To : player1To)
     
    console.log(`\n[RESULT] ${isSync ? 'SYNCED' : 'Winner: ' + getPlayerLabel(winnerId)} with move ${winningMove}`)
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
      player1Category,
      player2Category,
      winningMove,
      winningScore,
      isSync,
      bestEngineMove: bestMoveUci,
      bestEngineScore: bestMoveScore,
      turnStartFen,
      winnerId: winnerId as 'player1' | 'player2',
      loserId,
      loserFrom,
      loserTo
    }

    if (!skipStatsUpdate) {
      this.updateStats(isSync, chosenLoss, player1Accuracy, player2Accuracy)
    }
    
    this.gameState.resolve(winningMove)

    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }

    return { winnerId, winningMove }
  }

  async lockAndResolve(skipStatsUpdate: boolean = false): Promise<void> {
    await this.resolveLegacy(skipStatsUpdate)
  }

  async resolveLegacy(skipStatsUpdate: boolean = false): Promise<void> {
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
    
    const currentFen = this.gameState.fen
     
     const turnStartFen = currentFen
     
     const sanToUci = (san: string, fen: string): string => {
       const chess = new Chess(fen)
       const moves = chess.moves({ verbose: true })
       const found = moves.find(m => m.san === san || m.lan === san)
       if (found) {
         return found.from + found.to + (found.promotion || '')
       }
       return san
     }
     
     const player1Uci = sanToUci(player1Move, turnStartFen)
     const player2Uci = sanToUci(player2Move, turnStartFen)
     
     const ChessLib = (await import('chess.js')).Chess
     const chess = new ChessLib(turnStartFen)
     const verboseMoves = chess.moves({ verbose: true })
     const topMovesUci = verboseMoves.slice(0, 6).map(m => m.from + m.to + (m.promotion || ''))
     const evalResults = await this.evaluator.evaluateMoves(topMovesUci, turnStartFen)
     
     const scoreMap = new Map<string, number>(evalResults.map(r => [r.move, r.score]))
     
     const bestResult = evalResults.reduce((a, b) => a.score > b.score ? a : b, evalResults[0])
     const bestMoveScore = bestResult?.score ?? 0
     const bestMoveUci = bestResult?.move ?? ''
     
     const player1Score = scoreMap.get(player1Uci) ?? 0
     const player2Score = scoreMap.get(player2Uci) ?? 0

     const player1Loss = Math.abs(bestMoveScore - player1Score)
     const player2Loss = Math.abs(bestMoveScore - player2Score)
      
     if (isSync) {
       console.log(`[SYNC] Both players chose the same move: ${player1Move}`)
     }

     const player1Accuracy = this.calculateAccuracy(player1Loss)
     const player2Accuracy = this.calculateAccuracy(player2Loss)
     const player1Category = this.getAccuracyCategory(player1Loss)
     const player2Category = this.getAccuracyCategory(player2Loss)
      
     console.log(`\n[EVALUATION] (from: ${turnStartFen.substring(0, 50)}...)`)
     console.log(`  [Optimal] ${bestMoveUci}: score=${bestMoveScore}`)
     console.log(`  [${getPlayerLabel(player1Id)}] ${player1Move} (${player1Uci}): score=${player1Score} | loss=${player1Loss}cp | accuracy=${player1Accuracy.toFixed(1)}%`)
     console.log(`  [${getPlayerLabel(player2Id)}] ${player2Move}: score=${player2Score} | loss=${player2Loss}cp | accuracy=${player2Accuracy.toFixed(1)}%`)
      
     const winningMove = player1Loss < player2Loss ? player1Move : (player2Loss < player1Loss ? player2Move : player1Move)
     const winningScore = winningMove === player1Move ? player1Score : player2Score
     const chosenLoss = winningMove === player1Move ? player1Loss : player2Loss
     const winnerId = winningMove === player1Move ? player1Id : player2Id
     
     console.log(`\n[RESULT] ${isSync ? 'SYNCED' : 'Winner: ' + getPlayerLabel(winnerId)} with move ${winningMove}`)
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
      player1Category,
      player2Category,
      winningMove,
      winningScore,
      isSync,
      bestEngineMove: bestMoveUci,
      bestEngineScore: bestMoveScore,
      turnStartFen,
      winnerId: winnerId as 'player1' | 'player2',
      loserId: winnerId === player1Id ? player2Id as 'player1' | 'player2' : player1Id as 'player1' | 'player2',
      loserFrom: '',
      loserTo: ''
    }

    if (!skipStatsUpdate) {
      this.updateStats(isSync, chosenLoss, player1Accuracy, player2Accuracy)
    }
    
    this.gameState.resolve(winningMove)

    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }
  }

  private calculateAccuracy(cpLoss: number, isSacrifice: boolean = false): number {
    if (cpLoss < 0 || cpLoss === Infinity) {
      return 0
    }

    if (isSacrifice) {
      return 100
    }

    return Math.max(0, Math.min(100, 100 * 200 / (cpLoss + 200)))
  }

  private isBrilliantMove(
    move: Move,
    beforeFen: string,
    afterFen: string,
    beforeScore: number,
    afterScore: number
  ): boolean {
    if (!move.captured && !move.flags.includes('e') && !move.promotion) {
      return false
    }

    if (move.promotion) {
      return false
    }

    if (move.captured) {
      const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
      const movedPieceValue = pieceValues[move.piece] || 0
      const capturedPieceValue = pieceValues[move.captured.toLowerCase()] || 0

      if (capturedPieceValue >= movedPieceValue) {
        return false
      }

      const chess = new Chess(beforeFen)
      const moves = chess.moves({ verbose: true })
      const opponentMoves = moves.filter(m => m.color !== chess.turn())

      for (const oppMove of opponentMoves) {
        if (oppMove.to === move.to && (oppMove.flags.includes('c') || oppMove.flags.includes('e'))) {
          return false
        }
      }

      if (afterScore < beforeScore - 100) {
        return false
      }
    }

    if (move.flags.includes('e')) {
      return true
    }

    return false
  }

  private getAccuracyCategory(
    centipawnLoss: number,
    isBrilliant: boolean = false
  ): { label: string; color: string; emoji: string } {
    if (isBrilliant) {
      return { label: 'Brilliant', color: '#4ade80', emoji: '💎' }
    }
    if (centipawnLoss === Infinity || centipawnLoss < 0) {
      return { label: 'Error', color: 'gray', emoji: '?' }
    }
    if (centipawnLoss === 0) {
      return { label: 'Great', color: '#22c55e', emoji: '!' }
    }
    if (centipawnLoss < 30) {
      return { label: 'Great', color: '#22c55e', emoji: '!' }
    }
    if (centipawnLoss < 80) {
      return { label: 'Good', color: '#84cc16', emoji: '' }
    }
    if (centipawnLoss < 180) {
      return { label: 'Inaccuracy', color: '#eab308', emoji: '?' }
    }
    if (centipawnLoss < 300) {
      return { label: 'Mistake', color: '#f97316', emoji: '??' }
    }
    return { label: 'Blunder', color: '#ef4444', emoji: '???' }
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