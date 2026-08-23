import { Chess } from 'chess.js'
import { supabase, Room, RoomPlayer } from '../../../lib/supabase'
import { joinRoomByCode } from '@/lib/roomActions'
import { GameState, GamePhase, Team, Player, CapturedPieces, PendingMoveInfo } from '../../game-engine/gameState'
import { GameStatus, MoveComparison } from '../../shared/gameTypes'
import { createEvaluator, GameEvaluator } from '../../mobile-engine/evaluatorFactory'
import { saveGameState, loadGameState } from '../../../lib/gamePersistence'
import { calculateAccuracy, getAccuracyCategory } from '../../shared/accuracy'
import { CHECKMATE_SCORE } from '../../shared/gameConstants'
import { isMoveLegalAt } from '../../../lib/chessUtils'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { DEBUG } from '../../../lib/debug'
import { RealtimeService } from '@/lib/realtimeService'
import { realtimeMetrics } from '@/lib/realtimeMetrics'
import { emitTrace } from '@/features/shared/gameTrace'
import { traceDuo } from '@/lib/duoGameTrace'

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
  turnNumber?: number
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
  private _lastHumanResolution: MoveComparison | null = null
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
  private _turnChangeTimeout: ReturnType<typeof setTimeout> | null = null
  private _teammateLockTimeout: ReturnType<typeof setTimeout> | null = null
  private stats = {
    movesPlayed: 0,
    syncRate: 0,
    conflicts: 0,
    winningMoves: 0,
    player1Accuracy: 0,
    player2Accuracy: 0
  }
  private evaluator: GameEvaluator
  private _broadcastThrottle: Map<string, number> = new Map()
  private readonly BROADCAST_MIN_INTERVAL_MS = 500
  private readonly LOCK_TIMEOUT_MS = 15_000
  private _turnSequence = 0
  private _coordinatorId: string = ''
  // ADR-006 idempotent-resolution marker: the last turn_resolved actually
  // applied to the local board (by seq). Equal-seq duplicates of the same
  // winningMove are no-ops; different moves at equal seq are divergence.
  private _lastAppliedResolution: { turnSequence: number; winningMove: string } | null = null
  private _gameId: string = ''
  private _currentTurnNumber: number = 1
  private _submissionChannel: RealtimeChannel | null = null
  private _gameStatusChannel: RealtimeChannel | null = null
  private _pollingInterval: ReturnType<typeof setInterval> | null = null
  private _timerSyncInterval: ReturnType<typeof setInterval> | null = null
  private _timerCountdownInterval: ReturnType<typeof setInterval> | null = null
  private onAbandonCallback: (() => void) | null = null
  private _forceCreate = false
  private _lastActivityAt: number = Date.now()
  private _disconnectedSince: number | null = null
  private _disconnectCheckInterval: ReturnType<typeof setInterval> | null = null
  // Fast-start retry: when an event-driven trigger fires before the DB rows
  // are visible, startGameWhenReady() defers. Without a fast retry the lobby
  // waits for the next scheduled poll, which can be several seconds away and
  // accumulates toward the observed 10–15 s entry delay.
  private _fastStartTimer: ReturnType<typeof setTimeout> | null = null
  private _fastStartAttempts = 0
  private readonly MAX_FAST_START_ATTEMPTS = 12
  private readonly FAST_START_RETRY_MS = 250

  get savedMoveHistory(): Array<{ team: string; move: string }> {
    return this._savedMoveHistory
  }

  get disconnectedAgeMs(): number {
    if (!this._disconnectedSince) return 0
    return Date.now() - this._disconnectedSince
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
    if (this.gameState.currentTeam === Team.WHITE) {
      return this._blackComparison
    }
    return this._whiteComparison
  }

  get lastHumanResolution(): MoveComparison | null {
    return this._lastHumanResolution
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
    return this._playerId === this._coordinatorId && this._coordinatorId !== ''
  }

  getCoordinatorId(): string {
    return this._coordinatorId
  }

  private traceCtx() {
    return {
      roomId: this._room?.id,
      gameId: this._gameId || undefined,
      turnNumber: this._currentTurnNumber,
      playerId: this._playerId || undefined,
      team: this._team,
      color: this._team === 'BLACK' ? 'black' : 'white',
      coordinatorId: this._coordinatorId || undefined,
    }
  }

  /**
   * Structured [DUO:*] diagnostics (dev-gated, hashed user id — never secrets).
   */
  private duoLog(stage: Parameters<typeof traceDuo>[0], event: string, meta: Parameters<typeof traceDuo>[1] = {}) {
    traceDuo(stage, {
      ...this.traceCtx(),
      event,
      ...meta,
    })
  }

  getTeam(): 'WHITE' | 'BLACK' {
    return this._team
  }

  /**
   * Online color is determined by the team prop passed in `joinRoom`.
   * For Duo mode the host picks a color; the joiner auto-receives the opposite.
   */
  getPlayerColor(): 'white' | 'black' {
    return this._team === 'WHITE' ? 'white' : 'black'
  }

  /**
   * In online mode the human slot is the player's actual ID (not the synthetic
   * 'player1'..'player4' used by LocalGame). Consumers should check getPlayerTeam()
   * or compare against the player's real ID rather than relying on slot strings.
   * Returns an empty string here to keep the interface consistent — callers must
   * not use this for online games.
   */
  getHumanSlot(): string {
    return ''
  }

  /**
   * Teammate slot is not meaningful in online mode (teammate is a real human with
   * a UUID, not a slot string). Returns an empty string.
   */
  getTeammateSlot(): string {
    return ''
  }

  isFourPlayer(): boolean {
    return this._room?.mode === 'fourplayer'
  }

  getPlayerTeam(playerId: string): 'WHITE' | 'BLACK' | null {
    if (playerId.startsWith('bot_')) {
      if (this.gameState.getPlayers(Team.WHITE).includes(playerId as any)) return 'WHITE'
      if (this.gameState.getPlayers(Team.BLACK).includes(playerId as any)) return 'BLACK'
      return null
    }
    if (this.gameState.getPlayers(Team.WHITE).includes(playerId as any)) return 'WHITE'
    if (this.gameState.getPlayers(Team.BLACK).includes(playerId as any)) return 'BLACK'
    return null
  }

  private getMoveParts(move: string, fen: string): { from: string; to: string } | null {
    try {
      const chess = new Chess(fen)
      const moves = chess.moves({ verbose: true }) as Array<{ san: string; from: string; to: string }>
      const matchedMove = moves.find(m => m.san === move || m.san.replace(/[+#]/g, '') === move)
      if (matchedMove) {
        return { from: matchedMove.from, to: matchedMove.to }
      }
    } catch (e) {
      DEBUG && console.error('[OnlineGame] getMoveParts error:', e)
      return null
    }
    return null
  }

  get pendingOverlay(): { from: string; to: string; piece: string; color: string } | null {
    // Always show teammate's pending move if it exists
    const allMoves = this.gameState.getAllPendingMoves()
    DEBUG && console.log('[PENDING] allMoves:', Array.from(allMoves.entries()), 'myId:', this._playerId)
    for (const [player, pending] of allMoves) {
      if (player !== this._playerId) {
        DEBUG && console.log('[PENDING] Found teammate move:', player, pending)
        
        // Determine piece from board position if not known
        let piece = pending.piece
        if (!piece || piece === 'unknown') {
          try {
            const boardPiece = this.gameState.board.get(pending.from as any)
            piece = boardPiece?.type || 'p'
          } catch (e) {
            DEBUG && console.error('[OnlineGame] Failed to get board piece:', e)
            piece = 'p'
          }
        }
        
        return { from: pending.from, to: pending.to, piece, color: this.gameState.currentTeam === Team.WHITE ? 'white' : 'black' }
      }
    }
    return null
  }

  // Event-based waiting with engine-level timeout (R3 fix)
  waitForTeammateLock(): Promise<void> {
    DEBUG && console.log('[STATE] waitForTeammateLock called, current state:', this.turnState)
    return new Promise((resolve) => {
      // If already in locked state (teammate locked before we started waiting), resolve immediately
      if (this.turnState === 'locked') {
        DEBUG && console.log('[STATE] Already locked, resolving immediately')
        resolve()
        return
      }
      // If teammate already locked, transition to locked and resolve
      if (this.gameState.isPendingMoveLocked(this.getOtherPlayerId() as Player)) {
        DEBUG && console.log('[STATE] Teammate already locked, transitioning to locked')
        this.turnState = 'locked'
        resolve()
        return
      }
      // Set up the event-based resolution
      this.resolveTeammateLocked = resolve
      // Engine-level timeout: if the teammate's lock signal is lost (missed
      // postgres_changes INSERT or dead channel), don't hang forever (R3).
      // On timeout we re-fetch the current turn's submissions from the
      // authoritative DB before resolving the waiter — if the teammate's row
      // landed but the realtime event was missed, the turn proceeds normally.
      this._teammateLockTimeout = setTimeout(async () => {
        DEBUG && console.warn('[STATE] Teammate lock timeout — checking state: turnState=', this.turnState, 'currentTeam=', this.gameState.currentTeam)
        this.duoLog('MOVE', 'TEAMMATE_LOCK_TIMEOUT', { turnState: this.turnState })

        try {
          await this.restoreCurrentTurnSubmissions()
        } catch (e) {
          console.error('[ONLINE] Teammate lock timeout recovery failed:', e)
        }

        // If handleTurnResolved already processed the resolution out-of-band,
        // turnState would be 'selecting' and currentTeam would have changed.
        // In that case, resolve cleanly without further state transitions —
        // executeMove will detect the turn change and return gracefully.
        if (this.turnState === 'selecting') {
          DEBUG && console.warn('[STATE] Teammate lock timeout — turn already resolved, resolving cleanly')
        }
        if (this.resolveTeammateLocked) {
          this.resolveTeammateLocked()
          this.resolveTeammateLocked = null
        }
        this._teammateLockTimeout = null
      }, this.LOCK_TIMEOUT_MS)
    })
  }

  // Wait for turn to change (used by non-coordinator)
  waitForTurnChange(): Promise<void> {
    DEBUG && console.log('[STATE] waitForTurnChange called')
    return new Promise((resolve) => {
      this.resolveTurnChange = resolve
      // Timeout: if the coordinator's turn_resolved broadcast is lost, recover
      // from the authoritative DB instead of leaving the client locked forever.
      this._turnChangeTimeout = setTimeout(async () => {
        if (this.resolveTurnChange) {
          DEBUG && console.warn('[STATE] Turn change timeout — forcing recovery')
          this.duoLog('MOVE', 'TURN_CHANGE_TIMEOUT', { turnState: this.turnState })
          try {
            await this.syncGameState()
          } catch (e) {
            console.error('[ONLINE] Turn change timeout recovery failed:', e)
          }
          this.resolveTurnChange()
          this.resolveTurnChange = null
        }
        this._turnChangeTimeout = null
      }, 30000)
    })
  }

  setTurnState(state: 'selecting' | 'waiting_for_teammate' | 'locked' | 'resolving') {
    DEBUG && console.log('[STATE] setTurnState:', this.turnState, '->', state)
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
    DEBUG && console.log('[ONLINE] joinRoom called:', { roomId: room.id, playerId, team })
    this.duoLog('ROOM', 'JOIN_STARTED', { playerId, team })
    
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
    if (this._fastStartTimer) {
      clearTimeout(this._fastStartTimer)
      this._fastStartTimer = null
    }
    this._fastStartAttempts = 0

    this._room = room
    this._playerId = playerId
    this._team = team

    // Start channel setup concurrently with DB upsert below
    // (subscribe is callback-based/non-blocking — both run in parallel)
    realtimeMetrics.onChannelCreated(`room:${room.id}`)
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
          const sortedIds = [...playersOnline].sort()
          DEBUG && console.log('[ONLINE] Presence sync — players online:', playersOnline.length, playersOnline, 'status:', this._status, 'detail:', JSON.stringify(state))
          this.duoLog('REALTIME', 'PRESENCE_SYNC', { present: playersOnline.length, status: this._status })

          if (playersOnline.length >= 2) {
            emitTrace('ROOM_FILLED', { ...this.traceCtx(), extra: { present: playersOnline.length } })
            if (this._status !== GameStatus.PLAYING) {
              if (this._playerId === sortedIds[0]) {
                DEBUG && console.log('[ONLINE] 🔥 Triggering startGameWhenReady via PRESENCE SYNC')
                this.attemptStartGameWhenReady()
              }
            } else if (this.isCoordinator()) {
              // Coordinator already started the game but a joiner may have
              // missed the original game_started broadcast (subscribe race).
              // Re-broadcast so late joiners sync without waiting for poll.
              this.duoLog('REALTIME', 'REBROADCAST_GAME_STARTED', { reason: 'presence_sync' })
              this._channel?.send({ type: 'broadcast', event: 'game_started', payload: {} })
            }
            // During active play, state is already current via broadcasts —
            // do not re-sync from DB (would race with un-awaited DB writes
            // and clobber pending moves/comparisons/board FEN).
          }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          DEBUG && console.log('[ONLINE] Presence join — new:', newPresences?.length)
          const state = this._channel?.presenceState() || {}
          const playersOnline = Object.keys(state)
          const sortedIds = [...playersOnline].sort()
          DEBUG && console.log('[ONLINE] Presence join — players online:', playersOnline.length, 'status:', this._status)
          this.duoLog('REALTIME', 'PRESENCE_JOIN', { present: playersOnline.length, status: this._status })
          if (playersOnline.length >= 2 && this._status !== GameStatus.PLAYING) {
            if (this._playerId === sortedIds[0]) {
              DEBUG && console.log('[ONLINE] 🔥 Triggering startGameWhenReady via PRESENCE JOIN')
              this.attemptStartGameWhenReady()
            }
          } else if (playersOnline.length >= 2 && this._status === GameStatus.PLAYING && this.isCoordinator()) {
            // Jet-lag join after the game already started: re-broadcast so the
            // newly present player syncs from the persisted game row.
            this.duoLog('REALTIME', 'REBROADCAST_GAME_STARTED', { reason: 'presence_join' })
            this._channel?.send({ type: 'broadcast', event: 'game_started', payload: {} })
          }
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          DEBUG && console.log('[ONLINE] Presence leave —', leftPresences?.length, 'players left:', leftPresences?.map((p: { presence_ref?: string; player_id?: string }) => p.player_id || p.presence_ref))
          this.duoLog('REALTIME', 'PRESENCE_LEAVE', { left: leftPresences?.length })
          if (this._status !== GameStatus.PLAYING) return
          if (!this._disconnectedSince) {
            this._disconnectedSince = Date.now()
          }
        })
        .on('presence', { event: 'join' }, () => {
          if (this._status === GameStatus.PLAYING && this._disconnectedSince) {
            this._disconnectedSince = null
            this._lastActivityAt = Date.now()
          }
        })
        .on('broadcast', { event: 'player_move' }, ({ payload }) => {
          this._lastActivityAt = Date.now()
          this.handleTeammateMove(payload as MovePayload)
        })
        .on('broadcast', { event: 'player_locked' }, ({ payload }) => {
          this._lastActivityAt = Date.now()
          this.handleTeammateLocked(payload as LockedPayload)
        })
        .on('broadcast', { event: 'turn_resolved' }, ({ payload }) => {
          this._lastActivityAt = Date.now()
          this.handleTurnResolved(payload as ResolvedPayload)
        })
        .on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
          this._lastActivityAt = Date.now()
          this.handleTimerSync(payload as { matchTimeRemaining: number })
        })
        .on('broadcast', { event: 'match_abandoned' }, ({ payload }) => {
          this.handleMatchAbandoned(payload as { playerId: string; team?: 'WHITE' | 'BLACK' })
        })
        .on('broadcast', { event: 'match_timeout' }, ({ payload }) => {
          this.handleMatchTimeoutBroadcast(payload as { result: string; reason: string })
        })
        .on('broadcast', { event: 'game_started' }, () => {
          DEBUG && console.log('[ONLINE] Received game_started broadcast — syncing...')
          this.duoLog('REALTIME', 'GAME_STARTED_RECEIVED', { status: this._status })
          if (this._status !== GameStatus.PLAYING) {
            this.syncGameState().catch(e => {
              console.error('[ONLINE] game_started syncGameState failed:', e)
              // The fallback poll continues to re-check the games row, so a
              // transient failure here is recovered by the next poll.
            })
          }
        })
    }

    setupListeners()

    this._channel!.subscribe(async (status: string) => {
      realtimeMetrics.onSubscribeStatus(`room:${room.id}`, status)
      DEBUG && console.log('[ONLINE] Channel subscription status:', status)
      this.duoLog('REALTIME', 'CHANNEL_STATUS', { status })
      if (status === 'CHANNEL_ERROR') {
        DEBUG && console.warn('[ONLINE] Channel error — removing channel and reconnecting...')
        this.duoLog('REALTIME', 'CHANNEL_ERROR_RECONNECTING', {})
        try {
          await supabase.removeChannel(this._channel!)
        } catch (e) { DEBUG && console.error('[OnlineGame] Failed to remove channel:', e) }
        // Force-tear-down any stale channel with the same topic. When the socket
        // is dead, removeChannel's unsubscribe() can time out and leave the old
        // channel registered; re-creating the topic would reuse it and make the
        // `.on(...)` calls below throw.
        RealtimeService.forceRemoveStaleChannels(`room:${room.id}`)
        realtimeMetrics.onChannelCreated(`room:${room.id}`)
        this._channel = supabase.channel(`room:${room.id}`, {
          config: { presence: { key: playerId } }
        })
        setupListeners()
        this._channel!.subscribe(async (s: string) => {
          realtimeMetrics.onSubscribeStatus(`room:${room.id}`, s)
          this.duoLog('REALTIME', 'CHANNEL_RECONNECT_STATUS', { status: s })
          if (s === 'SUBSCRIBED') {
            realtimeMetrics.onReconnectSuccess(`room:${room.id}`)
            await this._channel?.track({ player_id: playerId, team: this._team, status: 'connected' })
            DEBUG && console.log('[ONLINE] Player re-tracked after reconnect:', playerId)
            if (this._status === GameStatus.PLAYING) {
              await this.syncGameState().catch((e) => console.error('[ONLINE] Reconnect sync failed:', e))
            }
          }
        })
        return
      }
      if (status === 'SUBSCRIBED') {
        await this._channel?.track({
          player_id: playerId,
          team: this._team,
          status: 'connected'
        })
        DEBUG && console.log('[ONLINE] Player tracked:', playerId)
      }
    })

    // Register/refresh membership via the atomic join RPC. The RPC identifies
    // the caller via auth.uid(), locks the room, and returns the authoritative
    // team/slot — the client-supplied team argument is never trusted for
    // assignment. It is idempotent: the caller is already a member when it
    // reaches the game (host create, home-page join, or deep-link join all
    // establish membership), so this returns the existing assignment.
    try {
      if (this._room?.code) {
        const joined = await joinRoomByCode(this._room.code)
        const authoritativeTeam = joined.team
        if (authoritativeTeam && authoritativeTeam !== this._team) {
          this._team = authoritativeTeam
          // Re-track presence so the authoritative team is visible to peers.
          this._channel?.track({ player_id: playerId, team: this._team, status: 'connected' })
        }
        DEBUG && console.log('[ONLINE] Registered via join RPC —', playerId, 'team:', this._team, 'slot:', joined.slot, 'room:', this._room.id)
      } else {
        console.warn('[ONLINE] No room code available for join RPC — skipping DB registration')
      }
    } catch (e) {
      // Non-fatal: the caller is already a member (join established upstream)
      // and presence carries the team, so a failure here must not block entry.
      console.warn('[ONLINE] Join RPC registration failed (non-fatal):', e)
    }

    // After our own DB row is written, immediately attempt to start. In the
    // common case the other player is already present in the channel and their
    // DB row is visible, so this fires the game without waiting for the
    // fallback polling loop.
    const presenceState = this._channel?.presenceState() || {}
    const presentIds = Object.keys(presenceState).sort()
    if (this._playerId === presentIds[0]) {
      DEBUG && console.log('[ONLINE] 🔥 Triggering startGameWhenReady immediately after own upsert')
      this.attemptStartGameWhenReady()
    }

    // Fallback polling: if presence events are delayed, poll room_players directly.
    // Only counts REAL human players (bots are never in room_players table).
    // Only the alphabetically-first present player triggers the start.
    // Exponential backoff: 0.5s → 0.9s → 1.6s → 2.9s → 5.2s → 8s... The budget
    // must cover the lobby lifetime (60s) — a 15s budget let the lobby time out
    // while the joiner's room_players row was still being committed.
    const MAX_BUDGET = 55000
    let elapsed = 0
    let delay = 500

    const runPoll = async () => {
      if (this._status === GameStatus.PLAYING || this._status === GameStatus.GAME_OVER) {
        this._pollingInterval = null
        return
      }

      DEBUG && console.log('[ONLINE] Fallback poll running — elapsed:', elapsed, 'ms, status:', this._status)

      // A missed `game_started` broadcast must not strand the joiner in the
      // lobby: the poll re-checks the authoritative games row until PLAYING.
      // On any transient failure we keep polling instead of dying silently.
      try {
        const existing = await loadGameState(this._room!.id)
        if (existing) {
          DEBUG && console.log('[ONLINE] Polling fallback: game already exists, syncing...')
          await this.syncGameState()
          const statusNow = this._status as GameStatus
          if (statusNow === GameStatus.PLAYING || statusNow === GameStatus.GAME_OVER) {
            this._pollingInterval = null
            return
          }
        }

        let humanCount = 0
        let roster: Array<{ player_id: string; team: string }> = []
        const { data, error } = await supabase.rpc('get_room_players', { p_room_id: this._room!.id })
        if (!error && data) {
          const players = data as Array<{ player_id: string; team: string }>
          roster = players
          humanCount = players.filter(p => !p.player_id.startsWith('bot_')).length
          DEBUG && console.log(`[ONLINE] Poll found ${humanCount} human(s) via RPC`, JSON.stringify(players))
        } else {
          console.warn('[ONLINE] Poll RPC failed:', error?.message || error)
        }

        // If RPC only found 1, fall back to direct query (may also hit RLS but worth trying)
        if (humanCount < 2) {
          const { data: fallbackData, error: fallbackErr } = await supabase
            .from('room_players')
            .select('player_id, team')
            .eq('room_id', this._room!.id)
          if (!fallbackErr && fallbackData) {
            const fbPlayers = fallbackData as Array<{ player_id: string; team: string }>
            const fbCount = fbPlayers.filter(p => !p.player_id.startsWith('bot_')).length
            DEBUG && console.log(`[ONLINE] Poll fallback direct query found ${fbCount} human(s)`, JSON.stringify(fbPlayers))
            if (fbCount > humanCount) {
              humanCount = fbCount
              roster = fbPlayers
            }
          } else {
            console.warn('[ONLINE] Poll direct query fallback failed:', fallbackErr?.message)
          }
        }

        const minHumans = this.isFourPlayer() ? 4 : 2
        if (humanCount >= minHumans) {
          // Only the authoritative coordinator (alphabetically-first non-bot DB
          // member) starts the game. DB-based so it is identical on both clients
          // even when presence has not fully propagated (presence is a supplement,
          // not the source of truth).
          const dbCoordinatorId = roster
            .filter(p => !p.player_id.startsWith('bot_'))
            .map(p => p.player_id)
            .sort()[0] || ''
          DEBUG && console.log('[ONLINE][DIAG] poll ready — humanCount:', humanCount, 'dbCoordinatorId:', dbCoordinatorId, 'selfId:', this._playerId, 'isCoordinator:', this._playerId === dbCoordinatorId)
          if (this._playerId === dbCoordinatorId) {
            DEBUG && console.log('[ONLINE] 🔥 Triggering startGameWhenReady via FALLBACK POLL')
            await this.attemptStartGameWhenReady()
          }
          // Do NOT stop polling on the non-coordinator: the only signal that the
          // game started is the game_started broadcast (fallible). If it was
          // missed, the next poll re-reads the games row and syncs.
          const statusAfterStart = this._status as GameStatus
          if (statusAfterStart === GameStatus.PLAYING || statusAfterStart === GameStatus.GAME_OVER) {
            this._pollingInterval = null
            return
          }
        }
      } catch (e) {
        console.error('[ONLINE] Fallback poll iteration failed — will retry:', e)
      }

      elapsed += delay
      if (elapsed < MAX_BUDGET) {
        delay = Math.min(Math.floor(delay * 1.8), 8000)
        const timerId = setTimeout(runPoll, delay)
        this._pollingInterval = timerId as unknown as ReturnType<typeof setInterval>
      } else {
        this._pollingInterval = null
      }
    }

    const timerId = setTimeout(runPoll, delay)
    this._pollingInterval = timerId as unknown as ReturnType<typeof setInterval>

    this._status = GameStatus.READY
    this.notifyStateChange()
    DEBUG && console.log('[ONLINE] joinRoom completed, status:', this._status)
    this.duoLog('ROOM', 'JOIN_COMPLETE', { status: this._status })
  }

  /**
   * Event-driven start with fast retry. When presence fires before the
   * opponent's room_players row is visible, startGameWhenReady() defers.
   * Without a fast retry the lobby waits for the next scheduled poll,
   * which is the dominant contributor to the observed 10–15 s entry delay.
   */
  private async attemptStartGameWhenReady(): Promise<void> {
    if (this._status === GameStatus.PLAYING) return
    if (this.starting) return

    await this.startGameWhenReady()

    // _status may have been set to PLAYING inside startGameWhenReady.
    const statusAfterStart = this._status as GameStatus
    if (statusAfterStart === GameStatus.PLAYING) return

    if (this._fastStartAttempts < this.MAX_FAST_START_ATTEMPTS) {
      this._fastStartAttempts++
      DEBUG && console.log('[ONLINE] startGameWhenReady deferred — fast retry', this._fastStartAttempts, 'in', this.FAST_START_RETRY_MS, 'ms')
      this._fastStartTimer = setTimeout(() => this.attemptStartGameWhenReady(), this.FAST_START_RETRY_MS)
    } else {
      DEBUG && console.log('[ONLINE] startGameWhenReady deferred — fast retries exhausted, leaving fallback polling')
    }
  }

  async startGameWhenReady(): Promise<void> {
    DEBUG && console.log('[ONLINE] startGameWhenReady called — status:', this._status, 'starting:', this.starting)
    if (this._status === GameStatus.PLAYING) {
      DEBUG && console.log('[ONLINE] Game already started, skipping...')
      return
    }
    
    if (this.starting) {
      DEBUG && console.log('[ONLINE] Game start already in progress, skipping...')
      return
    }
    
    this.starting = true

    try {
      // Check if a game already exists (single check — no more race condition
      // since only the coordinator calls startGameWhenReady)
      let existing: any = null
      if (this._room) {
        existing = await loadGameState(this._room.id)
        if (existing) {
          DEBUG && console.log('[ONLINE] Game already exists in DB, syncing as late joiner (status:', existing.status, ')')
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

      // Roster: authoritative DB members (the atomic join RPC guarantees both
      // players are committed room_players rows before a client reaches /game)
      // merged with realtime presence (team backfill + liveness signal). The DB
      // is the source of truth for membership; presence must not gate the start.
      const presenceState = this._channel?.presenceState() || {}
      const presenceRoster = new Map<string, { player_id: string; team: 'WHITE' | 'BLACK' }>()
      for (const [key, val] of Object.entries(presenceState)) {
        const meta = (val || {}) as { player_id?: string; team?: 'WHITE' | 'BLACK' }
        const pid = meta.player_id || key
        if (pid && !pid.startsWith('bot_')) {
          // Team priority: presence metadata → self team → room host_team.
          const team = meta.team || (pid === this._playerId ? this._team : (this._room?.host_team as 'WHITE' | 'BLACK' | undefined))
          if (team) presenceRoster.set(pid, { player_id: pid, team })
        }
      }
      DEBUG && console.log('[ONLINE] Presence roster:', Array.from(presenceRoster.entries()))

      // Authoritative roster from room_players (membership is guaranteed by the
      // atomic join RPC before a client enters /game).
      const { data: players } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', this._room!.id)
        .order('player_id', { ascending: true })
      DEBUG && console.log('[ONLINE] startGameWhenReady — room_players query returned:', players?.length, 'rows', JSON.stringify(players?.map(p => ({ player_id: p.player_id, team: p.team, status: p.status }))))

      // Merge teams: DB rows win (persistent + authoritative), presence
      // backfills any human whose row is not yet committed.
      const rosterTeams = new Map<string, 'WHITE' | 'BLACK'>()
      for (const p of players || []) {
        if (!p.player_id.startsWith('bot_')) rosterTeams.set(p.player_id, p.team as 'WHITE' | 'BLACK')
      }
      for (const [pid, meta] of presenceRoster) {
        if (!rosterTeams.has(pid)) rosterTeams.set(pid, meta.team)
      }
      DEBUG && console.log('[ONLINE] Merged roster teams:', Array.from(rosterTeams.entries()))

      // Diagnostic: surface the exact readiness state so a single debug run
      // identifies whether presence or the authoritative DB roster is short.
      DEBUG && console.log('[ONLINE][DIAG] start readiness — presenceIds:', Array.from(presenceRoster.keys()), 'dbRows:', players?.map((p: { player_id: string }) => p.player_id), 'selfId:', this._playerId)

      // Readiness: authoritative DB membership. Presence is a supplement, NOT
      // the sole source of truth — a DB-confirmed member who is still arriving
      // in /game will sync via the game_started broadcast, so we must not
      // defer forever just because presence metadata has not propagated.
      const requiredHumans = this.isFourPlayer() ? 4 : 2
      const allHumans = Array.from(rosterTeams.keys())
      if (allHumans.length < requiredHumans) {
        DEBUG && console.log(`[ONLINE] Not enough humans with a known team: ${allHumans.length}/${requiredHumans} — deferring start`)
        this.duoLog('GAME', 'START_DEFERRED', { humans: allHumans.length, required: requiredHumans })
        this.starting = false
        return
      }

      // Only the authoritative coordinator (alphabetically-first non-bot member
      // of the room) creates the game. DB-based so it is identical on both
      // clients even when presence shows only self; the non-coordinator defers
      // and syncs via the game_started broadcast.
      const dbCoordinatorId = [...allHumans].sort()[0] || ''
      if (this._playerId !== dbCoordinatorId) {
        DEBUG && console.log(`[ONLINE] Not coordinator (coordinator: ${dbCoordinatorId}, self: ${this._playerId}) — deferring start`)
        this.duoLog('GAME', 'START_DEFERRED', { reason: 'not_coordinator', coordinatorId: dbCoordinatorId })
        this.starting = false
        return
      }

      const whiteHumans = allHumans.filter(p => rosterTeams.get(p) === 'WHITE')
      const blackHumans = allHumans.filter(p => rosterTeams.get(p) === 'BLACK')

      for (const p of whiteHumans) {
        try {
          this.gameState.addPlayer(p as Player, Team.WHITE)
        } catch (e) {
          DEBUG && console.log('[ONLINE] Player already exists or team full:', e)
        }
      }

      for (const p of blackHumans) {
        try {
          this.gameState.addPlayer(p as Player, Team.BLACK)
        } catch (e) {
          DEBUG && console.log('[ONLINE] Player already exists or team full:', e)
        }
      }

      // Fill remaining slots with bots (up to 2 per team)
      // Must match IDs used in Game.tsx resolve flow: bot_opponent_1/2 for BLACK team
      for (let i = whiteHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_teammate_${i + 1}` as Player, Team.WHITE)
        } catch (e) { DEBUG && console.error('[OnlineGame] Failed to add bot_teammate to WHITE:', e) }
      }

      for (let i = blackHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_opponent_${i + 1}` as Player, Team.BLACK)
        } catch (e) { DEBUG && console.error('[OnlineGame] Failed to add bot_opponent to BLACK:', e) }
      }

      // Start the game
      this.gameState.startMatch()
      this._status = GameStatus.PLAYING
      if (this._fastStartTimer) {
        clearTimeout(this._fastStartTimer)
        this._fastStartTimer = null
      }

      // Compute coordinator: alphabetically-first non-bot player
      // Stored once at game creation, never recomputed
      const allPlayerIds = [...this.gameState.getPlayers(Team.WHITE), ...this.gameState.getPlayers(Team.BLACK)]
      this._coordinatorId = [...allPlayerIds].sort().find(p => !p.startsWith('bot_')) || ''

      emitTrace('SIDES_ASSIGNED', {
        ...this.traceCtx(),
        team: 'WHITE',
        extra: {
          white: this.gameState.getPlayers(Team.WHITE),
          black: this.gameState.getPlayers(Team.BLACK),
        },
      })
      emitTrace('COORDINATOR_ASSIGNED', { ...this.traceCtx(), coordinatorId: this._coordinatorId })
      emitTrace('GAME_STARTED', { ...this.traceCtx(), turnNumber: this._currentTurnNumber })

      this.startPendingTurn()
      this.notifyStateChange()
      DEBUG && console.log('[CHESSDUO-BOT-TRACE] GAME_START', JSON.stringify({
        roomId: this._room?.id,
        status: this._status,
        currentTurn: this.gameState.currentTeam,
        whitePlayers: this.gameState.getPlayers(Team.WHITE),
        blackPlayers: this.gameState.getPlayers(Team.BLACK),
        whiteIsBot: this.gameState.getPlayers(Team.WHITE).map(p => p.startsWith('bot_')),
        blackIsBot: this.gameState.getPlayers(Team.BLACK).map(p => p.startsWith('bot_')),
        coordinatorId: this._coordinatorId,
        myId: this._playerId,
        amCoordinator: this.isCoordinator(),
        turnNumber: this._currentTurnNumber,
      }))
      DEBUG && console.log('[ONLINE] ✅ Game started successfully — status:', this._status)
      DEBUG && console.log('[COORDINATOR] Assigned:', { coordinatorId: this._coordinatorId, myId: this._playerId, amCoordinator: this.isCoordinator() })
      this.duoLog('GAME', 'STARTED', { coordinatorId: this._coordinatorId })
      
      // Persist initial game state with timer — use INSERT ... RETURNING id
      // as authoritative gameId (avoids separate SELECT visibility race).
      if (this._room) {
        const startedAt = new Date().toISOString()
        const createdGameId = await saveGameState(this._room.id, this.gameState.fen, this.gameState.currentTeam, null, this._status, startedAt, this._timeLimitSeconds, 0, this._coordinatorId)
        if (createdGameId) {
          this._gameId = createdGameId
          this._currentTurnNumber = 1
          this.subscribeToSubmissions()
          this.subscribeToGameStatus()
          this.duoLog('GAME', 'GAME_CREATED', { gameId: this._gameId })
          DEBUG && console.log('[ONLINE] Game ID stored from RETURNING:', this._gameId)
        } else {
          // Fallback: loadGameState retry (handles case where upsert did not
          // return id due to row already existing from concurrent coordinator).
          let saved: Awaited<ReturnType<typeof loadGameState>> = null
          for (let attempt = 0; attempt < 3 && !saved?.gameId; attempt++) {
            saved = await loadGameState(this._room.id)
            if (!saved?.gameId && attempt < 2) {
              await new Promise(resolve => setTimeout(resolve, 200))
            }
          }
          if (saved?.gameId) {
            this._gameId = saved.gameId
            this._currentTurnNumber = saved.turnNumber ? saved.turnNumber + 1 : 1
            this.subscribeToSubmissions()
            this.subscribeToGameStatus()
            DEBUG && console.log('[ONLINE] Game ID stored via fallback read:', this._gameId)
          } else {
            console.warn('[ONLINE] ❌ Could not read back game row after creation — _gameId is empty, submissions will use broadcast fallback')
            this.duoLog('GAME', 'GAME_ID_READBACK_FAILED', {})
          }
        }
        // Broadcast game_started AFTER _gameId is known so non-coordinator can
        // sync without polling and submissions are immediately valid.
        emitTrace('REALTIME_BROADCAST', { ...this.traceCtx(), extra: { event: 'game_started', gameId: this._gameId || undefined } })
        this._channel?.send({ type: 'broadcast', event: 'game_started', payload: { gameId: this._gameId || undefined } })
        this.duoLog('REALTIME', 'GAME_STARTED_SENT', {})
      }
      
      this._timerSyncInterval = setInterval(() => this.broadcastTimerSync(), 5000)
      this._disconnectCheckInterval = setInterval(() => {
        if (this._status !== GameStatus.PLAYING) return
        if (!this._disconnectedSince) return
        if (Date.now() - this._disconnectedSince > 35000) {
          this.abandonMatch()
        }
      }, 1000)
    } catch (e) {
      console.error('[ONLINE] ❌ Failed to start game:', e)
      this.duoLog('GAME', 'START_FAILED', { errorMessage: String((e as Error)?.message || e) })
      // Roll back to READY so the fast-retry loop / fallback poll can re-attempt.
      // Without this, a failed initial persist leaves _status = PLAYING and the
      // retry guards (`if (status === PLAYING) return`) would never re-run.
      this._status = GameStatus.READY
    } finally {
      this.starting = false
    }
  }

  private async syncGameState(): Promise<boolean> {
    DEBUG && console.log('[ONLINE] Syncing game state (late joiner)...')
    this.duoLog('GAME', 'SYNC_STARTED', {})
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
          DEBUG && console.error('[OnlineGame] Failed to add white human during sync:', e)
        }
      }

      for (const p of blackHumans) {
        try {
          this.gameState.addPlayer(p.player_id as Player, Team.BLACK)
        } catch (e) {
          DEBUG && console.error('[OnlineGame] Failed to add black human during sync:', e)
        }
      }

      // Fill remaining slots with bots on both teams
      // Must match IDs used in Game.tsx resolve flow: bot_opponent_1/2 for BLACK team
      for (let i = whiteHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_teammate_${i + 1}` as Player, Team.WHITE)
        } catch (e) { DEBUG && console.error('[OnlineGame] Failed to add bot_teammate to WHITE during sync:', e) }
      }
      for (let i = blackHumans.length; i < 2; i++) {
        try {
          this.gameState.addPlayer(`bot_opponent_${i + 1}` as Player, Team.BLACK)
        } catch (e) { DEBUG && console.error('[OnlineGame] Failed to add bot_opponent to BLACK during sync:', e) }
      }

      DEBUG && console.log('[ONLINE] Game state synced successfully')

      // Recover game state from DB (survives refresh/OS kill)
      if (this._room) {
        const saved = await loadGameState(this._room.id)
        if (saved) {
          // Restore coordinator_id from DB (assigned at game creation, never recomputed)
          if (saved.coordinatorId) {
            this._coordinatorId = saved.coordinatorId
            DEBUG && console.log('[ONLINE] Restored coordinator_id:', this._coordinatorId)
          }
          // Restore last human resolution for panel rehydration (refresh/reconnect)
          if ((saved as any).lastHumanResolution) {
            this._lastHumanResolution = (saved as any).lastHumanResolution as MoveComparison
            DEBUG && console.log('[ONLINE] Restored lastHumanResolution for panel')
          }
          // Restore game_id and subscribe to submission changes
          if (saved.gameId) {
            this._gameId = saved.gameId
            if (!this._submissionChannel) {
              this.subscribeToSubmissions()
            }
            if (!this._gameStatusChannel) {
              this.subscribeToGameStatus()
            }
            DEBUG && console.log('[ONLINE] Restored game_id:', this._gameId)
          }

          // Compare turn numbers to decide whether we need to replay
          const dbTurnNumber = saved.turnNumber ?? 0
          const dbCurrentTurn = dbTurnNumber + 1
          const needsReplay = this._currentTurnNumber < dbCurrentTurn || this._status === GameStatus.WAITING

          DEBUG && console.log('[ONLINE] Sync turn compare:', {
            localTurn: this._currentTurnNumber,
            dbResolved: dbTurnNumber,
            dbCurrent: dbCurrentTurn,
            needsReplay,
            status: this._status,
          })

          // Status and turn number are DB-authoritative — sync unconditionally.
          // Exception: never overwrite terminal GAME_OVER (client may know
          // the game ended before the DB was persisted).
          if (this._status !== GameStatus.GAME_OVER) {
            this._status = saved.status as GameStatus
          }
          this._currentTurnNumber = dbCurrentTurn
          if (needsReplay) {
            this.gameState.setCurrentTeam(saved.currentTurn === 'WHITE' ? Team.WHITE : Team.BLACK)
          }

          // Restore match timer from persisted timestamps
          if (saved.matchStartedAt && saved.matchTimeLimitSeconds) {
            const startedAt = new Date(saved.matchStartedAt).getTime()
            const elapsed = Math.max(0, (Date.now() - startedAt) / 1000)
            const remaining = Math.max(0, saved.matchTimeLimitSeconds - elapsed)
            this.gameState.setMatchTimeRemaining(Math.floor(remaining))
            this.gameState.setMatchTimerActive(true)
            if (this.isCoordinator()) {
              if (this._timerSyncInterval) clearInterval(this._timerSyncInterval)
      if (this._timerSyncInterval) clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = setInterval(() => this.broadcastTimerSync(), 5000)
            }
            this.startMatchTimer()
            DEBUG && console.log('[ONLINE] Restored match timer:', {
              elapsed: Math.floor(elapsed),
              remaining: Math.floor(remaining),
              total: saved.matchTimeLimitSeconds
            })
          }

          // Restore board from authoritative DB FEN
          if (needsReplay) {
            if (saved.moveHistory.length > 0) {
              DEBUG && console.log('[ONLINE] Replaying saved game state:', { moves: saved.moveHistory.length, fen: saved.fen.substring(0, 30) })
              this._savedMoveHistory = saved.moveHistory.map((m: any) => ({
                team: m.team,
                move: m.move
              }))
              try {
                this.gameState.resetBoard(saved.fen)
              } catch (e) {
                DEBUG && console.warn('[ONLINE] Could not restore board from saved FEN, replaying moves')
                this.gameState.startMatch()
                for (const entry of saved.moveHistory) {
                  try {
                    this.gameState.board.move(entry.move)
                  } catch (me) {
                    DEBUG && console.warn('[ONLINE] Could not replay move:', entry.move, me)
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
              } catch (e) {
                DEBUG && console.error('[OnlineGame] Failed to restore lastMove:', e)
                this._lastMove = null
              }
            } else {
              this.gameState.startMatch()
            }
          } else {
            // Not behind: verify local FEN matches authoritative DB FEN.
            // ADR-006 stale-authority guard: only roll the board back to the DB
            // position when the DB actually knows MORE chess than we do. If the
            // row's move history is shorter than our board's, the row is stale
            // (failed/pending persistence) and "authoritative wins" would drag a
            // mid-game client backward onto an old position — the exact
            // divergence that produces Invalid-move throws at resolution.
            if (this.gameState.fen !== saved.fen) {
              const dbMoveCount = saved.moveHistory?.length ?? 0
              const localMoveCount = this.gameState.board.history().length
              if (dbMoveCount < localMoveCount) {
                DEBUG && console.warn('[ONLINE] Stale games row ignored (db moves:', dbMoveCount, '< local:', localMoveCount, ') — keeping local board')
                emitTrace('SYNC_STALE_ROW', { ...this.traceCtx(), extra: { dbMoveCount, localMoveCount } })
              } else {
                DEBUG && console.warn('[ONLINE] FEN mismatch — loading authoritative FEN from DB')
                try {
                  this.gameState.resetBoard(saved.fen)
                } catch {
                  // Keep local board if reload fails (board may have valid local state)
                }
              }
            }
          }

          // Ensure game phase is SELECTING. syncGameState() restores state
          // without calling startMatch(), leaving _phase at WAITING which
          // causes all setPendingMove calls to be silently dropped.
          if (this.gameState.phase === GamePhase.WAITING) {
            this.gameState.startMatch()
          }

          // Start pending turn for current state, then restore submissions from DB
          this.startPendingTurn()
          if (this._gameId && this._status !== GameStatus.GAME_OVER) {
            await this.restoreCurrentTurnSubmissions()
          }
          this.notifyStateChange()
          this.duoLog('GAME', 'SYNC_COMPLETE', { status: this._status, turnNumber: this._currentTurnNumber })
          return true
        } else {
          DEBUG && console.warn('[ONLINE] syncGameState: no saved game found, keeping current state')
          // Don't start a fresh game — the DB write may not have completed yet.
          // The next presence sync or polling interval will retry.
          this.duoLog('GAME', 'SYNC_NO_GAME', {})
          return false
        }
      }
      return false
    } catch (e) {
      // Never swallow a sync failure: callers (poll, reconnect, timeout
      // recovery) must be able to retry instead of leaving the client stuck.
      console.error('[ONLINE] Failed to sync game state:', e)
      this.duoLog('GAME', 'SYNC_FAILED', { errorMessage: String((e as Error)?.message || e) })
      return false
    }
  }

  /**
   * Queries turn_submissions for the current turn to restore the submission
   * state after a reconnect or a missed realtime event. The
   * gameState.startPendingTurn() call clears pending moves — we repopulate
   * them from the authoritative DB source. Returns true when any teammate
   * submission was re-applied.
   */
  private async restoreCurrentTurnSubmissions(): Promise<boolean> {
    if (!this._gameId) return false
    try {
      const { data, error } = await supabase
        .from('turn_submissions')
        .select('*')
        .eq('game_id', this._gameId)
        .eq('turn_number', this._currentTurnNumber)

      if (error) {
        console.warn('[ONLINE] restoreCurrentTurnSubmissions query failed:', error.message)
        this.duoLog('MOVE', 'RESTORE_SUBMISSIONS_FAILED', { errorCode: error.code, errorMessage: error.message })
        return false
      }

      if (data && data.length > 0) {
        for (const sub of data) {
          this.handleSubmissionFromDB(sub as {
            game_id: string; turn_number: number; player_id: string
            move_san: string; move_from: string; move_to: string; piece: string
          })
        }
        DEBUG && console.log('[ONLINE] Restored', data.length, 'submissions for turn', this._currentTurnNumber)
        this.duoLog('MOVE', 'RESTORE_SUBMISSIONS', { restored: data.length, turnNumber: this._currentTurnNumber })
        return true
      }
    } catch (e) {
      DEBUG && console.warn('[ONLINE] Failed to restore turn submissions:', e)
      this.duoLog('MOVE', 'RESTORE_SUBMISSIONS_FAILED', { errorMessage: String((e as Error)?.message || e) })
    }
    return false
  }

  private broadcastTimerSync(): void {
    if (!this._channel || !this.isCoordinator()) return
    const remaining = this.gameState.getMatchTimeRemaining()
    this._channel.send({
      type: 'broadcast',
      event: 'timer_sync',
      payload: { matchTimeRemaining: remaining, turnNumber: this._currentTurnNumber }
    })
  }

  private handleTimerSync(payload: { matchTimeRemaining: number; turnNumber?: number }): void {
    // ADR-006: clock broadcasts must NEVER advance board/turn state. A client
    // whose turn counter runs ahead of its board (missed turn_resolved) would
    // otherwise accept next-turn submissions against a stale position and
    // throw "Invalid move" at resolution. Turn numbers advance ONLY via
    // handleTurnResolved / syncGameState (authoritative sources).
    if (payload.matchTimeRemaining !== undefined) {
      this.gameState.setMatchTimeRemaining(payload.matchTimeRemaining)
      this.notifyStateChange()
    }
  }

  private startMatchTimer(): void {
    this.gameState.setMatchTimerActive(true)
    this.duoLog('CLOCK', 'TIMER_STARTED', { remaining: this.gameState.getMatchTimeRemaining() })
    if (this._timerCountdownInterval) {
      clearInterval(this._timerCountdownInterval)
    }
    this._timerCountdownInterval = setInterval(() => {
      // Only coordinator runs the authoritative countdown.
      // Non-coordinators receive time via timer_sync broadcasts
      // (corrected every 5s) and smooth-count via tickMatchTimer.
      if (!this.isCoordinator()) return

      const remaining = this.gameState.getMatchTimeRemaining()
      if (remaining <= 0) {
        this.duoLog('CLOCK', 'TIMER_EXPIRED', {})
        const captured = this.gameState.capturedPieces
        const whiteCaptured = captured.white.length
        const blackCaptured = captured.black.length
        if (whiteCaptured > blackCaptured) {
          this.setGameOverTimeup('White wins on time', 'timeout')
        } else if (blackCaptured > whiteCaptured) {
          this.setGameOverTimeup('Black wins on time', 'timeout')
        } else {
          this.setGameOverTimeup('Draw on time', 'timeout')
        }
        this.notifyStateChange()
        return
      }
      this.gameState.setMatchTimeRemaining(Math.max(0, remaining - 1))
      this.notifyStateChange()
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
    DEBUG && console.log('[ONLINE] Teammate moved:', payload)
    if (payload.playerId !== this._playerId) {
      // Only react if the player is on our team (all modes)
      if (this.getPlayerTeam(payload.playerId) !== this._team) {
        return
      }
      this.gameState.setPendingMove(payload.playerId as Player, payload.move, payload.from, payload.to, 'unknown')
      
      // If we're still in selecting (human hasn't moved yet), transition to waiting_for_teammate
      // This ensures pendingOverlay shows the teammate's move
      if (this.turnState === 'selecting') {
        DEBUG && console.log('[STATE] Teammate moved first, transitioning to waiting_for_teammate')
        this.turnState = 'waiting_for_teammate'
      }
      
      this.notifyStateChange()
    }
  }

  private handleTeammateLocked(payload: { playerId: string }) {
    DEBUG && console.log('[ONLINE] Teammate locked:', payload)
    if (payload.playerId !== this._playerId) {
      // Only react if the player is on our team (all modes)
      if (this.getPlayerTeam(payload.playerId) !== this._team) {
        return
      }
      this.gameState.lockPendingMove(payload.playerId as Player)
      
      // Resolve the waitForTeammateLock Promise
      if (this.resolveTeammateLocked && this.turnState === 'waiting_for_teammate') {
        DEBUG && console.log('[STATE] Teammate locked, transitioning to resolving state')
        if (this._teammateLockTimeout) {
          clearTimeout(this._teammateLockTimeout)
          this._teammateLockTimeout = null
        }
        this.turnState = 'resolving'
        this.notifyStateChange()
        this.resolveTeammateLocked()
        this.resolveTeammateLocked = null
      }
      
      this.notifyStateChange()
    }
  }

  private handleTurnResolved(payload: { winningTeam: string; winningMove: string; comparison?: MoveComparison | null; coordinatorId?: string; matchTimeRemaining?: number; turnSequence?: number; turnNumber?: number }) {
    if (this._status === GameStatus.GAME_OVER) return
    this.duoLog('MOVE', 'TURN_RESOLVED_RECEIVED', { winningTeam: payload.winningTeam, turnNumber: payload.turnNumber, turnSequence: payload.turnSequence })
    emitTrace('CLIENT_RECEIVED', { ...this.traceCtx(), extra: { event: 'turn_resolved', winningTeam: payload.winningTeam } })
    // R1: reject stale turn_resolved from previous turns
    const incomingSeq = payload.turnSequence ?? 0
    if (incomingSeq < this._turnSequence) {
      DEBUG && console.warn('[ONLINE] Stale turn_resolved rejected (seq:', incomingSeq, 'current:', this._turnSequence, ')')
      return
    }
    this._turnSequence = incomingSeq
    DEBUG && console.log('[TURN-RESOLVED] Received broadcast:', {
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
      DEBUG && console.log('[TURN-RESOLVED] Own broadcast — skipping redundant resolve, running cleanup only')
    }
    
    if (payload.comparison) {
      DEBUG && console.log('[TURN-RESOLVED] Comparison received:', {
        player1Move: payload.comparison.player1Move,
        player2Move: payload.comparison.player2Move,
        isSync: payload.comparison.isSync,
        winnerId: payload.comparison.winnerId
      })
      this._lastMoveComparison = payload.comparison
      if (payload.coordinatorId) {
        this._player1Id = payload.coordinatorId
        DEBUG && console.log('[PLAYER1-ID] Set from coordinator:', payload.coordinatorId)
      }
      if (payload.winningTeam === Team.WHITE) {
        this._whiteComparison = payload.comparison
      } else {
        this._blackComparison = payload.comparison
      }
      // Track human-owned resolution for panel ownership (viewer-team only)
      if (payload.winningTeam === this._team && payload.comparison) {
        this._lastHumanResolution = payload.comparison
      }
    }

    // ADR-006 idempotency: an equal-seq re-delivery of an already-applied
    // resolution must not re-apply its move. Supabase Broadcast does not
    // guarantee exactly-once delivery, and the R1 staleness check above
    // intentionally accepts equal sequences.
    const isDuplicateOfApplied =
      !!this._lastAppliedResolution &&
      this._lastAppliedResolution.turnSequence === incomingSeq &&
      this._lastAppliedResolution.winningMove === payload.winningMove
    if (isDuplicateOfApplied && !isOwnBroadcast) {
      DEBUG && console.warn('[ONLINE] Duplicate turn_resolved ignored (already applied):', JSON.stringify({ seq: incomingSeq, winningMove: payload.winningMove }))
    }
    
    if (!isOwnBroadcast && !isDuplicateOfApplied) {
      // Always sync timer from coordinator (single source of truth)
      if (payload.matchTimeRemaining !== undefined) {
        this.gameState.setMatchTimeRemaining(payload.matchTimeRemaining)
      }

      // [RESOLVE][FORENSIC] dev-gated probe taken BEFORE any mutation — pairs
      // with the resolvePendingMoves() probe when diagnosing Invalid-move throws.
      if (DEBUG) {
        console.log('[RESOLVE][FORENSIC]', JSON.stringify({
          source: 'handleTurnResolved',
          roomId: this._room?.id || undefined,
          gameId: this._gameId || undefined,
          turnNumber: payload.turnNumber ?? null,
          turnSequence: incomingSeq,
          coordinatorId: this._coordinatorId || undefined,
          currentFen: this.gameState.fen,
          currentTurn: this.gameState.currentTeam,
          phase: this.gameState.phase,
          winningMove: payload.winningMove,
          legalAtCurrentFen: isMoveLegalAt(this.gameState.fen, payload.winningMove),
          lastApplied: this._lastAppliedResolution,
        }))
      }

      // Try to apply the move through normal resolve flow
      const result = this.gameState.resolve(payload.winningMove)

      if (result) {
        DEBUG && console.log('[ONLINE] Applied resolved move via gameState.resolve:', payload.winningMove, 'new turn:', this.gameState.currentTeam)
        this._lastAppliedResolution = { turnSequence: incomingSeq, winningMove: payload.winningMove }
      } else if (isMoveLegalAt(this.gameState.fen, payload.winningMove)) {
        // Phase is not LOCKED — our local copy of a teammate submission was
        // lost (missed postgres_changes/broadcast). The move IS legal at the
        // current position, so apply it directly to keep the board advancing.
        // ADR-006: validated before mutation — never apply unverified data.
        try {
          this.gameState.board.move(payload.winningMove)
          this._lastAppliedResolution = { turnSequence: incomingSeq, winningMove: payload.winningMove }
          DEBUG && console.log('[ONLINE] Applied validated move directly to board, new FEN:', this.gameState.fen)
        } catch (e) {
          // Legality was just probed, so this should be unreachable; keep the
          // board untouched rather than guessing.
          DEBUG && console.log('[ONLINE] Could not apply move directly:', e)
        }

        // Sync turn with board - FEN position 7 indicates 'w' or 'b'
        const fenParts = this.gameState.fen.split(' ')
        const boardTurn = fenParts[1] === 'w' ? Team.WHITE : Team.BLACK
        if (this.gameState.currentTeam !== boardTurn) {
          this.gameState.setCurrentTeam(boardTurn)
          DEBUG && console.log('[ONLINE] Synced turn to match board:', boardTurn)
        }
      } else {
        // ADR-006 STATE_DIVERGENCE: the resolution's move is illegal against
        // our board — we missed earlier resolutions and local state is stale.
        // Never guess or force-apply: discard nothing, touch nothing, and
        // rebuild the full state from the authoritative games row.
        console.error('[RESOLVE][FORENSIC] STATE_DIVERGENCE on turn_resolved — re-syncing from DB:', JSON.stringify({
          winningMove: payload.winningMove,
          currentFen: this.gameState.fen,
          turnSequence: incomingSeq,
        }))
        emitTrace('RESOLVE_DIVERGENCE', { ...this.traceCtx(), extra: { winningMove: payload.winningMove, currentFen: this.gameState.fen, turnSequence: incomingSeq } })
        this.syncGameState().catch((e) => console.error('[ONLINE] Divergence re-sync failed:', e))
      }
    }
    
    // Sync turn number from coordinator to keep submission filtering in sync
    if (payload.turnNumber !== undefined && payload.turnNumber > this._currentTurnNumber) {
      DEBUG && console.log('[ONLINE] Syncing turn number:', this._currentTurnNumber, '->', payload.turnNumber)
      this._currentTurnNumber = payload.turnNumber
    }

    // Ensure we're in correct phase for next turn
    this.startPendingTurn()
    
    // Resolve any turn change waiters
    if (this.resolveTurnChange) {
      this.resolveTurnChange()
      this.resolveTurnChange = null
    }
    if (this._turnChangeTimeout) {
      clearTimeout(this._turnChangeTimeout)
      this._turnChangeTimeout = null
    }
    // Clean up stale lock timeout — turn resolved before teammate locked (R1)
    if (this._teammateLockTimeout) {
      clearTimeout(this._teammateLockTimeout)
      this._teammateLockTimeout = null
    }
    // Resolve before nullifying — non-coordinator may be stuck in
    // waitForTeammateLock() if postgres_changes never delivered the
    // teammate's submission. The turn_resolved broadcast is the
    // authority; free the waiter so executeMove can return gracefully.
    if (this.resolveTeammateLocked) {
      this.resolveTeammateLocked()
    }
    this.resolveTeammateLocked = null
    
    DEBUG && console.log('[ONLINE] After handleTurnResolved - phase:', this.gameState.phase, 'turn:', this.gameState.currentTeam)
    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    }
    this.turnState = 'selecting'
    emitTrace('TURN_COMPLETED', { ...this.traceCtx() })
    this.notifyStateChange()
    DEBUG && console.log('[STATE] Turn resolved, reset to selecting')
  }

  private canBroadcast(event: string): boolean {
    const now = Date.now()
    const last = this._broadcastThrottle.get(event) || 0
    if (now - last < this.BROADCAST_MIN_INTERVAL_MS) {
      DEBUG && console.warn(`[RATE-LIMIT] Broadcast throttled for event: ${event}`)
      return false
    }
    this._broadcastThrottle.set(event, now)
    return true
  }

  async broadcastMove(move: string, from: string, to: string): Promise<void> {
    // Replaced by submitMoveToDB — kept for backward compatibility
    await this.submitMoveToDB(move, from, to, 'unknown')
  }

  async broadcastLocked(): Promise<void> {
    // Submission to turn_submissions implies lock — no-op
  }

  /**
   * Writes the player's move to the turn_submissions table.
   * The composite PK (game_id, turn_number, player_id) enforces
   * exactly one submission per player per turn.
   *
   * Returns true when the submission was persisted (and local pending state
   * was applied). On failure the local pending move is fully rolled back and
   * turnState returns to 'selecting' so the player can retry — a failed write
   * must never leave the board locked.
   */
  async submitMoveToDB(move: string, from: string, to: string, piece: string): Promise<boolean> {
    if (!this._gameId) {
      DEBUG && console.warn('[SUBMIT] No gameId — falling back to broadcast')
      this.duoLog('MOVE', 'SUBMIT_NO_GAME_ID', { move })
      if (this._channel) {
        await this._channel.send({
          type: 'broadcast',
          event: 'player_move',
          payload: { playerId: this._playerId, move, from, to }
        })
      }
      return false
    }

    // Set local state BEFORE DB write — the board and inputLockedRef are
    // already locked by the UI layer; eager local state keeps them in sync.
    this.gameState.setPendingMove(this._playerId as Player, move, from, to, piece)
    this.gameState.lockPendingMove(this._playerId as Player)
    if (this.turnState === 'selecting') {
      this.turnState = 'waiting_for_teammate'
    }
    this.notifyStateChange()
    DEBUG && console.log('[SUBMIT] Move set locally, writing to DB:', { turn: this._currentTurnNumber, player: this._playerId, move })
    this.duoLog('MOVE', 'SUBMIT_STARTED', { turnNumber: this._currentTurnNumber, move })

    try {
      const { error } = await supabase
        .from('turn_submissions')
        .upsert({
          game_id: this._gameId,
          turn_number: this._currentTurnNumber,
          player_id: this._playerId,
          move_san: move,
          move_from: from,
          move_to: to,
          piece,
        }, { onConflict: 'game_id,turn_number,player_id' })

      if (error) {
        DEBUG && console.warn('[SUBMIT] DB insert failed:', error.message)
        this.duoLog('MOVE', 'SUBMIT_FAILED', { errorCode: error.code, errorMessage: error.message, move })
        this.rollbackSubmission(move, from, to)
        return false
      }

      DEBUG && console.log('[SUBMIT] DB write confirmed:', { turn: this._currentTurnNumber, player: this._playerId, move })
      this.duoLog('MOVE', 'SUBMIT_SUCCESS', { turnNumber: this._currentTurnNumber, move })
      return true
    } catch (e) {
      DEBUG && console.error('[SUBMIT] DB write failed:', e)
      this.duoLog('MOVE', 'SUBMIT_FAILED', { errorMessage: String((e as Error)?.message || e), move })
      this.rollbackSubmission(move, from, to)
      return false
    }
  }

  /**
   * Undoes a failed local submission so the board can be re-enabled and the
   * player can retry. Best-effort broadcast of the intended move lets the
   * teammate see it even if persistence is temporarily unavailable.
   */
  private async rollbackSubmission(move: string, from: string, to: string): Promise<void> {
    this.gameState.clearPendingMove(this._playerId as Player)
    this.turnState = 'selecting'
    this.notifyStateChange()
    // Best-effort: surface the intended move to the teammate via broadcast.
    if (this._channel) {
      try {
        await this._channel.send({
          type: 'broadcast',
          event: 'player_move',
          payload: { playerId: this._playerId, move, from, to }
        })
      } catch (e) {
        DEBUG && console.error('[SUBMIT] Failed to broadcast rollback move:', e)
      }
    }
  }

  clearPendingMove(player: Player): void {
    this.gameState.clearPendingMove(player)
  }

  /**
   * Subscribes to postgres_changes on turn_submissions for this game.
   * When the teammate's submission arrives, it updates local pending state
   * and transitions to LOCKED if both players have submitted.
   */
  private subscribeToSubmissions(): void {
    if (!this._gameId) return

    const gameId = this._gameId
    const setup = () => {
      realtimeMetrics.onChannelCreated(`submissions:${gameId}`)
      this._submissionChannel = supabase.channel(`submissions:${gameId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'turn_submissions',
          filter: `game_id=eq.${gameId}`,
        }, (payload) => {
          this.handleSubmissionFromDB(payload.new as {
            game_id: string
            turn_number: number
            player_id: string
            move_san: string
            move_from: string
            move_to: string
            piece: string
          })
        })
        .subscribe(async (status: string) => {
          realtimeMetrics.onSubscribeStatus(`submissions:${gameId}`, status)
          DEBUG && console.log('[SUBMIT] Submission channel status:', status)
          if (status === 'CHANNEL_ERROR') {
            DEBUG && console.warn('[SUBMIT] Channel error — re-creating subscription channel')
            try {
              await supabase.removeChannel(this._submissionChannel!)
            } catch (e) { DEBUG && console.error('[SUBMIT] Failed to remove errored channel:', e) }
            RealtimeService.forceRemoveStaleChannels(`submissions:${gameId}`)
            setup()
          }
        })
    }
    setup()
  }

  /**
   * Subscribes to postgres_changes on the games table to detect GAME_OVER
   * status changes (e.g. resignation) even if the broadcast event is lost.
   */
  private subscribeToGameStatus(): void {
    if (!this._room) return

    const roomId = this._room.id
    realtimeMetrics.onChannelCreated(`game-status:${roomId}`)
    this._gameStatusChannel = supabase.channel(`game-status:${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const newStatus = (payload.new as any)?.status
        if (newStatus === 'GAME_OVER' && this._status !== GameStatus.GAME_OVER) {
          DEBUG && console.log('[GAME-STATUS] Detected GAME_OVER via DB update')
          // Determine resigning team from the broadcast payload if available,
          // otherwise use the opposite of our team as fallback
          const resigningTeam = this._team === 'WHITE' ? 'BLACK' : 'WHITE'
          this.handleMatchAbandoned({ playerId: 'unknown', team: resigningTeam as 'WHITE' | 'BLACK' })
        }
      })
      .subscribe(async (status: string) => {
        realtimeMetrics.onSubscribeStatus(`game-status:${roomId}`, status)
        DEBUG && console.log('[GAME-STATUS] Channel status:', status)
        if (status === 'CHANNEL_ERROR') {
          DEBUG && console.warn('[GAME-STATUS] Channel error — re-creating')
          try {
            await supabase.removeChannel(this._gameStatusChannel!)
          } catch (e) { DEBUG && console.error('[GAME-STATUS] Failed to remove errored channel:', e) }
          RealtimeService.forceRemoveStaleChannels(`game-status:${roomId}`)
          realtimeMetrics.onChannelCreated(`game-status:${roomId}`)
          this._gameStatusChannel = supabase.channel(`game-status:${roomId}`)
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'games',
              filter: `room_id=eq.${roomId}`,
            }, (p) => {
              const ns = (p.new as any)?.status
              if (ns === 'GAME_OVER' && this._status !== GameStatus.GAME_OVER) {
                DEBUG && console.log('[GAME-STATUS] Detected GAME_OVER via DB update (reconnect)')
                const rt = this._team === 'WHITE' ? 'BLACK' : 'WHITE'
                this.handleMatchAbandoned({ playerId: 'unknown', team: rt as 'WHITE' | 'BLACK' })
              }
            })
            .subscribe(async (s2: string) => {
              realtimeMetrics.onSubscribeStatus(`game-status:${roomId}`, s2)
            })
        }
      })
  }

  private handleSubmissionFromDB(submission: {
    game_id: string
    turn_number: number
    player_id: string
    move_san: string
    move_from: string
    move_to: string
    piece: string
  }): void {
    // Ignore own submissions (already processed locally in submitMoveToDB)
    if (submission.player_id === this._playerId) return

    // Ignore submissions for past/future turns
    if (submission.turn_number !== this._currentTurnNumber) {
      DEBUG && console.log('[SUBMIT] Ignoring submission for turn', submission.turn_number, '(current:', this._currentTurnNumber, ')')
      return
    }

    // Only react if the player is on our team
    if (this.getPlayerTeam(submission.player_id) !== this._team) return

    // Dedup: don't process if already locked
    if (this.gameState.isPendingMoveLocked(submission.player_id as Player)) return

    DEBUG && console.log('[SUBMIT] Received teammate submission from DB:', submission)
    this._lastActivityAt = Date.now()
    this.duoLog('MOVE', 'TEAMMATE_SUBMISSION', { turnNumber: submission.turn_number, playerId: submission.player_id })

    this.gameState.setPendingMove(
      submission.player_id as Player,
      submission.move_san,
      submission.move_from,
      submission.move_to,
      submission.piece,
    )

    // If we're still in selecting (human hasn't moved yet), transition to waiting_for_teammate
    if (this.turnState === 'selecting') {
      DEBUG && console.log('[STATE] Teammate moved first, transitioning to waiting_for_teammate')
      this.turnState = 'waiting_for_teammate'
    }

    // Lock the teammate's move (submission to DB implies lock)
    this.gameState.lockPendingMove(submission.player_id as Player)

    // Resolve the waitForTeammateLock Promise
    if (this.resolveTeammateLocked && this.turnState === 'waiting_for_teammate') {
      DEBUG && console.log('[STATE] Teammate submission received, transitioning to resolving state')
      if (this._teammateLockTimeout) {
        clearTimeout(this._teammateLockTimeout)
        this._teammateLockTimeout = null
      }
      this.turnState = 'resolving'
      this.notifyStateChange()
      this.resolveTeammateLocked()
      this.resolveTeammateLocked = null
    }

    this.notifyStateChange()
  }

  start(): void {
    this.gameState.startMatch()
    this._status = GameStatus.PLAYING
    this.startPendingTurn()
  }

  startPendingTurn(): void {
    if (this.gameState.currentTeam === Team.WHITE) {
      this._whiteComparison = null
      DEBUG && console.log('[STATE-SYNC] New WHITE turn: resetting WHITE comparison ref')
    } else {
      this._blackComparison = null
      DEBUG && console.log('[STATE-SYNC] New BLACK turn: resetting BLACK comparison ref')
    }
    const fen = this.gameState.fen
    emitTrace('TURN_STARTED', { ...this.traceCtx(), team: this.gameState.currentTeam, extra: { fen } })
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

  getEvaluator(): GameEvaluator {
    return this.evaluator
  }

  setGameOverTimeup(result: string, reason: string): void {
    this._status = GameStatus.GAME_OVER
    this._gameOverResult = result
    this._gameOverReason = reason
    // Fallback: if no turns resolved but board has moves, derive from board history
    if (this.stats.movesPlayed === 0) {
      const boardMoves = this.gameState.board.history({ verbose: true }).length
      if (boardMoves > 0) {
        this.stats.movesPlayed = boardMoves
        this.stats.syncRate = 1.0
      }
    }
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
    this.resolvePendingWaiter()
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
    DEBUG && console.log(`[OnlineGame] Using browser evaluator`)
    this.evaluator = createEvaluator()
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

  private async _finishResolution(currentTeam: Team, winningMove: string): Promise<void> {
    // Persist game state for recovery from refresh/OS kill
    const resolvedTurnNumber = this._currentTurnNumber
    this._currentTurnNumber++
    emitTrace('TURN_RESOLVED', { ...this.traceCtx(), team: currentTeam, extra: { winningMove } })
    this.duoLog('MOVE', 'RESOLUTION_FINISH', { currentTeam, winningMove, resolvedTurnNumber })

    // Human-owned resolution tracking: panel persists last human-team MoveComparison
    const isHumanTeamResolution = currentTeam === this._team
    if (isHumanTeamResolution && this._lastMoveComparison) {
      this._lastHumanResolution = this._lastMoveComparison
    }

    if (this._room) {
      const fenBefore = this.gameState.getTurnStartFen() || this.gameState.fen
      try {
        await saveGameState(this._room.id, this.gameState.fen, this.gameState.currentTeam, {
          team: currentTeam,
          move: winningMove,
          fen_before: fenBefore,
          fen_after: this.gameState.fen,
          timestamp: new Date().toISOString()
        }, this._status, undefined, undefined, resolvedTurnNumber, this._coordinatorId, winningMove, isHumanTeamResolution ? this._lastMoveComparison : undefined)
      } catch (e) {
        // Persistence failure must NOT abort the in-session resolution (that
        // would strand the non-coordinator waiting for turn_resolved). Surface
        // loudly; the next successful save will correct the games row.
        console.error('[ONLINE] ❌ Failed to persist resolved game state:', e)
        this.duoLog('GAME', 'RESOLVE_PERSIST_FAILED', { errorMessage: String((e as Error)?.message || e) })
      }
    }

    // Broadcast turn_resolved to all non-coordinator clients
    this._turnSequence++
    // ADR-006: record what THIS coordinator applied so its own broadcast echo /
    // duplicates can be recognized as no-ops in handleTurnResolved.
    this._lastAppliedResolution = { turnSequence: this._turnSequence, winningMove }
    emitTrace('REALTIME_BROADCAST', { ...this.traceCtx(), extra: { event: 'turn_resolved', seq: this._turnSequence } })
    if (this._channel) {
      await this._channel.send({
        type: 'broadcast',
        event: 'turn_resolved',
        payload: {
          winningTeam: currentTeam,
          winningMove,
          comparison: this._lastMoveComparison,
          coordinatorId: this._playerId,
          matchTimeRemaining: this.gameState.getMatchTimeRemaining(),
          turnSequence: this._turnSequence,
          turnNumber: this._currentTurnNumber,
        }
      })
    }

    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    if (this._disconnectCheckInterval) {
      clearInterval(this._disconnectCheckInterval)
      this._disconnectCheckInterval = null
    }
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval)
        this._pollingInterval = null
      }
      this.stopMatchTimer()
    }
  }

  /**
   * ADR-006 divergence recovery: local board state provably disagrees with a
   * pending submission. Never apply unvalidated data and never reset the board
   * blindly — discard the whole turn, rebuild state from the authoritative
   * games row (which replays any missed resolutions), and reopen submissions
   * so the turn can be replayed cleanly. The caller throws STATE_DIVERGENCE so
   * Game.tsx's existing recovery path unlocks input uniformly.
   */
  private async _recoverFromDivergence(
    currentFen: string,
    pendingMoves: Array<{ player: string; move: string }>,
    illegalMoves: string[]
  ): Promise<void> {
    // Always loud — divergence is a real corruption signal, not noise.
    console.error('[RESOLVE][FORENSIC] STATE_DIVERGENCE — pending moves illegal at local position:', JSON.stringify({
      roomId: this._room?.id || undefined,
      gameId: this._gameId || undefined,
      turnNumber: this._currentTurnNumber,
      coordinatorId: this._coordinatorId || undefined,
      currentFen,
      pendingMoves,
      illegalMoves,
    }))
    emitTrace('RESOLVE_DIVERGENCE', { ...this.traceCtx(), extra: { currentFen, illegalMoves, turnNumber: this._currentTurnNumber } })
    this.duoLog('MOVE', 'RESOLVE_DIVERGENCE', { turnNumber: this._currentTurnNumber, illegalMoves })

    this.startPendingTurn()
    this.turnState = 'selecting'
    this.notifyStateChange()

    try {
      const synced = await this.syncGameState()
      DEBUG && console.log('[RESOLVE][FORENSIC] Divergence re-sync outcome:', synced ? 'restored from DB' : 'no DB row yet — will retry on next event')
    } catch (e) {
      // Re-sync failure must not mask the original divergence; the fallback
      // poll / next realtime event retries syncGameState.
      console.error('[RESOLVE][FORENSIC] Divergence re-sync failed:', e)
    }
  }

  async resolvePendingMoves(): Promise<{ winnerId: string; winningMove: string }> {
    if (!this.isCoordinator()) {
      DEBUG && console.log('[ONLINE] Not coordinator — waiting for coordinator broadcast')
      throw new Error('NOT_COORDINATOR')
    }

    // ADR-006 single-writer: a concurrent trigger (executeMove, bot handler,
    // initial-bot effect) must not evaluate/apply the same turn twice. The
    // in-flight invocation owns the state transition end-to-end.
    if (this.turnState === 'resolving') {
      DEBUG && console.warn('[RESOLVE] resolvePendingMoves re-entered while already resolving — no-op')
      throw new Error('RESOLVE_IN_PROGRESS')
    }

    const currentTeam = this.gameState.currentTeam
    
    this.turnState = 'resolving'
    emitTrace('TURN_RESOLUTION_STARTED', { ...this.traceCtx(), team: this.gameState.currentTeam })
    DEBUG && console.log('[STATE] Resolving, set turnState to resolving')
    this.duoLog('MOVE', 'RESOLVE_STARTED', { currentTeam })
    this.notifyStateChange()
    
    const allPendingMoves = this.gameState.getAllPendingMoves()
    const pendingMovesArray = Array.from(allPendingMoves.entries())
    
    // Color-agnostic, ORDER-INDEPENDENT move-pair selection: the human team may
    // be WHITE or BLACK (Duo lets the host pick). The coordinator's own move is
    // always "player1" (preserves accuracy/player1 tracking and the broadcast
    // `coordinatorId` invariant); the other submitted move is "player2". If the
    // coordinator is not on the current team (bot team turn), fall back to the
    // first two submitted moves so bot teams resolve on either color.
    //
    // NOTE: the previous Map-iteration loop was order-dependent — when the
    // teammate's entry was iterated before the coordinator's own entry, the
    // coordinator branch overwrote `move1` and the teammate's move was lost,
    // collapsing both submissions to the coordinator's move (isSync = true).
    let move1: PendingMoveInfo | null = null
    let move2: PendingMoveInfo | null = null
    let player1Id = ''
    let player2Id = ''

    const ownEntry = pendingMovesArray.find(([player]) => player === this._playerId)
    if (ownEntry) {
      move1 = ownEntry[1]
      player1Id = ownEntry[0]
      this._player1Id = ownEntry[0] // Track player1 for this client
      DEBUG && console.log('[PLAYER1-ID] Set player1Id to:', ownEntry[0])
      const otherEntry = pendingMovesArray.find(([player]) => player !== this._playerId)
      if (otherEntry) {
        move2 = otherEntry[1]
        player2Id = otherEntry[0]
      }
    } else {
      // Bot team turn (coordinator not on the current team): use any two moves.
      if (pendingMovesArray.length >= 1) {
        move1 = pendingMovesArray[0][1]
        player1Id = pendingMovesArray[0][0]
      }
      if (pendingMovesArray.length >= 2) {
        move2 = pendingMovesArray[1][1]
        player2Id = pendingMovesArray[1][0]
      }
    }

    if (!move1 || !move2) {
      DEBUG && console.log('[CHESSDUO-BOT-TRACE] TURN_RESOLVE_FAILED', JSON.stringify({
        currentTeam,
        turnNumber: this._currentTurnNumber,
        allPlayers: Array.from(allPendingMoves.keys()),
        myPlayerId: this._playerId,
        move1,
        move2,
        reason: 'pending moves incomplete',
      }))
      DEBUG && console.log('[RESOLVE] Pending moves debug:', {
        allPlayers: Array.from(allPendingMoves.keys()),
        currentTeam,
        myPlayerId: this._playerId,
        move1,
        move2
      })
      throw new Error('Both pending moves must be set')
    }

    DEBUG && console.log('[CHESSDUO-BOT-TRACE] TURN_RESOLVE', JSON.stringify({
      currentTeam,
      turnNumber: this._currentTurnNumber,
      player1Id,
      player2Id,
      player1Move: move1.move,
      player2Move: move2.move,
    }))

    const player1Move = move1.move
    const player2Move = move2.move
    const player1From = move1.from
    const player1To = move1.to
    const player2From = move2.from
    const player2To = move2.to
    const isSync = player1Move === player2Move

    DEBUG && console.log(`\n${'='.repeat(60)}`)
    DEBUG && console.log(`[ONLINE RESOLVE] ${currentTeam} team to move`)
    DEBUG && console.log(`[MOVES] ${player1Id}: ${player1Move} (${player1From}${player1To}) | ${player2Id}: ${player2Move} (${player2From}${player2To})`)
    
    const turnStartFen = this.gameState.fen

    // [RESOLVE][FORENSIC] dev-gated state snapshot taken BEFORE any mutation.
    // This is the primary diagnostic for "Invalid move: <SAN>" — it records
    // exactly which FEN the resolution pipeline was about to mutate and
    // whether each pending submission is legal there.
    if (DEBUG) {
      console.log('[RESOLVE][FORENSIC]', JSON.stringify({
        source: 'resolvePendingMoves',
        roomId: this._room?.id || undefined,
        gameId: this._gameId || undefined,
        turnNumber: this._currentTurnNumber,
        coordinatorId: this._coordinatorId || undefined,
        currentFen: turnStartFen,
        turnStartFen: this.gameState.getTurnStartFen() || null,
        currentTurn: currentTeam,
        phase: this.gameState.phase,
        pending: pendingMovesArray.map(([p, m]) => ({ player: p, move: m.move, locked: m.locked })),
        legality: {
          player1Move: isMoveLegalAt(turnStartFen, player1Move),
          player2Move: isMoveLegalAt(turnStartFen, player2Move),
        },
        moveHistoryLength: this.gameState.board.history().length,
        lastApplied: this._lastAppliedResolution,
      }))
    }

    // ADR-006 divergence gate: every pending submission MUST be legal at the
    // turn-start FEN. An illegal one proves local board state has diverged from
    // the submitting client's view (missed turn_resolved, stale DB row).
    // Applying it anyway corrupts the position and surfaces as a chess.js
    // "Invalid move" throw mid-resolution. Instead: discard the turn, rebuild
    // state from the authoritative games row, reopen submissions for a retry.
    const illegalMoves = [player1Move, player2Move].filter((m) => !isMoveLegalAt(turnStartFen, m))
    if (illegalMoves.length > 0) {
      await this._recoverFromDivergence(turnStartFen, [
        { player: player1Id, move: player1Move },
        { player: player2Id, move: player2Move },
      ], illegalMoves)
      throw new Error(`STATE_DIVERGENCE: illegal pending moves (${illegalMoves.join(', ')}) at ${turnStartFen.split(' ').slice(0, 4).join(' ')}`)
    }
    
    const player1Uci = player1From + player1To
    const player2Uci = player2From + player2To
    
    // Checkmate short-circuit: skip Stockfish if either move is checkmate
    try {
      const mateCheck = new Chess(turnStartFen)
      mateCheck.move(player1Move)
      if (mateCheck.isCheckmate()) {
        this._lastMove = { from: player1From, to: player1To }
        this._lastMoveComparison = {
          player1Move, player2Move, player1Score: CHECKMATE_SCORE, player2Score: 0,
          player1Accuracy: 100, player2Accuracy: 0,
          player1Loss: 0, player2Loss: CHECKMATE_SCORE,
          player1Category: getAccuracyCategory(0), player2Category: getAccuracyCategory(CHECKMATE_SCORE),
          winningMove: player1Move, winningScore: CHECKMATE_SCORE,
          isSync: false, bestEngineMove: player1Uci, bestEngineScore: CHECKMATE_SCORE,
          turnStartFen, winnerId: 'player1', loserId: 'player2',
          loserFrom: player2From, loserTo: player2To,
          alternatives: [], youMatchedEngine: true, teammateMatchedEngine: false,
        }
        this.stats.movesPlayed++
        this.stats.conflicts++
        this.stats.syncRate = (this.stats.syncRate * (this.stats.movesPlayed - 1)) / this.stats.movesPlayed
        this.stats.player1Accuracy = ((this.stats.player1Accuracy * (this.stats.movesPlayed - 1)) + 100) / this.stats.movesPlayed
        this.stats.player2Accuracy = ((this.stats.player2Accuracy * (this.stats.movesPlayed - 1)) + 0) / this.stats.movesPlayed
        this.gameState.resolve(player1Move)
        if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
        this.notifyStateChange()
        await this._finishResolution(currentTeam, player1Move)
        return { winnerId: 'player1', winningMove: player1Move }
      }
    } catch (e) { DEBUG && console.error('[OnlineGame] Failed to check isCheckmate (1):', e) }
    
    try {
      const mateCheck2 = new Chess(turnStartFen)
      mateCheck2.move(player2Move)
      if (mateCheck2.isCheckmate()) {
        this._lastMove = { from: player2From, to: player2To }
        this._lastMoveComparison = {
          player1Move, player2Move, player1Score: 0, player2Score: CHECKMATE_SCORE,
          player1Accuracy: 0, player2Accuracy: 100,
          player1Loss: CHECKMATE_SCORE, player2Loss: 0,
          player1Category: getAccuracyCategory(CHECKMATE_SCORE), player2Category: getAccuracyCategory(0),
          winningMove: player2Move, winningScore: CHECKMATE_SCORE,
          isSync: false, bestEngineMove: player2Uci, bestEngineScore: CHECKMATE_SCORE,
          turnStartFen, winnerId: 'player2', loserId: 'player1',
          loserFrom: player1From, loserTo: player1To,
          alternatives: [], youMatchedEngine: false, teammateMatchedEngine: true,
        }
        this.stats.movesPlayed++
        this.stats.conflicts++
        this.stats.syncRate = (this.stats.syncRate * (this.stats.movesPlayed - 1)) / this.stats.movesPlayed
        this.stats.player1Accuracy = ((this.stats.player1Accuracy * (this.stats.movesPlayed - 1)) + 0) / this.stats.movesPlayed
        this.stats.player2Accuracy = ((this.stats.player2Accuracy * (this.stats.movesPlayed - 1)) + 100) / this.stats.movesPlayed
        this.gameState.resolve(player2Move)
        if (this.gameState.board.isGameOver()) this._status = GameStatus.GAME_OVER
        this.notifyStateChange()
        await this._finishResolution(currentTeam, player2Move)
        return { winnerId: 'player2', winningMove: player2Move }
      }
    } catch (e) { DEBUG && console.error('[OnlineGame] Failed to check isCheckmate (2):', e) }
    
    const evalResults = await this.evaluator.evaluateMoves([player1Uci, player2Uci], turnStartFen)
    
    const scoreMap = new Map<string, number>(evalResults.map(r => [r.move, r.score]))
    
    const bestResult = evalResults.reduce((a, b) => a.score > b.score ? a : b, evalResults[0])
    const bestMoveScore = bestResult?.score ?? 0
    const bestMoveUci = bestResult?.move ?? ''
    
    const player1Score = scoreMap.get(player1Uci) ?? 0
    const player2Score = scoreMap.get(player2Uci) ?? 0

    const player1Loss = Math.abs(bestMoveScore - player1Score)
    const player2Loss = Math.abs(bestMoveScore - player2Score)
    
    if (isSync) {
      DEBUG && console.log(`[SYNC] Both players chose the same move: ${player1Move}`)
    }

    const player1Accuracy = calculateAccuracy(player1Loss)
    const player2Accuracy = calculateAccuracy(player2Loss)
    const player1Category = getAccuracyCategory(player1Loss)
    const player2Category = getAccuracyCategory(player2Loss)

    DEBUG && console.log(`\n[EVALUATION] (from: ${turnStartFen.substring(0, 50)}...)`)
    DEBUG && console.log(`  [Optimal] ${bestMoveUci}: score=${bestMoveScore}`)
    DEBUG && console.log(`  [${player1Id}] ${player1Move} (${player1Uci}): score=${player1Score} | loss=${player1Loss}cp | accuracy=${player1Accuracy.toFixed(1)}%`)
    DEBUG && console.log(`  [${player2Id}] ${player2Move} (${player2Uci}): score=${player2Score} | loss=${player2Loss}cp | accuracy=${player2Accuracy.toFixed(1)}%`)

    const winningMove = player1Loss < player2Loss ? player1Move : (player2Loss < player1Loss ? player2Move : player1Move)
    const winningScore = winningMove === player1Move ? player1Score : player2Score
    const chosenLoss = winningMove === player1Move ? player1Loss : player2Loss
    const winnerId: 'player1' | 'player2' = isSync ? 'player1' : (winningMove === player1Move ? 'player1' : 'player2')
    const loserId: 'player1' | 'player2' | null = isSync ? null : (winningMove === player1Move ? 'player2' : 'player1')
    const loserFrom = loserId === 'player2' ? player2From : (loserId === 'player1' ? player1From : '')
    const loserTo = loserId === 'player2' ? player2To : (loserId === 'player1' ? player1To : '')

    DEBUG && console.log(`[RESULT] Winner: ${winnerId} with move: ${winningMove} (accuracy: ${winnerId === 'player1' ? player1Accuracy : player2Accuracy}%)`)
    
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
    DEBUG && console.log(`[RESULT] Storing comparison for team: ${currentTeam}`)
    if (currentTeam === Team.WHITE) {
      DEBUG && console.log(`[RESULT] Storing WHITE comparison:`, { player1Move, player2Move, isSync })
      this._whiteComparison = this._lastMoveComparison
    } else {
      DEBUG && console.log(`[RESULT] Storing BLACK comparison:`, { player1Move, player2Move, isSync })
      this._blackComparison = this._lastMoveComparison
    }

    // Set lastMove for board animation — use from/to directly to handle castling
    if (winnerId === 'player1') {
      this._lastMove = { from: player1From, to: player1To }
    } else if (winnerId === 'player2') {
      this._lastMove = { from: player2From, to: player2To }
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

    await this._finishResolution(currentTeam, winningMove)

    // Notify coordinator client with fresh comparison (setOnStateChange needs this)
    this.notifyStateChange()

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
    if (this._submissionChannel) {
      realtimeMetrics.onChannelRemoved(`submissions:${this._gameId}`)
      await supabase.removeChannel(this._submissionChannel)
      this._submissionChannel = null
    }
    if (this._gameStatusChannel) {
      realtimeMetrics.onChannelRemoved(`game-status:${this._room?.id || ''}`)
      await supabase.removeChannel(this._gameStatusChannel)
      this._gameStatusChannel = null
    }
    if (this._channel) {
      realtimeMetrics.onChannelRemoved(`room:${this._room?.id || ''}`)
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
        payload: { playerId: this._playerId, team: this._team }
      })
    }

    // Persist GAME_OVER to the games table BEFORE cleanup so the non-resigning
    // client can detect it via postgres_changes even if the broadcast is lost.
    if (this._room) {
      try {
        await saveGameState(
          this._room.id,
          this.gameState.fen,
          this.gameState.currentTeam === Team.WHITE ? 'WHITE' : 'BLACK',
          null,
          GameStatus.GAME_OVER,
          undefined,
          undefined,
          this._currentTurnNumber,
          this._coordinatorId
        )
      } catch (e) {
        // A failed resignation persist must not block the local GAME_OVER
        // transition or the match_abandoned broadcast to the peer.
        console.error('[ONLINE] ❌ Failed to persist resignation:', e)
      }
    }

    if (this._room) {
      await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', this._room.id)
    }

    this._status = GameStatus.GAME_OVER
    this._gameOverResult = `Resigned - ${this._team === 'WHITE' ? 'Black' : 'White'} wins`
    this._gameOverReason = 'resignation'
    this.onAbandonCallback?.()
    await this.leaveRoom()
  }

  private resolvePendingWaiter(): void {
    if (this.resolveTeammateLocked) {
      this.resolveTeammateLocked()
      this.resolveTeammateLocked = null
    }
    if (this.resolveTurnChange) {
      this.resolveTurnChange()
      this.resolveTurnChange = null
    }
    if (this._turnChangeTimeout) {
      clearTimeout(this._turnChangeTimeout)
      this._turnChangeTimeout = null
    }
  }

  setOnAbandonCallback(callback: () => void): void {
    this.onAbandonCallback = callback
  }

  private handleMatchAbandoned(payload: { playerId: string; team?: 'WHITE' | 'BLACK' }): void {
    if (this._status === GameStatus.GAME_OVER) return
    this._status = GameStatus.GAME_OVER
    const winnerTeam = payload.team === 'WHITE' ? 'Black' : payload.team === 'BLACK' ? 'White' : 'Opponent'
    this._gameOverResult = `Resigned - ${winnerTeam} wins`
    this._gameOverReason = 'resignation'
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval)
      this._pollingInterval = null
    }
    this.stopMatchTimer()
    this.resolvePendingWaiter()
    this.notifyStateChange()
  }

  private handleMatchTimeoutBroadcast(payload: { result: string; reason: string }): void {
    if (this._status === GameStatus.GAME_OVER) return
    this._status = GameStatus.GAME_OVER
    this._gameOverResult = payload.result
    this._gameOverReason = payload.reason
    if (this._timerSyncInterval) {
      clearInterval(this._timerSyncInterval)
      this._timerSyncInterval = null
    }
    this.stopMatchTimer()
    this.resolvePendingWaiter()
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