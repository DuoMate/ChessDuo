import { Chess } from 'chess.js'
import { supabase, Room, RoomPlayer } from '../../../lib/supabase'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from '../../game-engine/gameState'
import { GameStatus, MoveComparison } from '../../offline/game/localGame'
import { ServerMoveEvaluator } from '../../bots/serverMoveEvaluator'
import type { RealtimeChannel } from '@supabase/supabase-js'

const SERVER_URL = process.env.NEXT_PUBLIC_EVALUATOR_URL || ''

interface MovePayload {
  playerId: string
  move: string
  from: string
  to: string
}

interface LockedPayload {
  playerId: string
}

interface ResolvedPayload {
  winningTeam: string
  winningMove: string
}

export interface OnlineGameState {
  room: Room | null
  playerId: string
  team: 'WHITE' | 'BLACK'
  players: Map<string, RoomPlayer>
}

export class OnlineGame {
  private gameState: GameState
  private _status: GameStatus
  private _lastMove: { from: string; to: string } | null = null
  private _lastMoveComparison: MoveComparison | null = null
  private _room: Room | null = null
  private _playerId: string = ''
  private _team: 'WHITE' | 'BLACK' = 'WHITE'
  private _players: Map<string, RoomPlayer> = new Map()
  private _channel: RealtimeChannel | null = null
  private initialized = false
  private starting = false
  private onStateChangeCallback: (() => void) | null = null
  private stats = {
    movesPlayed: 0,
    syncRate: 0,
    conflicts: 0,
    winningMoves: 0,
    player1Accuracy: 0,
    player2Accuracy: 0
  }
  private evaluator: ServerMoveEvaluator

  constructor() {
    this.gameState = new GameState()
    this._status = GameStatus.WAITING
    console.log(`[OnlineGame] Using server evaluator: ${SERVER_URL}`)
    this.evaluator = SERVER_URL ? new ServerMoveEvaluator(SERVER_URL) : new ServerMoveEvaluator('')
  }

  private calculateAccuracy(lossInCentipawns: number): number {
    if (lossInCentipawns <= 10) return 100
    if (lossInCentipawns >= 300) return 0
    return Math.round(100 * (1 - (lossInCentipawns - 10) / 290))
  }

  private getAccuracyCategory(lossInCentipawns: number): { label: string; color: string; emoji: string } {
    if (lossInCentipawns <= 10) return { label: 'Perfect', color: '#22c55e', emoji: '✓' }
    if (lossInCentipawns <= 30) return { label: 'Great', color: '#22c55e', emoji: '!' }
    if (lossInCentipawns <= 70) return { label: 'Good', color: '#84cc16', emoji: '?' }
    if (lossInCentipawns <= 150) return { label: 'Inaccuracy', color: '#eab308', emoji: '??' }
    return { label: 'Mistake', color: '#ef4444', emoji: '!!!' }
  }

  get highlightSquares() {
    return null
  }

  get status(): GameStatus {
    return this._status
  }

  get lastMove(): { from: string; to: string } | null {
    return this._lastMove
  }

  get lastMoveComparison(): MoveComparison | null {
    return this._lastMoveComparison
  }

  get pendingOverlay(): { from: string; to: string; piece: string; color: string } | null {
    const allMoves = this.gameState.getAllPendingMoves()
    for (const [player, pending] of allMoves) {
      if (player !== this._playerId) {
        // Teammate's pending move - show as overlay
        return { from: pending.from, to: pending.to, piece: pending.piece, color: 'white' }
      }
    }
    return null
  }

  async joinRoom(room: Room, playerId: string, team: 'WHITE' | 'BLACK'): Promise<void> {
    console.log('[ONLINE] joinRoom called:', { roomId: room.id, playerId, team })
    
    this._room = room
    this._playerId = playerId
    this._team = team

    // Don't add player here - wait for startGameWhenReady to add all players from room_players

    this._channel = supabase.channel(`room:${room.id}`, {
      config: {
        presence: { key: playerId }
      }
    })

    this._channel
      .on('presence', { event: 'sync' }, () => {
        const state = this._channel?.presenceState() || {}
        const playersOnline = Object.keys(state)
        console.log('[ONLINE] Presence sync:', playersOnline)
        
        // If both players are online and game hasn't started, start the game
        if (playersOnline.length >= 2 && this._status !== GameStatus.PLAYING) {
          this.startGameWhenReady()
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('[ONLINE] Player joined:', newPresences)
      })
      .on('broadcast', { event: 'player_move' }, ({ payload }) => {
        this.handleTeammateMove(payload as MovePayload)
      })
      .on('broadcast', { event: 'player_locked' }, ({ payload }) => {
        this.handleTeammateLocked(payload as LockedPayload)
      })
      .on('broadcast', { event: 'turn_resolved' }, ({ payload }) => {
        this.handleTurnResolved(payload as ResolvedPayload)
      })
      .subscribe(async (status: string) => {
        console.log('[ONLINE] Channel subscription status:', status)
        if (status === 'SUBSCRIBED') {
          await this._channel?.track({
            player_id: playerId,
            team: team,
            status: 'connected'
          })
          console.log('[ONLINE] Player tracked:', playerId)
        }
      })

    this._status = GameStatus.READY
    console.log('[ONLINE] joinRoom completed, status:', this._status)
  }

  async startGameWhenReady(): Promise<void> {
    // Prevent double-start and race conditions
    if (this._status === GameStatus.PLAYING) {
      console.log('[ONLINE] Game already started, skipping...')
      return
    }
    
    if (this.starting) {
      console.log('[ONLINE] Game start already in progress, skipping...')
      return
    }
    
    this.starting = true
    
    try {
      // Query room_players to get all human players in the room
      const { data: players } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', this._room!.id)
        .order('player_id', { ascending: true })

      const humanPlayers = (players || []).filter(p => p.team === this._team)

      // Add human players in sorted order (by player_id) to ensure consistent state
      const playerNum = this._team === 'WHITE' ? Team.WHITE : Team.BLACK
      for (const p of humanPlayers) {
        try {
          this.gameState.addPlayer(p.player_id as Player, playerNum)
        } catch (e) {
          // Player might already exist, skip
          console.log('[ONLINE] Player already exists or error:', e)
        }
      }

      // Add bot opponents
      const opponentTeam = this._team === 'WHITE' ? Team.BLACK : Team.WHITE
      this.gameState.addPlayer('bot_opponent_1' as Player, opponentTeam)
      this.gameState.addPlayer('bot_opponent_2' as Player, opponentTeam)

      // Start the game
      this.gameState.startMatch()
      this._status = GameStatus.PLAYING
      this.startPendingTurn()
      this.notifyStateChange()
      console.log('[ONLINE] Game started successfully')
    } catch (e) {
      console.error('[ONLINE] Failed to start game:', e)
    } finally {
      this.starting = false
    }
  }

  private handleTeammateMove(payload: { playerId: string; move: string; from: string; to: string }) {
    console.log('[ONLINE] Teammate moved:', payload)
    if (payload.playerId !== this._playerId) {
      this.gameState.setPendingMove(payload.playerId as Player, payload.move, payload.from, payload.to, 'unknown')
      this.notifyStateChange()
    }
  }

  private handleTeammateLocked(payload: { playerId: string }) {
    console.log('[ONLINE] Teammate locked:', payload)
    if (payload.playerId !== this._playerId) {
      this.gameState.lockPendingMove(payload.playerId as Player)
      this.notifyStateChange()
    }
  }

  private handleTurnResolved(payload: { winningTeam: string; winningMove: string }) {
    console.log('[ONLINE] Turn resolved:', payload)
    console.log('[ONLINE] Current phase:', this.gameState.phase, 'currentTurn:', this.gameState.currentTeam)
    
    // Try to apply the move - if it fails (already resolved), we still need to advance to next turn
    const result = this.gameState.resolve(payload.winningMove)
    if (result) {
      console.log('[ONLINE] Applied resolved move locally:', payload.winningMove, 'new turn:', this.gameState.currentTeam)
    } else {
      console.log('[ONLINE] Move already resolved (phase:', this.gameState.phase, '), forcing turn advancement')
      // Always advance to the next turn after receiving a turn_resolved broadcast
      const nextTeam = this.gameState.currentTeam === Team.WHITE ? Team.BLACK : Team.WHITE
      this.gameState.setCurrentTeam(nextTeam)
      console.log('[ONLINE] Force switched to:', nextTeam)
    }
    
    // Start pending turn for the new phase
    this.startPendingTurn()
    
    console.log('[ONLINE] After handleTurnResolved - phase:', this.gameState.phase, 'turn:', this.gameState.currentTeam)
    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }
    this.notifyStateChange()
  }

  async broadcastMove(move: string, from: string, to: string): Promise<void> {
    if (!this._channel) return

    await this._channel.send({
      type: 'broadcast',
      event: 'player_move',
      payload: { playerId: this._playerId, move, from, to }
    })
  }

  async broadcastLocked(): Promise<void> {
    if (!this._channel) return

    await this._channel.send({
      type: 'broadcast',
      event: 'player_locked',
      payload: { playerId: this._playerId }
    })
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

  getPlayers(team: Team): Player[] {
    return this.gameState.getPlayers(team)
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

  async resolvePendingMoves(): Promise<{ winnerId: string; winningMove: string }> {
    const currentTeam = this.gameState.currentTeam
    const allPendingMoves = this.gameState.getAllPendingMoves()
    const pendingMovesArray = Array.from(allPendingMoves.entries())
    
    // For WHITE team: use player ID to identify my move vs teammate
    // For BLACK team (opponent bots): just get any two moves
    let move1: PendingMoveInfo | null = null
    let move2: PendingMoveInfo | null = null
    let player1Id = ''
    let player2Id = ''
    
    if (currentTeam === Team.WHITE) {
      // My move is for this player ID, teammate is the other
      for (const [player, pending] of allPendingMoves) {
        if (player === this._playerId) {
          move1 = pending
          player1Id = player
        } else {
          move2 = pending
          player2Id = player
        }
      }
    } else {
      // BLACK turn - just get any two pending moves (both are bot moves)
      if (pendingMovesArray.length >= 2) {
        move1 = pendingMovesArray[0][1]
        player1Id = pendingMovesArray[0][0]
        move2 = pendingMovesArray[1][1]
        player2Id = pendingMovesArray[1][0]
      }
    }

    if (!move1 || !move2) {
      console.log('[RESOLVE] Pending moves debug:', {
        allPlayers: Array.from(allPendingMoves.keys()),
        currentTeam,
        myPlayerId: this._playerId,
        move1,
        move2
      })
      throw new Error('Both pending moves must be set')
    }

    const player1Move = move1.move
    const player2Move = move2.move
    const player1From = move1.from
    const player1To = move1.to
    const player2From = move2.from
    const player2To = move2.to
    const isSync = player1Move === player2Move

    console.log(`\n${'='.repeat(60)}`)
    console.log(`[ONLINE RESOLVE] ${currentTeam} team to move`)
    console.log(`[MOVES] ${player1Id}: ${player1Move} (${player1From}${player1To}) | ${player2Id}: ${player2Move} (${player2From}${player2To})`)
    
    const turnStartFen = this.gameState.getTurnStartFen()
    
    const player1Uci = player1From + player1To
    const player2Uci = player2From + player2To
    
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
    console.log(`  [${player1Id}] ${player1Move} (${player1Uci}): score=${player1Score} | loss=${player1Loss}cp | accuracy=${player1Accuracy.toFixed(1)}%`)
    console.log(`  [${player2Id}] ${player2Move} (${player2Uci}): score=${player2Score} | loss=${player2Loss}cp | accuracy=${player2Accuracy.toFixed(1)}%`)

    const winningMove = player1Loss < player2Loss ? player1Move : (player2Loss < player1Loss ? player2Move : player1Move)
    const winningScore = winningMove === player1Move ? player1Score : player2Score
    const chosenLoss = winningMove === player1Move ? player1Loss : player2Loss
    const winnerId: 'player1' | 'player2' = isSync ? 'player1' : (winningMove === player1Move ? 'player1' : 'player2')
    const loserId: 'player1' | 'player2' | null = isSync ? null : (winningMove === player1Move ? 'player2' : 'player1')
    const loserFrom = loserId === 'player2' ? player2From : (loserId === 'player1' ? player1From : '')
    const loserTo = loserId === 'player2' ? player2To : (loserId === 'player1' ? player1To : '')

    console.log(`[RESULT] Winner: ${winnerId} with move: ${winningMove} (accuracy: ${winnerId === 'player1' ? player1Accuracy : player2Accuracy}%)`)
    
    // Store the comparison for UI
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
      winnerId,
      loserId,
      loserFrom,
      loserTo
    }

    this.gameState.resolve(winningMove)

    if (this._channel) {
      await this._channel.send({
        type: 'broadcast',
        event: 'turn_resolved',
        payload: { winningTeam: currentTeam, winningMove }
      })
    }

    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }

    return { winnerId, winningMove }
  }

  async leaveRoom(): Promise<void> {
    if (this._channel) {
      await supabase.removeChannel(this._channel)
      this._channel = null
    }
    this._room = null
  }

  setOnStateChange(callback: () => void): void {
    this.onStateChangeCallback = callback
  }

  private notifyStateChange(): void {
    this.onStateChangeCallback?.()
  }

  get fen(): string {
    return this.gameState.fen
  }

  get gamePhase(): GamePhase {
    return this.gameState.phase
  }

  get isBotThinking(): boolean {
    return false
  }

  get currentTurnInfo(): Team {
    return this.gameState.currentTeam
  }

  get currentTurn(): Team {
    return this.gameState.currentTeam
  }

  get board(): Chess {
    return this.gameState.board
  }

  get selectedMove(): string | null {
    return null
  }

  get showResolution(): boolean {
    return this.gameState.phase === GamePhase.RESOLVED
  }

  get moveComparison(): MoveComparison | null {
    return this._lastMoveComparison
  }

  get capturedByWhite(): CapturedPieces {
    return this.gameState.capturedPieces
  }

  get capturedByBlack(): CapturedPieces {
    const captured = this.gameState.capturedPieces
    return { white: captured.black, black: captured.white }
  }

  getCapturedPieces(): { white: string[]; black: string[] } {
    const captured = this.gameState.capturedPieces
    return {
      white: captured.white || [],
      black: captured.black || []
    }
  }
}