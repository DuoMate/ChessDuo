import { Chess } from 'chess.js'
import { supabase, Room, RoomPlayer } from './supabase'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from './gameState'
import { GameStatus, MoveComparison } from './localGame'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  private onStateChangeCallback: (() => void) | null = null
  private stats = {
    movesPlayed: 0,
    syncRate: 0,
    conflicts: 0,
    winningMoves: 0,
    player1Accuracy: 0,
    player2Accuracy: 0
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

  get pendingOverlay(): PendingMoveInfo | null {
    return null
  }

  get highlightSquares() {
    return null
  }

  constructor() {
    this.gameState = new GameState()
    this._status = GameStatus.WAITING
  }

  async joinRoom(room: Room, playerId: string, team: 'WHITE' | 'BLACK'): Promise<void> {
    this._room = room
    this._playerId = playerId
    this._team = team

    // Query room_players to find all players in the room
    const { data: players } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)

    // Add human players to gameState
    const humanPlayers = players?.filter(p => p.team === team) || []
    const opponentPlayers = players?.filter(p => p.team !== team) || []

    // Add current player
    const playerNum = team === 'WHITE' ? Team.WHITE : Team.BLACK
    this.gameState.addPlayer(playerId as Player, playerNum)

    // Add teammate (other human on same team)
    const teammate = humanPlayers.find(p => p.player_id !== playerId)
    if (teammate) {
      this.gameState.addPlayer(teammate.player_id as Player, playerNum)
    }

    // Add bot opponents (2 bots for the other team)
    const opponentTeam = team === 'WHITE' ? Team.BLACK : Team.WHITE
    this.gameState.addPlayer('bot_opponent_1' as Player, opponentTeam)
    this.gameState.addPlayer('bot_opponent_2' as Player, opponentTeam)

    this._channel = supabase.channel(`room:${room.id}`, {
      config: {
        presence: { key: playerId }
      }
    })

    this._channel
      .on('presence', { event: 'sync' }, () => {
        const state = this._channel?.presenceState() || {}
        console.log('[ONLINE] Presence sync:', Object.keys(state))
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
        if (status === 'SUBSCRIBED') {
          await this._channel?.track({
            player_id: playerId,
            team: team,
            status: 'connected'
          })
        }
      })

    this._status = GameStatus.READY
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
    this.gameState.resolve(payload.winningMove)
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
    const pendingMoves = this.gameState.getPendingMoves()
    const humanMove = pendingMoves.human
    const teammateMove = pendingMoves.teammate

    if (!humanMove || !teammateMove) {
      throw new Error('Both pending moves must be set')
    }

    const player1Move = humanMove.move
    const player2Move = teammateMove.move
    const isSync = player1Move === player2Move

    const winningMove = player1Move
    const winnerId = 'player1'

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