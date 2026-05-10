import { Chess } from 'chess.js'
import { supabase, Room, RoomPlayer } from '../../../lib/supabase'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from '../../game-engine/gameState'
import { GameStatus, MoveComparison } from '../../offline/game/localGame'
import { ServerMoveEvaluator } from '../../bots/serverMoveEvaluator'
import { saveGameState, loadGameState } from '../../../lib/gamePersistence'
import { calculateAccuracy, getAccuracyCategory } from '../../shared/accuracy'
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
  comparison?: MoveComparison | null
  coordinatorId?: string
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
  // FIX: Separate comparisons for WHITE and BLACK teams to prevent stale data
  private _whiteComparison: MoveComparison | null = null
  private _blackComparison: MoveComparison | null = null
  private _lastMoveComparison: MoveComparison | null = null // Keep for backward compatibility
  private _room: Room | null = null
  private _playerId: string = ''
  private _player1Id: string = '' // Track which player ID is player1 for this client
  private _team: 'WHITE' | 'BLACK' = 'WHITE'
  private _players: Map<string, RoomPlayer> = new Map()
  private _channel: RealtimeChannel | null = null
  private initialized = false
  private starting = false
  private onStateChangeCallback: (() => void) | null = null
  private turnState: 'selecting' | 'waiting_for_teammate' | 'locked' | 'resolving' = 'selecting'
  private resolveTeammateLocked: (() => void) | null = null
  private resolveTurnChange: (() => void) | null = null
  private stats = {
    movesPlayed: 0,
    syncRate: 0,
    conflicts: 0,
    winningMoves: 0,
    player1Accuracy: 0,
    player2Accuracy: 0
  }
  private evaluator: ServerMoveEvaluator
  private _broadcastThrottle: Map<string, number> = new Map()
  private readonly BROADCAST_MIN_INTERVAL_MS = 500

  constructor() {
    this.gameState = new GameState()
    this._status = GameStatus.WAITING
    console.log(`[OnlineGame] Using server evaluator: ${SERVER_URL}`)
    this.evaluator = SERVER_URL ? new ServerMoveEvaluator(SERVER_URL) : new ServerMoveEvaluator('')
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

  getStats() {
    return { ...this.stats }
  }

  getResult(): string {
    const board = this.gameState.board
    if (board.isCheckmate()) {
      return board.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
    }
    if (board.isStalemate()) return 'Draw by stalemate'
    if (board.isThreefoldRepetition()) return 'Draw by threefold repetition'
    if (board.isInsufficientMaterial()) return 'Draw by insufficient material'
    if (board.isDraw()) return 'Draw'
    return 'Game in progress'
  }

  getGameOverReason(): string | null {
    const board = this.gameState.board
    if (board.isCheckmate()) return 'checkmate'
    if (board.isStalemate()) return 'stalemate'
    if (board.isThreefoldRepetition()) return 'threefoldRepetition'
    if (board.isInsufficientMaterial()) return 'insufficientMaterial'
    if (board.isDraw()) return 'draw'
    return null
  }

  get player1Id(): string {
    return this._player1Id || this.getCoordinatorId() || this._playerId
  }

  isCoordinator(): boolean {
    try {
      const players = this.gameState.getPlayers(Team.WHITE)
      if (players.length === 0) return true
      const sorted = [...players].sort()
      const result = this._playerId === sorted[0]
      console.log('[COORDINATOR] Decision:', { myId: this._playerId, players, sorted, isCoordinator: result })
      return result
    } catch {
      return true
    }
  }

  getCoordinatorId(): string {
    try {
      const players = this.gameState.getPlayers(Team.WHITE)
      const sorted = [...players].sort()
      return sorted[0] || ''
    } catch {
      return ''
    }
  }

  private getMoveParts(move: string, fen: string): { from: string; to: string } | null {
    try {
      const { Chess } = require('chess.js')
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true }) as Array<{ san: string; from: string; to: string }>
      const matchedMove = moves.find(m => m.san === move || m.san.replace(/[+#]/g, '') === move)
      if (matchedMove) {
        return { from: matchedMove.from, to: matchedMove.to }
      }
    } catch {
      return null
    }
    return null
  }

  get pendingOverlay(): { from: string; to: string; piece: string; color: string } | null {
    // Always show teammate's pending move if it exists
    const allMoves = this.gameState.getAllPendingMoves()
    console.log('[PENDING] allMoves:', Array.from(allMoves.entries()), 'myId:', this._playerId)
    for (const [player, pending] of allMoves) {
      if (player !== this._playerId) {
        console.log('[PENDING] Found teammate move:', player, pending)
        
        // Determine piece from board position if not known
        let piece = pending.piece
        if (!piece || piece === 'unknown') {
          try {
            const boardPiece = this.gameState.board.get(pending.from as any)
            piece = boardPiece?.type || 'p'
          } catch {
            piece = 'p'
          }
        }
        
        return { from: pending.from, to: pending.to, piece, color: 'white' }
      }
    }
    return null
  }

  // Event-based waiting - no timeouts
  waitForTeammateLock(): Promise<void> {
    console.log('[STATE] waitForTeammateLock called, current state:', this.turnState)
    return new Promise((resolve) => {
      // If already in locked state (teammate locked before we started waiting), resolve immediately
      if (this.turnState === 'locked') {
        console.log('[STATE] Already locked, resolving immediately')
        resolve()
        return
      }
      // If teammate already locked, transition to locked and resolve
      if (this.gameState.isPendingMoveLocked(this.getOtherPlayerId() as Player)) {
        console.log('[STATE] Teammate already locked, transitioning to locked')
        this.turnState = 'locked'
        resolve()
        return
      }
      // Otherwise, wait for the event
      this.resolveTeammateLocked = resolve
    })
  }

  // Wait for turn to change (used by non-coordinator)
  waitForTurnChange(): Promise<void> {
    console.log('[STATE] waitForTurnChange called')
    return new Promise((resolve) => {
      this.resolveTurnChange = resolve
    })
  }

  setTurnState(state: 'selecting' | 'waiting_for_teammate' | 'locked' | 'resolving') {
    console.log('[STATE] setTurnState:', this.turnState, '->', state)
    this.turnState = state
  }

  getTurnState(): string {
    return this.turnState
  }

  getOtherPlayerId(): string {
    const allPlayers = Array.from(this.gameState.getAllPendingMoves().keys())
    return allPlayers.find(p => p !== this._playerId) || ''
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
        
        // If both players are online, ensure game is ready
        // If game hasn't started, start it. If already started, just ensure state is synced.
        if (playersOnline.length >= 2) {
          if (this._status !== GameStatus.PLAYING) {
            this.startGameWhenReady()
          } else {
            // Game already started (we joined late) - sync state from database
            this.syncGameState()
          }
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
      // Check if a game already exists for this room (e.g., started by another player)
      if (this._room) {
        const existing = await loadGameState(this._room.id)
        if (existing && existing.status === 'PLAYING') {
          console.log('[ONLINE] Game already exists in DB, syncing as late joiner')
          this.starting = false
          await this.syncGameState()
          return
        }
      }

      // Query room_players to get all human players in the room
      const { data: players } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', this._room!.id)
        .order('player_id', { ascending: true })

      // Reset game state - ensures clean state
      this.gameState = new GameState()
      this._status = GameStatus.READY

      // Add human players to their respective teams
      const whiteHumans = (players || []).filter(p => p.team === 'WHITE')
      const blackHumans = (players || []).filter(p => p.team === 'BLACK')

      for (const p of whiteHumans) {
        try {
          this.gameState.addPlayer(p.player_id as Player, Team.WHITE)
        } catch (e) {
          console.log('[ONLINE] Player already exists or team full:', e)
        }
      }

      for (const p of blackHumans) {
        try {
          this.gameState.addPlayer(p.player_id as Player, Team.BLACK)
        } catch (e) {
          console.log('[ONLINE] Player already exists or team full:', e)
        }
      }

      // Fill remaining slots with bots (up to 2 per team)
      for (let i = whiteHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_white_${i + 1}` as Player, Team.WHITE)
        } catch (e) {}
      }

      for (let i = blackHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_black_${i + 1}` as Player, Team.BLACK)
        } catch (e) {}
      }

      // Start the game
      this.gameState.startMatch()
      this._status = GameStatus.PLAYING
      this.startPendingTurn()
      this.notifyStateChange()
      console.log('[ONLINE] Game started successfully')
      console.log('[COORDINATOR] Role at game start:', { myId: this._playerId, isCoordinator: this.isCoordinator(), coordinatorId: this.getCoordinatorId() })
      
      // Persist initial game state
      if (this._room) {
        saveGameState(this._room.id, this.gameState.fen, this.gameState.currentTeam, null, this._status)
      }
    } catch (e) {
      console.error('[ONLINE] Failed to start game:', e)
    } finally {
      this.starting = false
    }
  }

  private async syncGameState(): Promise<void> {
    console.log('[ONLINE] Syncing game state (late joiner)...')
    try {
      // Query room_players to get all human players
      const { data: players } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', this._room!.id)
        .order('player_id', { ascending: true })

      // Add players to both teams if not already present
      const whitePlayers = (players || []).filter(p => p.team === 'WHITE')
      const blackPlayers = (players || []).filter(p => p.team === 'BLACK')

      for (const p of whitePlayers) {
        try {
          this.gameState.addPlayer(p.player_id as Player, Team.WHITE)
        } catch (e) {
          // Already exists
        }
      }

      for (const p of blackPlayers) {
        try {
          this.gameState.addPlayer(p.player_id as Player, Team.BLACK)
        } catch (e) {
          // Already exists
        }
      }

      // Fill remaining slots with bots on both teams
      for (let i = whitePlayers.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_white_${i + 1}` as Player, Team.WHITE)
        } catch (e) {}
      }
      for (let i = blackPlayers.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_black_${i + 1}` as Player, Team.BLACK)
        } catch (e) {}
      }

      console.log('[ONLINE] Game state synced successfully')

      // Recover game state from DB (survives refresh/OS kill)
      if (this._room) {
        const saved = await loadGameState(this._room.id)
        if (saved && saved.moveHistory.length > 0) {
          console.log('[ONLINE] Replaying saved game state:', { moves: saved.moveHistory.length, fen: saved.fen.substring(0, 30) })
          try {
            this.gameState.resetBoard(saved.fen)
          } catch (e) {
            console.warn('[ONLINE] Could not restore board from saved FEN, replaying moves')
            this.gameState.startMatch()
            for (const entry of saved.moveHistory) {
              try {
                this.gameState.board.move(entry.move)
              } catch (me) {
                console.warn('[ONLINE] Could not replay move:', entry.move, me)
              }
            }
          }
          this._status = saved.status as GameStatus
          this.gameState.setCurrentTeam(saved.currentTurn === 'WHITE' ? Team.WHITE : Team.BLACK)
          this.startPendingTurn()
          this.notifyStateChange()
        }
      }
    } catch (e) {
      console.error('[ONLINE] Failed to sync game state:', e)
    }
  }

  private handleTeammateMove(payload: { playerId: string; move: string; from: string; to: string }) {
    console.log('[ONLINE] Teammate moved:', payload)
    if (payload.playerId !== this._playerId) {
      this.gameState.setPendingMove(payload.playerId as Player, payload.move, payload.from, payload.to, 'unknown')
      
      // If we're still in selecting (human hasn't moved yet), transition to waiting_for_teammate
      // This ensures pendingOverlay shows the teammate's move
      if (this.turnState === 'selecting') {
        console.log('[STATE] Teammate moved first, transitioning to waiting_for_teammate')
        this.turnState = 'waiting_for_teammate'
      }
      
      this.notifyStateChange()
    }
  }

  private handleTeammateLocked(payload: { playerId: string }) {
    console.log('[ONLINE] Teammate locked:', payload)
    if (payload.playerId !== this._playerId) {
      this.gameState.lockPendingMove(payload.playerId as Player)
      
      // Resolve the waitForTeammateLock Promise
      if (this.resolveTeammateLocked && this.turnState === 'waiting_for_teammate') {
        console.log('[STATE] Teammate locked, transitioning to locked state')
        this.turnState = 'locked'
        this.resolveTeammateLocked()
        this.resolveTeammateLocked = null
      }
      
      this.notifyStateChange()
    }
  }

  private handleTurnResolved(payload: { winningTeam: string; winningMove: string; comparison?: MoveComparison | null; coordinatorId?: string }) {
    console.log('[TURN-RESOLVED] Received broadcast:', {
      winningTeam: payload.winningTeam,
      winningMove: payload.winningMove,
      hasComparison: !!payload.comparison,
      coordinatorId: payload.coordinatorId,
      amCoordinator: this.isCoordinator(),
      myId: this._playerId,
      currentTurn: this.gameState.currentTeam,
      currentPhase: this.gameState.phase
    })
    
    if (payload.comparison) {
      console.log('[TURN-RESOLVED] Comparison received:', {
        player1Move: payload.comparison.player1Move,
        player2Move: payload.comparison.player2Move,
        isSync: payload.comparison.isSync,
        winnerId: payload.comparison.winnerId
      })
      this._lastMoveComparison = payload.comparison
      if (payload.coordinatorId) {
        this._player1Id = payload.coordinatorId
        console.log('[PLAYER1-ID] Set from coordinator:', payload.coordinatorId)
      }
      if (payload.winningTeam === Team.WHITE) {
        this._whiteComparison = payload.comparison
      } else {
        this._blackComparison = payload.comparison
      }
    }
    
    // Try to apply the move through normal resolve flow
    const result = this.gameState.resolve(payload.winningMove)
    
    if (result) {
      console.log('[ONLINE] Applied resolved move via gameState.resolve:', payload.winningMove, 'new turn:', this.gameState.currentTeam)
    } else {
      console.log('[ONLINE] resolve() returned null (phase:', this.gameState.phase, ') - turn already resolved by coordinator')
      
      // Phase is not LOCKED (already resolved by coordinator) - try to apply move directly to board
      try {
        this.gameState.board.move(payload.winningMove)
        console.log('[ONLINE] Applied move directly to board, new FEN:', this.gameState.fen)
      } catch (e) {
        console.log('[ONLINE] Could not apply move directly:', e)
      }
      
      // Sync turn with board - FEN position 7 indicates 'w' or 'b'
      const fenParts = this.gameState.fen.split(' ')
      const boardTurn = fenParts[1] === 'w' ? Team.WHITE : Team.BLACK
      if (this.gameState.currentTeam !== boardTurn) {
        this.gameState.setCurrentTeam(boardTurn)
        console.log('[ONLINE] Synced turn to match board:', boardTurn)
      }
    }
    
    // Ensure we're in correct phase for next turn
    this.startPendingTurn()
    
    // Reset turn state to selecting for next turn
    this.turnState = 'selecting'
    console.log('[STATE] Turn resolved, reset to selecting')
    
    // Resolve any turn change waiters
    if (this.resolveTurnChange) {
      this.resolveTurnChange()
      this.resolveTurnChange = null
    }
    
    console.log('[ONLINE] After handleTurnResolved - phase:', this.gameState.phase, 'turn:', this.gameState.currentTeam)
    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }
    this.notifyStateChange()
  }

  private canBroadcast(event: string): boolean {
    const now = Date.now()
    const last = this._broadcastThrottle.get(event) || 0
    if (now - last < this.BROADCAST_MIN_INTERVAL_MS) {
      console.warn(`[RATE-LIMIT] Broadcast throttled for event: ${event}`)
      return false
    }
    this._broadcastThrottle.set(event, now)
    return true
  }

  async broadcastMove(move: string, from: string, to: string): Promise<void> {
    if (!this._channel) return
    if (!this.canBroadcast('player_move')) return

    await this._channel.send({
      type: 'broadcast',
      event: 'player_move',
      payload: { playerId: this._playerId, move, from, to }
    })
  }

  async broadcastLocked(): Promise<void> {
    if (!this._channel) return
    if (!this.canBroadcast('player_locked')) return

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
    if (this.gameState.currentTeam === Team.WHITE) {
      const hadWhite = !!this._whiteComparison
      const hadBlack = !!this._blackComparison
      this._whiteComparison = null
      this._blackComparison = null
      this._lastMoveComparison = null
      console.log('[STATE-SYNC] New WHITE turn: resetting internal comparison refs (hadWhite:', hadWhite, 'hadBlack:', hadBlack, ')')
    }
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

  getAllPendingMoves(): Map<Player, PendingMoveInfo> {
    return this.gameState.getAllPendingMoves()
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
    
    if (currentTeam === Team.WHITE && !this.isCoordinator()) {
      console.log('[ONLINE] Not coordinator — waiting for coordinator broadcast')
      throw new Error('NOT_COORDINATOR')
    }
    
    this.turnState = 'resolving'
    console.log('[STATE] Resolving, set turnState to resolving')
    
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
          this._player1Id = player // Track player1 for this client
          console.log('[PLAYER1-ID] Set player1Id to:', player)
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
    
    const turnStartFen = this.gameState.fen
    
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

    const player1Accuracy = calculateAccuracy(player1Loss)
    const player2Accuracy = calculateAccuracy(player2Loss)
    const player1Category = getAccuracyCategory(player1Loss)
    const player2Category = getAccuracyCategory(player2Loss)

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

    // FIX: Store comparison for the correct team based on currentTeam
    console.log(`[RESULT] Storing comparison for team: ${currentTeam}`)
    if (currentTeam === Team.WHITE) {
      console.log(`[RESULT] Storing WHITE comparison:`, { player1Move, player2Move, isSync })
      this._whiteComparison = this._lastMoveComparison
    } else {
      console.log(`[RESULT] Storing BLACK comparison:`, { player1Move, player2Move, isSync })
      this._blackComparison = this._lastMoveComparison
    }

    // Set lastMove for board animation
    const moveParts = this.getMoveParts(winningMove, this.gameState.board.fen())
    if (moveParts) {
      this._lastMove = moveParts
    }

    this.gameState.resolve(winningMove)

    if (this._channel && this.canBroadcast('turn_resolved')) {
      await this._channel.send({
        type: 'broadcast',
        event: 'turn_resolved',
        payload: { 
          winningTeam: currentTeam, 
          winningMove,
          comparison: this._lastMoveComparison,
          coordinatorId: this._playerId
        }
      })
    }

    // Persist game state for recovery from refresh/OS kill
    if (this._room) {
      const fenBefore = this.gameState.getTurnStartFen() || this.gameState.fen
      saveGameState(this._room.id, this.gameState.fen, this.gameState.currentTeam, {
        team: currentTeam,
        move: winningMove,
        fen_before: fenBefore,
        fen_after: this.gameState.fen,
        timestamp: new Date().toISOString()
      }, this._status)
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