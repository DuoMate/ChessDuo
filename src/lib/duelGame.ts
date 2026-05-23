'use client'

import { Chess } from 'chess.js'
import { supabase } from './supabase'
import { ServerMoveEvaluator } from '@/features/bots/serverMoveEvaluator'
import { calculateAccuracy } from '@/features/shared/accuracy'
import type { RealtimeChannel } from '@supabase/supabase-js'

const SERVER_URL = process.env.NEXT_PUBLIC_STOCKFISH_SERVER_URL || ''

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
  matchTimeRemaining: number
  matchTimerActive: boolean
  lastMove: { from: string; to: string } | null
  winner: 'white' | 'black' | 'draw' | null
  gameResult: string | null
  moveHistory: string[]
  moveAccuracy: number | null
  opponentAccuracy: number | null
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
  private _matchTimeRemaining: number
  private _matchTimerActive = false
  private _timerInterval: ReturnType<typeof setInterval> | null = null
  private _lastMove: { from: string; to: string } | null = null
  private _winner: 'white' | 'black' | 'draw' | null = null
  private _gameResult: string | null = null
  private _moveHistory: string[] = []
  private _moveAccuracy: number | null = null
  private _opponentAccuracy: number | null = null
  private onStateChange: DuelEventCallback | null = null
  private evaluator: ServerMoveEvaluator | null = null
  private _pollingInterval: ReturnType<typeof setInterval> | null = null

  constructor(roomId: string, playerId: string, team: 'WHITE' | 'BLACK', timeLimit: number) {
    this.chess = new Chess()
    this._roomId = roomId
    this._playerId = playerId
    this._team = team
    this._timeLimit = timeLimit
    this._matchTimeRemaining = timeLimit
    if (SERVER_URL) {
      this.evaluator = new ServerMoveEvaluator(SERVER_URL)
    }
  }

  get status() { return this._status }
  get fen() { return this.chess.fen() }
  get currentTurn() { return this.chess.turn() as 'w' | 'b' }
  get whitePlayer() { return this._whitePlayer }
  get blackPlayer() { return this._blackPlayer }
  get matchTimeRemaining() { return this._matchTimeRemaining }
  get matchTimerActive() { return this._matchTimerActive }
  get lastMove() { return this._lastMove }
  get winner() { return this._winner }
  get gameResult() { return this._gameResult }
  get moveHistory() { return this._moveHistory }
  get moveAccuracy() { return this._moveAccuracy }
  get opponentAccuracy() { return this._opponentAccuracy }
  get playerId() { return this._playerId }
  get team() { return this._team }

  get state(): DuelGameState {
    return {
      fen: this.fen,
      status: this._status,
      currentTurn: this.currentTurn,
      whitePlayer: this._whitePlayer,
      blackPlayer: this._blackPlayer,
      matchTimeRemaining: this._matchTimeRemaining,
      matchTimerActive: this._matchTimerActive,
      lastMove: this._lastMove,
      winner: this._winner,
      gameResult: this._gameResult,
      moveHistory: this._moveHistory,
      moveAccuracy: this._moveAccuracy,
      opponentAccuracy: this._opponentAccuracy,
    }
  }

  setOnStateChange(cb: DuelEventCallback) {
    this.onStateChange = cb
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

    this._channel
      .on('presence', { event: 'sync' }, () => {
        const state = this._channel?.presenceState() || {}
        const playersOnline = Object.keys(state)
        for (const pid of playersOnline) {
          const isWhite = pid === this._roomId + '_WHITE'
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
        this.notify()
      })
      .on('broadcast', { event: 'duel_move' }, ({ payload }) => {
        this.handleOpponentMove(payload as { move: string })
      })
      .on('broadcast', { event: 'duel_game_over' }, ({ payload }) => {
        this.handleGameOverBroadcast(payload as { winner: string; result: string; reason: string })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const tag = this._team === 'WHITE' ? '_WHITE' : '_BLACK'
          await this._channel?.track({ player_id: this._playerId + tag, team: this._team })
        }
      })

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

  private startGame() {
    if (this._status === 'playing') return
    this._status = 'playing'
    this._matchTimerActive = true
    this._timerInterval = setInterval(() => {
      if (this._matchTimeRemaining > 0) {
        this._matchTimeRemaining--
        this.notify()
        if (this._matchTimeRemaining <= 0) {
          this.handleTimeout()
        }
      }
    }, 1000)
    this.notify()
  }

  private async handleTimeout() {
    this.stopTimer()
    const score = this.evaluator ? await this.evaluator.evaluatePosition(this.chess.fen()).catch(() => 0) : 0
    let winner: 'white' | 'black' | 'draw'
    if (score > 0) winner = 'white'
    else if (score < 0) winner = 'black'
    else winner = 'draw'
    const result = winner === 'draw' ? 'Draw by timeout' : (winner === 'white' ? 'White wins by timeout' : 'Black wins by timeout')
    this.setGameOver(winner, result, 'timeout')
    this.broadcastGameOver(winner, result, 'timeout')
  }

  setGameOver(winner: 'white' | 'black' | 'draw', result: string, _reason?: string) {
    this._status = 'game_over'
    this._winner = winner
    this._gameResult = result
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
      const fenBefore = this.chess.fen()
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci.length > 4 ? uci.slice(4) : undefined
      const move = this.chess.move({ from, to, promotion })
      this._lastMove = { from: move.from, to: move.to }
      this._moveHistory.push(move.san)

      let accuracy: number | null = null
      if (this.evaluator) {
        const chess = new Chess(fenBefore)
        const legalMoves = chess.moves({ verbose: true })
        const ucis = legalMoves.map(m => m.from + m.to)
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

      this.broadcastMove(move.san)
      this.notify()

      if (this.chess.isGameOver()) {
        await this.handleGameOver()
      }

      return { success: true, accuracy: accuracy || undefined }
    } catch (e) {
      return { success: false, error: 'Invalid move' }
    }
  }

  private broadcastMove(san: string) {
    this._channel?.send({
      type: 'broadcast',
      event: 'duel_move',
      payload: { move: san }
    })
  }

  private broadcastGameOver(winner: string, result: string, reason: string) {
    this._channel?.send({
      type: 'broadcast',
      event: 'duel_game_over',
      payload: { winner, result, reason }
    })
  }

  private handleOpponentMove(payload: { move: string }) {
    try {
      this.chess.move(payload.move)
      this._lastMove = { from: (this.chess as any).history({ verbose: true }).slice(-1)[0]?.from, to: (this.chess as any).history({ verbose: true }).slice(-1)[0]?.to }
      this._moveHistory.push(payload.move)
      this.notify()
      if (this.chess.isGameOver()) {
        this.handleGameOver()
      }
    } catch (e) {
      console.warn('[Duel] Failed to apply opponent move:', e)
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
    this.setGameOver(winner, result)
    this.broadcastGameOver(winner, result, '')
  }

  private handleGameOverBroadcast(payload: { winner: string; result: string; reason: string }) {
    if (this._status !== 'game_over') {
      this.setGameOver(payload.winner as any, payload.result)
    }
  }

  destroy() {
    this.stopTimer()
    if (this._pollingInterval) clearInterval(this._pollingInterval)
    if (this._channel) supabase.removeChannel(this._channel)
  }
}
