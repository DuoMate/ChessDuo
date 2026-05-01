import { Chess } from 'chess.js'
import { supabase, Room, RoomPlayer } from '../../../lib/supabase'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from '../../game-engine/gameState'
import { GameStatus, MoveComparison } from '../../offline/game/localGame'
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
    // Don't call resolve again - we already resolved locally when our own code resolved
    // Just ensure status is updated if game is over
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
    const pendingMovesArray = Array.from(allPendingMoves.values())
    
    // For WHITE team: use player ID to identify my move vs teammate
    // For BLACK team (opponent bots): just get any two moves
    let move1: PendingMoveInfo | null = null
    let move2: PendingMoveInfo | null = null
    
    if (currentTeam === Team.WHITE) {
      // My move is for this player ID, teammate is the other
      for (const [player, pending] of allPendingMoves) {
        if (player === this._playerId) {
          move1 = pending
        } else {
          move2 = pending
        }
      }
    } else {
      // BLACK turn - just get any two pending moves (both are bot moves)
      move1 = pendingMovesArray[0] || null
      move2 = pendingMovesArray[1] || null
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