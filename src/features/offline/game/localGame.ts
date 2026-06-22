import { Chess, Move } from 'chess.js'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from '../../game-engine/gameState'
import { ServerMoveEvaluator } from '../../bots/serverMoveEvaluator'
import { calculateAccuracy, getAccuracyCategory } from '../../shared/accuracy'
import { CHECKMATE_SCORE } from '../../shared/gameConstants'

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
  alternatives: { move: string; score: number }[]
  youMatchedEngine: boolean
  teammateMatchedEngine: boolean
}

export class LocalGame {
  private gameState: GameState
  private evaluator: ServerMoveEvaluator
  private _status: GameStatus
  private stats: GameStats
  private _lastMove: { from: string; to: string } | null = null
  private _lastMoveComparison: MoveComparison | null = null
  private initialized = false

  constructor(timeLimitSeconds: number = 600) {
    this.gameState = new GameState(timeLimitSeconds)
    
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

  get savedMoveHistory(): Array<{ team: string; move: string }> {
    return []
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

  getAllPendingMoves(): Map<Player, PendingMoveInfo> {
    return this.gameState.getAllPendingMoves()
  }

  get player1Id(): string {
    return 'player1'
  }

  getTurnState(): string {
    if (this._status === GameStatus.GAME_OVER) return 'game_over'
    if (this.isBothPendingLocked()) return 'locked'
    if (this.gameState.getPendingMoves().human) return 'waiting_for_teammate'
    return 'selecting'
  }

  setTurnState(_state: string): void {
    // No-op in offline mode — turn state is derived, not set
  }

  getTurnStartFen(): string {
    return this.gameState.getTurnStartFen()
  }

  getMatchTimeRemaining(): number {
    return this.gameState.getMatchTimeRemaining()
  }

  setMatchTimeRemaining(seconds: number): void {
    this.gameState.setMatchTimeRemaining(seconds)
  }

  isMatchTimerActive(): boolean {
    return this.gameState.isMatchTimerActive()
  }

  setMatchTimerActive(active: boolean): void {
    this.gameState.setMatchTimerActive(active)
  }

  getEvaluator(): ServerMoveEvaluator {
    return this.evaluator
  }

  setGameOverTimeup(result: string, reason: string): void {
    this._status = GameStatus.GAME_OVER
    this._gameOverResult = result
    this._gameOverReason = reason
  }

  private _gameOverResult: string = ''
  private _gameOverReason: string = ''

  setGameOverResult(result: string): void {
    this._gameOverResult = result
  }

  setGameOverReason(reason: string): void {
    this._gameOverReason = reason
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

      // Checkmate short-circuit: skip Stockfish if either move is checkmate
      try {
        chess.move(player1Move)
        if (chess.isCheckmate()) {
          this._lastMove = { from: player1From, to: player1To }
          this._lastMoveComparison = {
            player1Move, player2Move, player1Score: CHECKMATE_SCORE, player2Score: 0,
            player1Accuracy: 100, player2Accuracy: 0, player1Loss: 0, player2Loss: CHECKMATE_SCORE,
            player1Category: getAccuracyCategory(0), player2Category: getAccuracyCategory(CHECKMATE_SCORE),
            winningMove: player1Move, winningScore: CHECKMATE_SCORE, isSync: false,
            bestEngineMove: player1Uci, bestEngineScore: CHECKMATE_SCORE,
            turnStartFen, winnerId: 'player1', loserId: 'player2',
            loserFrom: player2From, loserTo: player2To,
            alternatives: [], youMatchedEngine: true, teammateMatchedEngine: false,
          }
          this.gameState.resolve(player1Move)
          if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
          return { winnerId: 'player1' as const, winningMove: player1Move }
        }
      } catch (e) { console.error('[LocalGame] Checkmate evaluation failed (1):', e) }
      chess.load(turnStartFen)
      try {
        chess.move(player2Move)
        if (chess.isCheckmate()) {
          this._lastMove = { from: player2From, to: player2To }
          this._lastMoveComparison = {
            player1Move, player2Move, player1Score: 0, player2Score: CHECKMATE_SCORE,
            player1Accuracy: 0, player2Accuracy: 100, player1Loss: CHECKMATE_SCORE, player2Loss: 0,
            player1Category: getAccuracyCategory(CHECKMATE_SCORE), player2Category: getAccuracyCategory(0),
            winningMove: player2Move, winningScore: CHECKMATE_SCORE, isSync: false,
            bestEngineMove: player2Uci, bestEngineScore: CHECKMATE_SCORE,
            turnStartFen, winnerId: 'player2', loserId: 'player1',
            loserFrom: player1From, loserTo: player1To,
            alternatives: [], youMatchedEngine: false, teammateMatchedEngine: true,
          }
          this.gameState.resolve(player2Move)
          if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
          return { winnerId: 'player2' as const, winningMove: player2Move }
        }
      } catch (e) { console.error('[LocalGame] Checkmate evaluation failed (2):', e) }
      chess.load(turnStartFen)

      const verboseMoves = chess.moves({ verbose: true })

      const allLegalUci = verboseMoves.map(m => m.from + m.to + (m.promotion || ''))
      const topMovesUci = allLegalUci

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

     const player1Accuracy = calculateAccuracy(player1Loss)
     const player2Accuracy = calculateAccuracy(player2Loss)
     const player1Category = getAccuracyCategory(player1Loss)
     const player2Category = getAccuracyCategory(player2Loss)

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
      console.log(`  Centipawn Loss: ${chosenLoss} | Accuracy: ${calculateAccuracy(chosenLoss).toFixed(1)}%`)
      console.log(`${'='.repeat(60)}\n`)

    if (winnerId === 'player1') {
      this._lastMove = { from: player1From, to: player1To }
    } else if (winnerId === 'player2') {
      this._lastMove = { from: player2From, to: player2To }
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
      loserTo,
      alternatives: evalResults.slice(0, 5).filter(r => r.move !== bestMoveUci),
      youMatchedEngine: player1Uci === bestMoveUci,
      teammateMatchedEngine: player2Uci === bestMoveUci,
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

      // Checkmate short-circuit: skip Stockfish if either move is checkmate
      try {
        chess.move(player1Move)
        if (chess.isCheckmate()) {
          this._lastMove = this.getMoveParts(player1Move, turnStartFen)
          this._lastMoveComparison = {
            player1Move, player2Move, player1Score: CHECKMATE_SCORE, player2Score: 0,
            player1Accuracy: 100, player2Accuracy: 0, player1Loss: 0, player2Loss: CHECKMATE_SCORE,
            player1Category: getAccuracyCategory(0), player2Category: getAccuracyCategory(CHECKMATE_SCORE),
            winningMove: player1Move, winningScore: CHECKMATE_SCORE, isSync: false,
            bestEngineMove: player1Uci, bestEngineScore: CHECKMATE_SCORE,
            turnStartFen, winnerId: 'player1', loserId: 'player2',
            loserFrom: '', loserTo: '',
            alternatives: [], youMatchedEngine: true, teammateMatchedEngine: false,
          }
          this.gameState.resolve(player1Move)
          if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
          return
        }
      } catch (e) { console.error('[LocalGame] Checkmate evaluation failed (3):', e) }
      chess.load(turnStartFen)
      try {
        chess.move(player2Move)
        if (chess.isCheckmate()) {
          this._lastMove = this.getMoveParts(player2Move, turnStartFen)
          this._lastMoveComparison = {
            player1Move, player2Move, player1Score: 0, player2Score: CHECKMATE_SCORE,
            player1Accuracy: 0, player2Accuracy: 100, player1Loss: CHECKMATE_SCORE, player2Loss: 0,
            player1Category: getAccuracyCategory(CHECKMATE_SCORE), player2Category: getAccuracyCategory(0),
            winningMove: player2Move, winningScore: CHECKMATE_SCORE, isSync: false,
            bestEngineMove: player2Uci, bestEngineScore: CHECKMATE_SCORE,
            turnStartFen, winnerId: 'player2', loserId: 'player1',
            loserFrom: '', loserTo: '',
            alternatives: [], youMatchedEngine: false, teammateMatchedEngine: true,
          }
          this.gameState.resolve(player2Move)
          if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
          return
        }
      } catch (e) { console.error('[LocalGame] Checkmate evaluation failed (4):', e) }
      chess.load(turnStartFen)

      const verboseMoves = chess.moves({ verbose: true })

      const allLegalUci = verboseMoves.map(m => m.from + m.to + (m.promotion || ''))
      const topMovesUci = allLegalUci

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

     const player1Accuracy = calculateAccuracy(player1Loss)
     const player2Accuracy = calculateAccuracy(player2Loss)
     const player1Category = getAccuracyCategory(player1Loss)
     const player2Category = getAccuracyCategory(player2Loss)
      
     console.log(`\n[EVALUATION] (from: ${turnStartFen.substring(0, 50)}...)`)
     console.log(`  [Optimal] ${bestMoveUci}: score=${bestMoveScore}`)
     console.log(`  [${getPlayerLabel(player1Id)}] ${player1Move} (${player1Uci}): score=${player1Score} | loss=${player1Loss}cp | accuracy=${player1Accuracy.toFixed(1)}%`)
     console.log(`  [${getPlayerLabel(player2Id)}] ${player2Move}: score=${player2Score} | loss=${player2Loss}cp | accuracy=${player2Accuracy.toFixed(1)}%`)
      
     const winningMove = player1Loss < player2Loss ? player1Move : (player2Loss < player1Loss ? player2Move : player1Move)
     const winningScore = winningMove === player1Move ? player1Score : player2Score
     const chosenLoss = winningMove === player1Move ? player1Loss : player2Loss
     const winnerId = winningMove === player1Move ? player1Id : player2Id
     
     console.log(`\n[RESULT] ${isSync ? 'SYNCED' : 'Winner: ' + getPlayerLabel(winnerId)} with move ${winningMove}`)
     console.log(`  Centipawn Loss: ${chosenLoss} | Accuracy: ${calculateAccuracy(chosenLoss).toFixed(1)}%`)
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
      loserTo: '',
      alternatives: evalResults.slice(0, 5).filter(r => r.move !== bestMoveUci),
      youMatchedEngine: player1Uci === bestMoveUci,
      teammateMatchedEngine: player2Uci === bestMoveUci,
    }

    if (!skipStatsUpdate) {
      this.updateStats(isSync, chosenLoss, player1Accuracy, player2Accuracy)
    }
    
    this.gameState.resolve(winningMove)

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
    } catch (e) {
      console.error('[LocalGame] getMoveParts error:', e)
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
    if (this._gameOverResult) return this._gameOverResult
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

  getTeam(): 'WHITE' | 'BLACK' {
    return 'WHITE'
  }

  isFourPlayer(): boolean {
    return false
  }

  getPlayerTeam(playerId: string): 'WHITE' | 'BLACK' | null {
    if (this.gameState.getPlayers(Team.WHITE).includes(playerId as Player)) return 'WHITE'
    if (this.gameState.getPlayers(Team.BLACK).includes(playerId as Player)) return 'BLACK'
    return null
  }

  getPlayers(team: Team): Player[] {
    return this.gameState.getPlayers(team)
  }

  isCoordinator(): boolean {
    return false
  }

  getCoordinatorId(): string {
    return ''
  }

  getGameOverReason(): string | null {
    if (this._gameOverReason) return this._gameOverReason
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