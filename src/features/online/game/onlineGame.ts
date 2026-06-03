import { Chess } from 'chess.js'
import { supabase, Room, RoomPlayer } from '../../../lib/supabase'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from '../../game-engine/gameState'
import { GameStatus, MoveComparison } from '../../offline/game/localGame'
import { ServerMoveEvaluator } from '../../bots/serverMoveEvaluator'
import { saveGameState, loadGameState } from '../../../lib/gamePersistence'
import { calculateAccuracy, getAccuracyCategory } from '../../shared/accuracy'
import type { RealtimeChannel } from '@supabase/supabase-js'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

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
  matchTimeRemaining?: number
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
  private _savedMoveHistory: Array<{ team: string; move: string }> = []

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
  private _pollingInterval: ReturnType<typeof setInterval> | null = null
  private _timerSyncInterval: ReturnType<typeof setInterval> | null = null
  private _timerCountdownInterval: ReturnType<typeof setInterval> | null = null
  private onAbandonCallback: (() => void) | null = null

  get savedMoveHistory(): Array<{ team: string; move: string }> {
    return this._savedMoveHistory
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
    if (this._gameOverResult) return this._gameOverResult
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
    if (this._gameOverReason) return this._gameOverReason
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
      return this._playerId === sorted[0]
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
    
    if (this._channel) {
      await supabase.removeChannel(this._channel)
      this._channel = null
    }
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval)
      this._pollingInterval = null
    }
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }

    this._room = room
    this._playerId = playerId
    this._team = team

    // Re-register in room_players on reconnect (ensures auth.uid() matches for RLS)
    try {
      const { error } = await supabase.from('room_players').upsert({
        room_id: room.id,
        player_id: playerId,
        team,
        slot: 0,
        status: 'ready'
      }, { onConflict: 'room_id,player_id' })
      if (error) {
        console.warn('[ONLINE] Failed to register in room_players:', error.message)
      } else {
        console.log('[ONLINE] Registered in room_players')
      }
    } catch (e) {
      console.warn('[ONLINE] Could not register in room_players:', e)
    }

    this._channel = supabase.channel(`room:${room.id}`, {
      config: {
        presence: { key: playerId }
      }
    })

    const setupListeners = () => {
      this._channel!
        .on('presence', { event: 'sync' }, () => {
          const state = this._channel?.presenceState() || {}
          const playersOnline = Object.keys(state)
          console.log('[ONLINE] Presence sync:', playersOnline)
          
          if (playersOnline.length >= 2) {
            if (this._status !== GameStatus.PLAYING) {
              this.startGameWhenReady()
            } else {
              this.syncGameState()
            }
          }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('[ONLINE] Player joined:', newPresences)
          const state = this._channel?.presenceState() || {}
          if (Object.keys(state).length >= 2 && this._status !== GameStatus.PLAYING) {
            this.startGameWhenReady()
          }
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
        .on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
          this.handleTimerSync(payload as { matchTimeRemaining: number })
        })
        .on('broadcast', { event: 'match_abandoned' }, ({ payload }) => {
          this.handleMatchAbandoned(payload as { playerId: string })
        })
        .on('broadcast', { event: 'match_timeout' }, ({ payload }) => {
          this.handleMatchTimeoutBroadcast(payload as { result: string; reason: string })
        })
    }

    setupListeners()

    this._channel.subscribe(async (status: string) => {
      console.log('[ONLINE] Channel subscription status:', status)
      if (status === 'CHANNEL_ERROR') {
        console.warn('[ONLINE] Channel error — removing channel and reconnecting...')
        try {
          supabase.removeChannel(this._channel!)
        } catch {}
        this._channel = supabase.channel(`room:${room.id}`, {
          config: { presence: { key: playerId } }
        })
        setupListeners()
        this._channel.subscribe(async (s: string) => {
          if (s === 'SUBSCRIBED') {
            await this._channel?.track({ player_id: playerId, team, status: 'connected' })
            console.log('[ONLINE] Player re-tracked after reconnect:', playerId)
            if (this._status === GameStatus.PLAYING) {
              await this.syncGameState()
            }
          }
        })
        return
      }
      if (status === 'SUBSCRIBED') {
        await this._channel?.track({
          player_id: playerId,
          team: team,
          status: 'connected'
        })
        console.log('[ONLINE] Player tracked:', playerId)
      }
    })

    // Fallback polling: if presence events are delayed, poll room_players directly.
    // Only counts REAL human players (bots are never in room_players table).
    // Exponential backoff: 3s → 5s → 8s → 12s → 12s... (max 60s budget)
    const MAX_BUDGET = 60000
    let elapsed = 0
    let delay = 3000

    const runPoll = async () => {
      if (this._status === GameStatus.PLAYING) {
        this._pollingInterval = null
        return
      }

      const existing = await loadGameState(this._room!.id)
      if (existing) {
        console.log('[ONLINE] Polling fallback: game already exists, syncing...')
        await this.syncGameState()
        this._pollingInterval = null
        return
      }

      const { data, error } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', this._room!.id)
      if (!error) {
        const humanPlayers = (data || []).filter(p => !p.player_id.startsWith('bot_'))
        if (humanPlayers.length >= 2) {
          console.log('[ONLINE] Polling fallback: game start triggered from DB')
          await this.startGameWhenReady()
          this._pollingInterval = null
          return
        }
      }

      elapsed += delay
      if (elapsed < MAX_BUDGET) {
        delay = Math.min(Math.floor(delay * 1.6), 12000)
        const timerId = setTimeout(runPoll, delay)
        this._pollingInterval = timerId as unknown as ReturnType<typeof setInterval>
      }
    }

    const timerId = setTimeout(runPoll, delay)
    this._pollingInterval = timerId as unknown as ReturnType<typeof setInterval>

    this._status = GameStatus.READY
    this.notifyStateChange()
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
      // Check if a game already exists for this room BEFORE creating fresh state
      // Retry up to 3 times with 1s delay — handles transient RLS/auth propagation delays
      let existing = null
      if (this._room) {
        for (let attempt = 0; attempt < 3; attempt++) {
          existing = await loadGameState(this._room.id)
          if (existing) break
          if (attempt < 2) {
            console.log(`[ONLINE] loadGameState returned null, retrying (${attempt + 1}/3)...`)
            await new Promise(r => setTimeout(r, 1000))
          }
        }
        if (existing) {
          console.log('[ONLINE] Game already exists in DB, syncing as late joiner (status:', existing.status, ')')
          // Create game state for sync to operate on — needed before broadcast
          // event handlers (handleTeammateMove etc.) can fire during DB queries
          this.gameState = new GameState(this._timeLimitSeconds)
          this._status = GameStatus.READY
          this.starting = false
          await this.syncGameState()
          return
        }
      }

      // No existing game — create fresh state and start new game
      this.gameState = new GameState(this._timeLimitSeconds)
      this._status = GameStatus.READY

      // Query room_players to get all human players in the room
      const { data: players } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', this._room!.id)
        .order('player_id', { ascending: true })

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
      // Must match IDs used in Game.tsx resolve flow: bot_opponent_1/2 for BLACK team
      for (let i = whiteHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_teammate_${i + 1}` as Player, Team.WHITE)
        } catch (e) {}
      }

      for (let i = blackHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_opponent_${i + 1}` as Player, Team.BLACK)
        } catch (e) {}
      }

      // Start the game
      this.gameState.startMatch()
      this._status = GameStatus.PLAYING
      this.startPendingTurn()
      this.notifyStateChange()
      console.log('[ONLINE] Game started successfully')
      console.log('[COORDINATOR] Role at game start:', { myId: this._playerId, isCoordinator: this.isCoordinator(), coordinatorId: this.getCoordinatorId() })
      
      // Persist initial game state with timer
      if (this._room) {
        const startedAt = new Date().toISOString()
        saveGameState(this._room.id, this.gameState.fen, this.gameState.currentTeam, null, this._status, startedAt, this._timeLimitSeconds)
      }
      
      this._timerSyncInterval = setInterval(() => this.broadcastTimerSync(), 5000)
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
      const whiteHumans = (players || []).filter(p => p.team === 'WHITE')
      const blackHumans = (players || []).filter(p => p.team === 'BLACK')

      // Remove any bot placeholders from teams so humans can fill their slots
      // (bots may have been added during startGameWhenReady before this human joined)
      const existingWhite = this.gameState.getPlayers(Team.WHITE)
      const existingBlack = this.gameState.getPlayers(Team.BLACK)
      for (const p of existingWhite) {
        if (p.startsWith('bot_')) {
          this.gameState.removePlayer(p, Team.WHITE)
        }
      }
      for (const p of existingBlack) {
        if (p.startsWith('bot_')) {
          this.gameState.removePlayer(p, Team.BLACK)
        }
      }

      for (const p of whiteHumans) {
        try {
          this.gameState.addPlayer(p.player_id as Player, Team.WHITE)
        } catch (e) {
          // Already exists or team full (shouldn't happen after bot removal)
        }
      }

      for (const p of blackHumans) {
        try {
          this.gameState.addPlayer(p.player_id as Player, Team.BLACK)
        } catch (e) {
          // Already exists or team full
        }
      }

      // Fill remaining slots with bots on both teams
      // Must match IDs used in Game.tsx resolve flow: bot_opponent_1/2 for BLACK team
      for (let i = whiteHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_teammate_${i + 1}` as Player, Team.WHITE)
        } catch (e) {}
      }
      for (let i = blackHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_opponent_${i + 1}` as Player, Team.BLACK)
        } catch (e) {}
      }

      console.log('[ONLINE] Game state synced successfully')

      // Recover game state from DB (survives refresh/OS kill)
      if (this._room) {
        const saved = await loadGameState(this._room.id)
        if (saved) {
          this._status = saved.status as GameStatus
          this.gameState.setCurrentTeam(saved.currentTurn === 'WHITE' ? Team.WHITE : Team.BLACK)
          
          // Restore match timer from persisted timestamps
          if (saved.matchStartedAt && saved.matchTimeLimitSeconds) {
            const startedAt = new Date(saved.matchStartedAt).getTime()
            const elapsed = Math.max(0, (Date.now() - startedAt) / 1000)
            const remaining = Math.max(0, saved.matchTimeLimitSeconds - elapsed)
            this.gameState.setMatchTimeRemaining(Math.floor(remaining))
            this.gameState.setMatchTimerActive(true)
            if (this.isCoordinator()) {
              this._timerSyncInterval = setInterval(() => this.broadcastTimerSync(), 5000)
              this.startMatchTimer()
            }
            console.log('[ONLINE] Restored match timer:', { 
              elapsed: Math.floor(elapsed), 
              remaining: Math.floor(remaining), 
              total: saved.matchTimeLimitSeconds 
            })
          }
          
          if (saved.moveHistory.length > 0) {
            console.log('[ONLINE] Replaying saved game state:', { moves: saved.moveHistory.length, fen: saved.fen.substring(0, 30) })
            // Store move history for UI reference (move playback panel)
            this._savedMoveHistory = saved.moveHistory.map((m: any) => ({
              team: m.team,
              move: m.move
            }))
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
            // Restore last move from board history
            try {
              const verboseHistory = this.gameState.board.history({ verbose: true }) as any[]
              if (verboseHistory.length > 0) {
                const lastHistoryMove = verboseHistory[verboseHistory.length - 1]
                this._lastMove = { from: lastHistoryMove.from, to: lastHistoryMove.to }
              }
            } catch {
              this._lastMove = null
            }
          } else {
            this.gameState.startMatch()
          }
          this.startPendingTurn()
          this.notifyStateChange()
        } else {
          console.warn('[ONLINE] syncGameState: no saved game found')
          this._status = GameStatus.PLAYING
          this.gameState.startMatch()
          this.startPendingTurn()
          this.notifyStateChange()
        }
      }
    } catch (e) {
      console.error('[ONLINE] Failed to sync game state:', e)
    }
  }

  private broadcastTimerSync(): void {
    if (!this._channel || !this.isCoordinator()) return
    const remaining = this.gameState.getMatchTimeRemaining()
    this._channel.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { matchTimeRemaining: remaining }
    })
  }

  private handleTimerSync(payload: { matchTimeRemaining: number }): void {
    if (payload.matchTimeRemaining !== undefined) {
      this.gameState.setMatchTimeRemaining(payload.matchTimeRemaining)
      this.notifyStateChange()
    }
  }

  private startMatchTimer(): void {
    if (!this.isCoordinator()) return
    this.gameState.setMatchTimerActive(true)
    if (this._timerCountdownInterval) {
      clearInterval(this._timerCountdownInterval)
    }
    this._timerCountdownInterval = setInterval(() => {
      const remaining = this.gameState.getMatchTimeRemaining()
      if (remaining <= 0) {
        this.stopMatchTimer()
        return
      }
      this.gameState.setMatchTimeRemaining(remaining - 1)
    }, 1000)
  }

  stopEngineTimer(): void {
    if (this._timerCountdownInterval) {
      clearInterval(this._timerCountdownInterval)
      this._timerCountdownInterval = null
    }
  }

  private stopMatchTimer(): void {
    if (this._timerCountdownInterval) {
      clearInterval(this._timerCountdownInterval)
      this._timerCountdownInterval = null
    }
    this.gameState.setMatchTimerActive(false)
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
        console.log('[STATE] Teammate locked, transitioning to resolving state')
        this.turnState = 'resolving'
        this.notifyStateChange()
        this.resolveTeammateLocked()
        this.resolveTeammateLocked = null
      }
      
      this.notifyStateChange()
    }
  }

  private handleTurnResolved(payload: { winningTeam: string; winningMove: string; comparison?: MoveComparison | null; coordinatorId?: string; matchTimeRemaining?: number }) {
    console.log('[TURN-RESOLVED] Received broadcast:', {
      winningTeam: payload.winningTeam,
      winningMove: payload.winningMove,
      hasComparison: !!payload.comparison,
      coordinatorId: payload.coordinatorId,
      matchTimeRemaining: payload.matchTimeRemaining,
      amCoordinator: this.isCoordinator(),
      myId: this._playerId,
      currentTurn: this.gameState.currentTeam,
      currentPhase: this.gameState.phase
    })

    const isOwnBroadcast = !!(payload.coordinatorId && payload.coordinatorId === this._playerId)
    if (isOwnBroadcast) {
      console.log('[TURN-RESOLVED] Own broadcast — skipping redundant resolve, running cleanup only')
    }
    
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
    
    if (!isOwnBroadcast) {
      // Always sync timer from coordinator (single source of truth)
      if (payload.matchTimeRemaining !== undefined) {
        this.gameState.setMatchTimeRemaining(payload.matchTimeRemaining)
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
    }
    
    // Ensure we're in correct phase for next turn
    this.startPendingTurn()
    
    // Resolve any turn change waiters
    if (this.resolveTurnChange) {
      this.resolveTurnChange()
      this.resolveTurnChange = null
    }
    
    console.log('[ONLINE] After handleTurnResolved - phase:', this.gameState.phase, 'turn:', this.gameState.currentTeam)
    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }
    this.turnState = 'selecting'
    this.notifyStateChange()
    console.log('[STATE] Turn resolved, reset to selecting')
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
    this.stopMatchTimer()
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    if (this._channel) {
      this._channel.send({
        type: 'broadcast',
        event: 'match_timeout',
        payload: { result, reason }
      })
    }
  }

  setGameOverResult(result: string): void {
    this._gameOverResult = result
  }

  setGameOverReason(reason: string): void {
    this._gameOverReason = reason
  }

  private _gameOverResult: string = ''
  private _gameOverReason: string = ''
  private _timeLimitSeconds: number

  constructor(timeLimitSeconds: number = 600) {
    this.gameState = new GameState(timeLimitSeconds)
    this._timeLimitSeconds = timeLimitSeconds
    this._status = GameStatus.WAITING
    console.log(`[OnlineGame] Using server evaluator: ${SERVER_URL}`)
    this.evaluator = SERVER_URL ? new ServerMoveEvaluator(SERVER_URL) : new ServerMoveEvaluator('')
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
      if (this.turnState !== 'resolving') {
        this.turnState = 'resolving'
        this.notifyStateChange()
      }
      throw new Error('NOT_COORDINATOR')
    }
    
    this.turnState = 'resolving'
    console.log('[STATE] Resolving, set turnState to resolving')
    this.notifyStateChange()
    
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
    
    // Checkmate short-circuit: skip Stockfish if either move is checkmate
    try {
      const mateCheck = new Chess(turnStartFen)
      mateCheck.move(player1Move)
      if (mateCheck.isCheckmate()) {
        this._lastMove = { from: player1From, to: player1To }
        this._lastMoveComparison = {
          player1Move, player2Move, player1Score: 10000, player2Score: 0,
          player1Accuracy: 100, player2Accuracy: 0,
          player1Loss: 0, player2Loss: 10000,
          player1Category: getAccuracyCategory(0), player2Category: getAccuracyCategory(10000),
          winningMove: player1Move, winningScore: 10000,
          isSync: false, bestEngineMove: player1Uci, bestEngineScore: 10000,
          turnStartFen, winnerId: 'player1', loserId: 'player2',
          loserFrom: player2From, loserTo: player2To,
          alternatives: [], youMatchedEngine: true, teammateMatchedEngine: false,
        }
        this.gameState.resolve(player1Move)
        if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
        this.notifyStateChange()
        return { winnerId: 'player1', winningMove: player1Move }
      }
    } catch {}
    
    try {
      const mateCheck2 = new Chess(turnStartFen)
      mateCheck2.move(player2Move)
      if (mateCheck2.isCheckmate()) {
        this._lastMove = { from: player2From, to: player2To }
        this._lastMoveComparison = {
          player1Move, player2Move, player1Score: 0, player2Score: 10000,
          player1Accuracy: 0, player2Accuracy: 100,
          player1Loss: 10000, player2Loss: 0,
          player1Category: getAccuracyCategory(10000), player2Category: getAccuracyCategory(0),
          winningMove: player2Move, winningScore: 10000,
          isSync: false, bestEngineMove: player2Uci, bestEngineScore: 10000,
          turnStartFen, winnerId: 'player2', loserId: 'player1',
          loserFrom: player1From, loserTo: player1To,
          alternatives: [], youMatchedEngine: false, teammateMatchedEngine: true,
        }
        this.gameState.resolve(player2Move)
        if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
        this.notifyStateChange()
        return { winnerId: 'player2', winningMove: player2Move }
      }
    } catch {}
    
    const chess = new Chess(turnStartFen)
    const verboseMoves = chess.moves({ verbose: true })

    const playerMoves = [player1Uci, player2Uci].filter(Boolean)
    const supplementalMoves = verboseMoves
      .map(m => m.from + m.to + (m.promotion || ''))
      .filter(uci => !playerMoves.includes(uci))
      .slice(0, 6 - playerMoves.length)
    const topMovesUci = [...playerMoves, ...supplementalMoves]

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
      loserTo,
      alternatives: evalResults.slice(0, 5).filter(r => r.move !== bestMoveUci),
      youMatchedEngine: player1Uci === bestMoveUci,
      teammateMatchedEngine: player2Uci === bestMoveUci,
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

    this.stats.movesPlayed++
    if (isSync) {
      this.stats.syncRate = ((this.stats.syncRate * (this.stats.movesPlayed - 1)) + 1) / this.stats.movesPlayed
    } else {
      this.stats.conflicts++
      this.stats.syncRate = (this.stats.syncRate * (this.stats.movesPlayed - 1)) / this.stats.movesPlayed
    }
    this.stats.player1Accuracy = ((this.stats.player1Accuracy * (this.stats.movesPlayed - 1)) + player1Accuracy) / this.stats.movesPlayed
    this.stats.player2Accuracy = ((this.stats.player2Accuracy * (this.stats.movesPlayed - 1)) + player2Accuracy) / this.stats.movesPlayed

    this.gameState.resolve(winningMove)

    if (this._channel && this.canBroadcast('turn_resolved')) {
      await this._channel.send({
        type: 'broadcast',
        event: 'turn_resolved',
        payload: { 
          winningTeam: currentTeam, 
          winningMove,
          comparison: this._lastMoveComparison,
          coordinatorId: this._playerId,
          matchTimeRemaining: this.gameState.getMatchTimeRemaining()
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
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    this.stopMatchTimer()
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval)
        this._pollingInterval = null
      }
      this.stopMatchTimer()
    }

    return { winnerId, winningMove }
  }

  async leaveRoom(): Promise<void> {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval)
      this._pollingInterval = null
    }
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    this.stopMatchTimer()
    if (this._channel) {
      await supabase.removeChannel(this._channel)
      this._channel = null
    }
    this._room = null
  }

  async abandonMatch(): Promise<void> {
    if (this._channel) {
      await this._channel.send({
        type: 'broadcast',
        event: 'match_abandoned',
        payload: { playerId: this._playerId }
      })
    }
    if (this._room) {
      await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', this._room.id)
    }
    await this.leaveRoom()
    this._status = GameStatus.GAME_OVER
    this.onAbandonCallback?.()
  }

  setOnAbandonCallback(callback: () => void): void {
    this.onAbandonCallback = callback
  }

  private handleMatchAbandoned(_payload: { playerId: string }): void {
    this._status = GameStatus.GAME_OVER
    this._gameOverResult = 'Match abandoned by teammate'
    this._gameOverReason = 'abandoned'
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval)
      this._pollingInterval = null
    }
    this.notifyStateChange()
  }

  private handleMatchTimeoutBroadcast(payload: { result: string; reason: string }): void {
    this._status = GameStatus.GAME_OVER
    this._gameOverResult = payload.result
    this._gameOverReason = payload.reason
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    this.stopMatchTimer()
    this.notifyStateChange()
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