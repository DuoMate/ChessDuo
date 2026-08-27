'use client'

import { Chess } from 'chess.js'
import { supabase } from './supabase'
import { createEvaluator, GameEvaluator } from '@/features/mobile-engine/evaluatorFactory'
import { calculateAccuracy } from '@/features/shared/accuracy'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { subscriptionManager } from './subscriptionManager'
import { RealtimeService } from './realtimeService'
import { realtimeMetrics } from './realtimeMetrics'

export interface DuelPlayerState {
  id: string
  team: 'WHITE' | 'BLACK'
  connected: boolean
}

export interface DuelGameState {
  fen: string
  status: 'waiting' | 'playing' | 'game_over'
  currentTurn: 'w' | 'b'
  whitePlayer: DuelPlayerState | null
  blackPlayer: DuelPlayerState | null
  whiteTimeRemaining: number
  blackTimeRemaining: number
  matchTimerActive: boolean
  lastMove: { from: string; to: string } | null
  winner: 'white' | 'black' | 'draw' | null
  gameResult: string | null
  gameOverReason: string | null
  moveHistory: string[]
  moveAccuracy: number | null
  opponentAccuracy: number | null
  pollTimeout?: boolean
  disconnectedAgeMs: number
}

export type DuelEventCallback = (state: DuelGameState) => void

export class DuelGame {
  private chess: Chess
  private _roomId: string
  private _playerId: string
  private _team: 'WHITE' | 'BLACK'
  private _timeLimit: number
  private _status: 'waiting' | 'playing' | 'game_over' = 'waiting'
  private _channel: RealtimeChannel | null = null
  private _whitePlayer: DuelPlayerState | null = null
  private _blackPlayer: DuelPlayerState | null = null
  private _whiteTimeRemaining: number
  private _blackTimeRemaining: number
  private _matchTimerActive = false
  private _timerInterval: ReturnType<typeof setInterval> | null = null
  private _lastMove: { from: string; to: string } | null = null
  private _winner: 'white' | 'black' | 'draw' | null = null
  private _gameResult: string | null = null
  private _gameOverReason: string | null = null
  private _moveHistory: string[] = []
  private _moveAccuracy: number | null = null
  private _opponentAccuracy: number | null = null
  private onStateChange: DuelEventCallback | null = null
  private onOpponentMove: ((fen: string) => void) | null = null
  private evaluator: GameEvaluator | null = null
  private _pollingInterval: ReturnType<typeof setInterval> | null = null
  private _pollIterations = 0
  private static readonly MAX_POLL_ITERATIONS = 30
  private _disconnectedAt: number | null = null
  private _disconnectCheckInterval: ReturnType<typeof setInterval> | null = null
  // C5: last wall-clock tick timestamp — lets a backgrounded client catch its
  // displayed clock up with real elapsed time on return to the foreground.
  private _lastTickAt: number = Date.now()
  // C5: bound visibilitychange handler (removed in destroy()).
  private _visibilityHandler: (() => void) | null = null

  constructor(roomId: string, playerId: string, team: 'WHITE' | 'BLACK', timeLimit: number) {
    this.chess = new Chess()
    this._roomId = roomId
    this._playerId = playerId
    this._team = team
    this._timeLimit = timeLimit
    this._whiteTimeRemaining = timeLimit
    this._blackTimeRemaining = timeLimit
    this.evaluator = createEvaluator()
  }

  get status() { return this._status }
  get fen() { return this.chess.fen() }
  get currentTurn() { return this.chess.turn() as 'w' | 'b' }
  get whitePlayer() { return this._whitePlayer }
  get blackPlayer() { return this._blackPlayer }
  get whiteTimeRemaining() { return this._whiteTimeRemaining }
  get blackTimeRemaining() { return this._blackTimeRemaining }
  get matchTimerActive() { return this._matchTimerActive }
  get lastMove() { return this._lastMove }
  get winner() { return this._winner }
  get gameResult() { return this._gameResult }
  get moveHistory() { return this._moveHistory }
  get moveAccuracy() { return this._moveAccuracy }
  get opponentAccuracy() { return this._opponentAccuracy }
  get playerId() { return this._playerId }
  get team() { return this._team }
  get disconnectedAgeMs(): number {
    if (!this._disconnectedAt) return 0
    return Date.now() - this._disconnectedAt
  }

  get state(): DuelGameState {
    return {
      fen: this.fen,
      status: this._status,
      currentTurn: this.currentTurn,
      whitePlayer: this._whitePlayer,
      blackPlayer: this._blackPlayer,
      whiteTimeRemaining: this._whiteTimeRemaining,
      blackTimeRemaining: this._blackTimeRemaining,
      matchTimerActive: this._matchTimerActive,
      lastMove: this._lastMove,
      winner: this._winner,
      gameResult: this._gameResult,
      gameOverReason: this._gameOverReason,
      moveHistory: this._moveHistory,
      moveAccuracy: this._moveAccuracy,
      opponentAccuracy: this._opponentAccuracy,
      disconnectedAgeMs: this.disconnectedAgeMs,
    }
  }

  setOnStateChange(cb: DuelEventCallback) {
    this.onStateChange = cb
  }

  setOnOpponentMove(cb: (fen: string) => void) {
    this.onOpponentMove = cb
  }

  private notify() {
    this.onStateChange?.(this.state)
  }

  isMyTurn(): boolean {
    if (this._status !== 'playing') return false
    const turn = this.chess.turn()
    return (turn === 'w' && this._team === 'WHITE') || (turn === 'b' && this._team === 'BLACK')
  }

  isPlayerWhite(): boolean {
    return this._team === 'WHITE'
  }

  async join() {
    this._channel = supabase.channel(`room:${this._roomId}`, {
      config: { presence: { key: this._playerId } }
    })
    subscriptionManager.register(this._channel)

    const tag = this._team === 'WHITE' ? '_WHITE' : '_BLACK'
    const roomId = this._roomId

    const setupListeners = () => {
      this._channel!
        .on('presence', { event: 'sync' }, () => {
          const state = this._channel?.presenceState() || {}
          const playersOnline = Object.keys(state)
          for (const pid of playersOnline) {
            const isWhite = pid === roomId + '_WHITE'
            if (isWhite) {
              this._whitePlayer = { id: pid, team: 'WHITE', connected: true }
            } else {
              this._blackPlayer = { id: pid, team: 'BLACK', connected: true }
            }
          }
          if (playersOnline.length >= 2 && this._status === 'waiting') {
            this.startGame()
          }
          this.notify()
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          for (const p of newPresences) {
            const pid = p.player_id as string
            if (pid.endsWith('_WHITE')) {
              this._whitePlayer = { id: pid, team: 'WHITE', connected: true }
            } else {
              this._blackPlayer = { id: pid, team: 'BLACK', connected: true }
            }
          }
          if (this._whitePlayer && this._blackPlayer && this._status === 'waiting') {
            this.startGame()
          }
          this.notify()
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          for (const p of leftPresences) {
            const pid = p.player_id as string
            if (pid === this._whitePlayer?.id) {
              this._whitePlayer = { ...this._whitePlayer, connected: false }
            } else if (pid === this._blackPlayer?.id) {
              this._blackPlayer = { ...this._blackPlayer, connected: false }
            }
          }
          if (!this._disconnectedAt && this._status === 'playing') {
            this._disconnectedAt = Date.now()
          }
          this.notify()
        })
        .on('presence', { event: 'join' }, () => {
          if (this._disconnectedAt) {
            this._disconnectedAt = null
            if (this._whitePlayer) this._whitePlayer = { ...this._whitePlayer, connected: true }
            if (this._blackPlayer) this._blackPlayer = { ...this._blackPlayer, connected: true }
            this.notify()
          }
        })
        .on('broadcast', { event: 'duel_move' }, ({ payload }) => {
          this.handleOpponentMove(payload as { move: string })
        })
        .on('broadcast', { event: 'duel_game_over' }, ({ payload }) => {
          this.handleGameOverBroadcast(payload as { winner: string; result: string; reason: string })
        })
    }

    setupListeners()

    this._channel!.subscribe(async (status) => {
      realtimeMetrics.onSubscribeStatus(`room:${this._roomId}`, status)
      if (status === 'CHANNEL_ERROR') {
        console.warn('[DUEL] Channel error — reconnecting...')
        try { supabase.removeChannel(this._channel!) } catch (e) { console.error('[DuelGame] Failed to remove channel:', e) }
        // Force-tear-down any stale channel with the same topic. When the socket
        // is dead, removeChannel's unsubscribe() can time out and leave the old
        // channel registered; re-creating the topic would reuse it and make the
        // `.on(...)` calls below throw.
        RealtimeService.forceRemoveStaleChannels(`room:${roomId}`)
        this._channel = supabase.channel(`room:${roomId}`, {
          config: { presence: { key: this._playerId } }
        })
        subscriptionManager.register(this._channel)
        setupListeners()
        this._channel.subscribe(async (s) => {
          realtimeMetrics.onSubscribeStatus(`room:${roomId}`, s)
          if (s === 'SUBSCRIBED') {
            realtimeMetrics.onReconnectSuccess(`room:${roomId}`)
            await this._channel?.track({ player_id: this._playerId + tag, team: this._team })
            this._syncFromDB()
          }
        })
        return
      }
      if (status === 'SUBSCRIBED') {
        await this._channel?.track({ player_id: this._playerId + tag, team: this._team })
        // C5 #3: reconcile from the authoritative row right after subscribing —
        // realtime broadcasts alone miss events; DB reconstruction is required
        // for refresh/reconnect/late-join correctness.
        try {
          const outcome = await this._syncFromDB()
          console.log('[DUEL][SUBSCRIBE] Post-subscribe reconciliation:', JSON.stringify({ roomId: this._roomId, outcome }))
          this.checkExpiredClockAuthority()
          this.notify()
        } catch (e) {
          console.error('[DUEL][SUBSCRIBE] Reconciliation failed:', JSON.stringify({ roomId: this._roomId, errorMessage: String((e as Error)?.message || e) }))
        }
      }
    })

    // C5 #5: recover from background throttling / mobile suspension — the
    // authoritative row is re-read when the app becomes visible again.
    if (typeof document !== 'undefined' && !this._visibilityHandler) {
      this._visibilityHandler = () => {
        if (document.visibilityState !== 'visible') return
        if (!this._channel) return
        void this._syncFromDB().then((outcome) => {
          this.checkExpiredClockAuthority()
          this.notify()
          if (outcome !== 'error' && outcome !== 'no-row') {
            console.log('[DUEL][RECONCILE] Visibility reconciliation:', JSON.stringify({ roomId: this._roomId, outcome }))
          }
        })
      }
      document.addEventListener('visibilitychange', this._visibilityHandler)
    }

    this._pollingInterval = setInterval(async () => {
      if (this._status !== 'waiting') {
        clearInterval(this._pollingInterval!)
        return
      }
      const { data } = await supabase
        .from('duel_games')
        .select('*')
        .eq('room_id', this._roomId)
        .single()
      if (data && data.player_black && data.status === 'playing') {
        this.startGame()
        clearInterval(this._pollingInterval!)
      }
    }, 2000)
  }

  private async startGame() {
    // C5 #8: terminal games are immutable — never restart board/clocks.
    if (this._status === 'playing' || this._status === 'game_over') return

    // C5 #4: reconcile BEFORE initializing. An existing duel_games row with
    // active or terminal state wins over a fresh initial position — a refresh
    // mid-duel must never reset the board.
    let outcome: Awaited<ReturnType<typeof this._syncFromDB>> = 'no-row'
    try {
      outcome = await this._syncFromDB()
    } catch (e) {
      console.error('[DUEL][RECONCILE] Pre-start sync failed:', JSON.stringify({
        roomId: this._roomId,
        errorMessage: String((e as Error)?.message || e),
      }))
    }
    if (outcome === 'restored-game-over') {
      if (this._pollingInterval) clearInterval(this._pollingInterval)
      this.notify()
      return
    }

    this._status = 'playing'
    this._matchTimerActive = true
    this._lastTickAt = Date.now()
    // NOTE: when outcome === 'restored-playing', fen/move_history/clocks were
    // already loaded by _syncFromDB onto this.chess — no fresh init here.

    this._timerInterval = setInterval(() => {
      if (this._status !== 'playing') return
      // C5 #6: elapsed-time based decrement (throttle-safe), not tick-count.
      this.advanceClockByElapsed()
      const isWhiteTurn = this.chess.turn() === 'w'
      const remaining = isWhiteTurn ? this._whiteTimeRemaining : this._blackTimeRemaining
      if (remaining <= 0) {
        this.checkExpiredClockAuthority()
        this.notify()
        return
      }
      this.notify()
    }, 1000)
    this._disconnectCheckInterval = setInterval(() => {
      if (this._status !== 'playing') return
      if (!this._disconnectedAt) return
      if (Date.now() - this._disconnectedAt > 35000) {
        const opponentWins = this._team === 'WHITE' ? 'black' : 'white'
        void this.handleForfeit(opponentWins)
      }
    }, 1000)
    // C5 #7: a restored game may already be past its clock deadline.
    this.checkExpiredClockAuthority()
    this.notify()
  }

  /**
   * C5: targeted update of the authoritative duel_games row. Returns false on
   * failure (logged loudly) so callers can decide rollback/retry — never
   * silently swallowed.
   */
  private async persistGameState(fields: Record<string, unknown>): Promise<boolean> {
    const { error } = await supabase
      .from('duel_games')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('room_id', this._roomId)
    if (error) {
      console.error('[DUEL][PERSIST] Failed to persist duel state:', JSON.stringify({
        roomId: this._roomId,
        status: fields.status ?? this._status,
        moveNumber: Array.isArray(fields.move_history) ? fields.move_history.length : this._moveHistory.length,
        errorMessage: error.message,
      }))
      return false
    }
    return true
  }

  /**
   * C5: persist the terminal result BEFORE it is broadcast (spec: never
   * broadcast a GAME_OVER that does not exist in the DB). One bounded retry
   * after a short delay; if both attempts fail the peer's own deterministic
   * authority / later DB reconciliation still converges the game.
   */
  private async persistGameOver(
    winner: 'white' | 'black' | 'draw',
    result: string,
    reason: string,
  ): Promise<boolean> {
    const payload = {
      status: 'game_over',
      winner,
      game_result: result,
      game_over_reason: reason,
      white_time_remaining: this._whiteTimeRemaining,
      black_time_remaining: this._blackTimeRemaining,
    }
    let ok = await this.persistGameState(payload)
    if (!ok) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      ok = await this.persistGameState(payload)
    }
    return ok
  }

  /**
   * C5: apply a terminal result locally WITHOUT broadcasting — used by DB
   * reconciliation (the broadcast path uses setGameOver which notifies).
   */
  private applyGameOverLocal(winner: 'white' | 'black' | 'draw', result: string, reason: string | null): void {
    this._status = 'game_over'
    this._winner = winner
    this._gameResult = result
    this._gameOverReason = reason
    this.stopTimer()
  }

  /**
   * C5: authoritative reconciliation from duel_games.
   *
   * Returns one of:
   * - 'no-row'        nothing persisted yet
   * - 'waiting'       row exists but match not started
   * - 'restored-playing'  active state restored (fen/history/clocks)
   * - 'restored-game-over' terminal state restored locally
   * - 'up-to-date'    row matches local state
   * - 'error'         query failed
   */
  private async _syncFromDB(): Promise<
    'no-row' | 'waiting' | 'restored-playing' | 'restored-game-over' | 'up-to-date' | 'error'
  > {
    try {
      const { data, error } = await supabase
        .from('duel_games')
        .select('fen, move_history, white_time_remaining, black_time_remaining, status, winner, game_result, game_over_reason')
        .eq('room_id', this._roomId)
        .single()

      if (error || !data) {
        console.warn('[DUEL][RECONCILE] No readable duel_games row:', JSON.stringify({
          roomId: this._roomId,
          errorMessage: error?.message ?? 'no row',
        }))
        return 'no-row'
      }

      // Terminal rows are applied unconditionally — GAME_OVER is immutable and
      // must survive refresh/reconnect regardless of local board state.
      if (data.status === 'game_over') {
        if (this._status === 'game_over') return 'up-to-date'
        console.log('[DUEL][RECONCILE] Restoring GAME_OVER from DB:', JSON.stringify({ roomId: this._roomId, winner: data.winner }))
        if (data.fen) this.chess.load(data.fen)
        if (Array.isArray(data.move_history)) this._moveHistory = data.move_history
        if (data.white_time_remaining !== undefined && data.white_time_remaining !== null) this._whiteTimeRemaining = data.white_time_remaining
        if (data.black_time_remaining !== undefined && data.black_time_remaining !== null) this._blackTimeRemaining = data.black_time_remaining
        this.applyGameOverLocal(
          (data.winner as 'white' | 'black' | 'draw') ?? 'draw',
          data.game_result ?? 'Game Over',
          data.game_over_reason ?? null,
        )
        this.notify()
        return 'restored-game-over'
      }

      if (data.status !== 'playing') return 'waiting'

      // ADR-006-style stale-authority guard: only roll back to the row when it
      // knows MORE chess than we do. A lagging/partially-written row can never
      // drag an ahead client backwards.
      const dbMoveCount = Array.isArray(data.move_history) ? data.move_history.length : 0
      const localMoveCount = this._moveHistory.length
      if (dbMoveCount < localMoveCount) {
        console.warn('[DUEL][RECONCILE] Stale row ignored:', JSON.stringify({ roomId: this._roomId, dbMoveCount, localMoveCount }))
        return 'up-to-date'
      }

      if (data.fen && data.fen !== this.chess.fen()) {
        this.chess.load(data.fen)
        try {
          const last = this.chess.history({ verbose: true } as never).slice(-1)[0] as { from: string; to: string } | undefined
          this._lastMove = last ? { from: last.from, to: last.to } : null
        } catch { /* history unavailable — leave lastMove as-is */ }
      }
      if (Array.isArray(data.move_history)) this._moveHistory = data.move_history
      if (data.white_time_remaining !== undefined && data.white_time_remaining !== null) this._whiteTimeRemaining = data.white_time_remaining
      if (data.black_time_remaining !== undefined && data.black_time_remaining !== null) this._blackTimeRemaining = data.black_time_remaining
      this._lastTickAt = Date.now()
      this.notify()
      return dbMoveCount === localMoveCount && !data.fen ? 'up-to-date' : 'restored-playing'
    } catch (e) {
      console.error('[DUEL][RECONCILE] Failed to sync from DB:', JSON.stringify({
        roomId: this._roomId,
        errorMessage: String((e as Error)?.message || e),
      }))
      return 'error'
    }
  }

  /**
   * C5 #6/#7: advance the side-to-move's clock by REAL elapsed time since the
   * last tick (not by tick count). Steady state elapsed === 1s (identical to
   * the old behavior); a throttled/suspended tab catches up on its next fire
   * instead of freezing the clock. Display/decision input only — authoritative
   * clocks re-converge at every persisted move.
   */
  private advanceClockByElapsed(): void {
    if (this._status !== 'playing') return
    const now = Date.now()
    const elapsedSec = Math.max(0, Math.floor((now - this._lastTickAt) / 1000))
    this._lastTickAt = now
    if (elapsedSec <= 0) return
    const isWhiteTurn = this.chess.turn() === 'w'
    if (isWhiteTurn) {
      this._whiteTimeRemaining = Math.max(0, this._whiteTimeRemaining - elapsedSec)
    } else {
      this._blackTimeRemaining = Math.max(0, this._blackTimeRemaining - elapsedSec)
    }
  }

  /**
   * C5 #7: single deterministic timeout declarer — the OPPONENT of the expired
   * side decides (so both devices can never race two different verdicts).
   * Called from the tick loop and after every reconciliation (covers the case
   * where the losing device was offline when its clock ran out).
   */
  private checkExpiredClockAuthority(): void {
    if (this._status !== 'playing') return
    if (this._whiteTimeRemaining <= 0 && this._team !== 'WHITE') {
      void this.handleTimeout('white')
    } else if (this._blackTimeRemaining <= 0 && this._team !== 'BLACK') {
      void this.handleTimeout('black')
    }
  }

  /**
   * C5 #7: deterministic timeout resolution — the winner is ALWAYS the
   * opposite of the side whose clock expired (engine-independent, so both
   * devices converge on the identical verdict). The authoritative GAME_OVER is
   * persisted BEFORE it is broadcast; an already-terminal game is never
   * overwritten.
   */
  private async handleTimeout(expiredSide: 'white' | 'black') {
    if (this._status === 'game_over') return
    console.log('[DUEL][TIMEOUT] Clock expired:', JSON.stringify({ roomId: this._roomId, expiredSide }))
    this.stopTimer()
    const winner: 'white' | 'black' = expiredSide === 'white' ? 'black' : 'white'
    const result = `${winner === 'white' ? 'White' : 'Black'} wins by timeout`
    const ok = await this.persistGameOver(winner, result, 'timeout')
    if (!ok) {
      // Never broadcast a GAME_OVER that does not exist in the DB. The
      // declaring authority retries via the next tick / reconciliation sweep.
      return
    }
    this.setGameOver(winner, result, 'timeout')
    this.broadcastGameOver(winner, result, 'timeout')
  }

  /**
   * C5: disconnect-forfeit — persisted before broadcast, like every terminal.
   */
  private async handleForfeit(winnerSide: 'white' | 'black') {
    if (this._status === 'game_over') return
    console.log('[DUEL][PERSIST] Disconnect forfeit:', JSON.stringify({ roomId: this._roomId, winnerSide }))
    this.stopTimer()
    const winner = winnerSide
    const result = `${winner === 'white' ? 'White' : 'Black'} wins by forfeit`
    const ok = await this.persistGameOver(winner, result, 'timeout')
    if (!ok) return
    this.setGameOver(winner, result, 'timeout')
    this.broadcastGameOver(winner, result, 'timeout')
  }

  setGameOver(winner: 'white' | 'black' | 'draw', result: string, reason?: string) {
    this._status = 'game_over'
    this._winner = winner
    this._gameResult = result
    this._gameOverReason = reason || null
    this._matchTimerActive = false
    this.stopTimer()
    this.notify()
  }

  private stopTimer() {
    this._matchTimerActive = false
    if (this._timerInterval) {
      clearInterval(this._timerInterval)
      this._timerInterval = null
    }
  }

  canMove(): boolean {
    return this._status === 'playing' && this.isMyTurn()
  }

  async makeMove(uci: string): Promise<{ success: boolean; error?: string; accuracy?: number }> {
    if (!this.canMove()) return { success: false, error: 'Not your turn' }

    try {
      // C5 #14-B/I: reconcile-if-behind BEFORE applying our own move. If we
      // missed the opponent's broadcast, our board is stale and the move would
      // be illegal/incorrect against the authoritative position.
      const fenBeforeSync = this.chess.fen()
      const syncOutcome = await this._syncFromDB()
      if (this._status !== 'playing') return { success: false, error: 'Game is over' }
      if (syncOutcome === 'restored-playing' && this.chess.fen() !== fenBeforeSync) {
        console.log('[DUEL][RECONCILE] Pre-move catch-up applied:', JSON.stringify({ roomId: this._roomId }))
        return { success: false, error: 'Board was out of date — please retry' }
      }

      // Snapshot for rollback if persistence fails — never corrupt local state.
      const fenBefore = this.chess.fen()
      const historyBefore = [...this._moveHistory]
      const lastMoveBefore = this._lastMove
      const whiteTimeBefore = this._whiteTimeRemaining
      const blackTimeBefore = this._blackTimeRemaining

      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci.length > 4 ? uci.slice(4) : undefined
      const move = this.chess.move({ from, to, promotion })
      this._lastMove = { from: move.from, to: move.to }
      this._moveHistory = [...this._moveHistory, move.san]

      let accuracy: number | null = null
      if (this.evaluator) {
        const chess = new Chess(fenBefore)
        const legalMoves = chess.moves({ verbose: true })
        const ucis = legalMoves.map(m => m.from + m.to + (m.promotion || ''))
        try {
          const results = await this.evaluator.evaluateMoves(ucis, fenBefore)
          let bestScore = -Infinity
          let playedScore = 0
          for (const r of results) {
            if (r.move === uci) playedScore = r.score
            if (r.score > bestScore) bestScore = r.score
          }
          const loss = Math.abs(bestScore - playedScore)
          accuracy = calculateAccuracy(loss)
        } catch (e) {
          console.warn('[Duel] Accuracy eval failed:', e)
        }
      }

      if (this.isPlayerWhite()) {
        this._moveAccuracy = accuracy
      } else {
        this._opponentAccuracy = accuracy
      }

      // C5 #2: persist the complete authoritative state and only treat the
      // move as committed once the DB write succeeds. No fire-and-forget.
      const persisted = await this.persistGameState({
        fen: this.chess.fen(),
        move_history: this._moveHistory,
        white_time_remaining: this._whiteTimeRemaining,
        black_time_remaining: this._blackTimeRemaining,
        status: 'playing',
      })
      if (!persisted) {
        // Safe rollback: undo the chess move and restore the snapshot so the
        // player can retry without corrupted state.
        try { this.chess.undo() } catch (e) { console.error('[DUEL][PERSIST] Undo after failed persist threw:', e) }
        this._moveHistory = historyBefore
        this._lastMove = lastMoveBefore
        this._whiteTimeRemaining = whiteTimeBefore
        this._blackTimeRemaining = blackTimeBefore
        this.notify()
        return { success: false, error: 'Persist failed' }
      }

      // Committed → NOW broadcast as authoritative. ply lets the receiver
      // drop stale replays and detect gaps (#9).
      this.broadcastMove(move.san, this._moveHistory.length)
      this.notify()

      if (this.chess.isGameOver()) {
        await this.handleGameOver()
      }

      return { success: true, accuracy: accuracy || undefined }
    } catch (e) {
      return { success: false, error: 'Invalid move' }
    }
  }

  private broadcastMove(san: string, ply?: number) {
    this._channel?.send({
      type: 'broadcast',
      event: 'duel_move',
      payload: ply !== undefined ? { move: san, ply } : { move: san }
    })
  }

  private broadcastGameOver(winner: string, result: string, reason: string) {
    this._channel?.send({
      type: 'broadcast',
      event: 'duel_game_over',
      payload: { winner, result, reason }
    })
  }

  private handleOpponentMove(payload: { move: string; ply?: number }) {
    // C5 #9: never apply a realtime event blindly if persisted state is newer.
    // ply = opponent's move_history length AFTER their move. Absent ply =
    // legacy sender — fall through to the original path (mixed-version safe).
    if (payload.ply !== undefined) {
      if (payload.ply <= this._moveHistory.length) {
        console.warn('[DUEL] Stale duel_move ignored:', JSON.stringify({ roomId: this._roomId, ply: payload.ply, localMoves: this._moveHistory.length }))
        return
      }
      if (payload.ply > this._moveHistory.length + 1) {
        // Gap — we missed at least one event. DB is authoritative: reconcile
        // instead of applying a move onto a stale board.
        console.warn('[DUEL][RECONCILE] duel_move gap detected — reconciling from DB:', JSON.stringify({ roomId: this._roomId, ply: payload.ply, localMoves: this._moveHistory.length }))
        void this._syncFromDB().then(() => this.checkExpiredClockAuthority())
        return
      }
    }

    try {
      this.chess.move(payload.move)
      this._lastMove = { from: (this.chess as any).history({ verbose: true }).slice(-1)[0]?.from, to: (this.chess as any).history({ verbose: true }).slice(-1)[0]?.to }
      this._moveHistory = [...this._moveHistory, payload.move]
      this._lastTickAt = Date.now()
      this.notify()
      this.onOpponentMove?.(this.chess.fen())
      // C5 #5/#14-B: opportunistic self-heal for anything earlier we missed.
      void this._syncFromDB()
      if (this.chess.isGameOver()) {
        void this.handleGameOver()
      }
    } catch (e) {
      console.warn('[Duel] Failed to apply opponent move:', e)
      // The broadcast could not be applied to our board — reconcile from the
      // authoritative row instead of diverging silently.
      void this._syncFromDB()
    }
  }

  private async handleGameOver() {
    this.stopTimer()
    let winner: 'white' | 'black' | 'draw'
    let result: string
    if (this.chess.isCheckmate()) {
      const winningColor = this.chess.turn() === 'w' ? 'black' : 'white'
      winner = winningColor
      result = `${winningColor === 'white' ? 'White' : 'Black'} wins by checkmate`
    } else if (this.chess.isDraw()) {
      winner = 'draw'
      result = 'Draw'
      if (this.chess.isStalemate()) result = 'Draw by stalemate'
      else if (this.chess.isInsufficientMaterial()) result = 'Draw by insufficient material'
      else if (this.chess.isThreefoldRepetition()) result = 'Draw by repetition'
    } else {
      winner = 'draw'
      result = 'Game Over'
    }
    // C5: persist the terminal state BEFORE broadcasting it.
    const ok = await this.persistGameOver(winner, result, this.chess.isCheckmate() ? 'checkmate' : 'draw')
    if (!ok) {
      // Peer reached the same terminal position from duel_move and will
      // persist it; DB reconciliation keeps both devices converged.
      console.error('[DUEL][PERSIST] Terminal persist failed — relying on peer/reconciliation:', JSON.stringify({ roomId: this._roomId }))
      this.applyGameOverLocal(winner, result, this.chess.isCheckmate() ? 'checkmate' : 'draw')
      this.notify()
      return
    }
    this.setGameOver(winner, result)
    this.broadcastGameOver(winner, result, '')
  }

  private handleGameOverBroadcast(payload: { winner: string; result: string; reason: string }) {
    if (this._status !== 'game_over') {
      this.setGameOver(payload.winner as any, payload.result, payload.reason)
    }
  }

  async resign() {
    if (this._status !== 'playing') return
    console.log('[DUEL][PERSIST] Resign:', JSON.stringify({ roomId: this._roomId }))
    this.stopTimer()
    const opponentWins: 'white' | 'black' = this._team === 'WHITE' ? 'black' : 'white'
    const result = opponentWins === 'white' ? 'White wins by resignation' : 'Black wins by resignation'
    // C5: persist BEFORE broadcast so the opponent's reconnect sees GAME_OVER.
    const ok = await this.persistGameOver(opponentWins, result, 'resignation')
    if (!ok) return
    this.setGameOver(opponentWins, result, 'resignation')
    this.broadcastGameOver(opponentWins, result, 'resignation')
  }

  destroy() {
    this.stopTimer()
    if (this._pollingInterval) clearInterval(this._pollingInterval)
    if (this._disconnectCheckInterval) clearInterval(this._disconnectCheckInterval)
    // C5: detach the visibility reconciliation listener with the engine.
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler)
      this._visibilityHandler = null
    }
    if (this._channel) supabase.removeChannel(this._channel)
  }
}
