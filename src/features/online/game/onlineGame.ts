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
  comparison?: MoveComparison | null
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
  private gameSaved = false
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
      console.log('[ONLINE] Already joined, skipping')
      return
    }
    
    this._room = room
    this._playerId = playerId
    this._team = team

    // If room is already playing (late joiner), ensure status shows correctly
    if (room.status === 'playing') {
      this._status = GameStatus.PLAYING
      console.log('[ONLINE] Late joiner - game already in progress')
    }

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
        
        // Start game when:
        // 1. Both players online (2+ players), OR
        // 2. At least 1 player (single player mode with bots)
        if (playersOnline.length >= 1) {
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
    
    // Immediately add the player to game state so game can start
    const playerTeam = this._team === 'WHITE' ? Team.WHITE : Team.BLACK
    this.gameState.addPlayer(playerId as Player, playerTeam)
    
    // Add bot teammates/opponents based on team
    if (this._team === 'WHITE') {
      this.gameState.addPlayer('player2' as Player, Team.WHITE)
      this.gameState.addPlayer('bot_opponent_1' as Player, Team.BLACK)
      this.gameState.addPlayer('bot_opponent_2' as Player, Team.BLACK)
    } else {
      this.gameState.addPlayer('player2' as Player, Team.BLACK)
      this.gameState.addPlayer('bot_opponent_1' as Player, Team.WHITE)
      this.gameState.addPlayer('bot_opponent_2' as Player, Team.WHITE)
    }
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

      // Players are already added in joinRoom, just ensure team is ready
      // Bots were already added in joinRoom as well

      // Start the game
      this.gameState.startMatch()
      this._status = GameStatus.PLAYING
      this.startPendingTurn()
      this.notifyStateChange()

      // Update room status in database
      if (this._room) {
        await supabase.from('rooms').update({ status: 'playing' }).eq('id', this._room.id)
        console.log('[ONLINE] Room status updated to playing')
      }

      console.log('[ONLINE] Game started successfully')
    } catch (e) {
      console.error('[ONLINE] Failed to start game:', e)
    } finally {
      this.starting = false
    }
  }

  private async syncGameState(): Promise<void> {
    console.log('[ONLINE] Syncing game state (late joiner)...')
    try {
      // Query room to get game log and current state
      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', this._room!.id)
        .single()

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

      // Add bots if not present
      try {
        this.gameState.addPlayer('bot_opponent_1' as Player, Team.BLACK)
      } catch (e) {}
      try {
        this.gameState.addPlayer('bot_opponent_2' as Player, Team.BLACK)
      } catch (e) {}

      // Restore board from game log if exists
      if (room?.game_log && Array.isArray(room.game_log) && room.game_log.length > 0) {
        console.log('[ONLINE] Found game log with', room.game_log.length, 'entries, restoring board...')
        this.restoreFromGameLog(room.game_log)
      }

      console.log('[ONLINE] Game state synced successfully')
    } catch (e) {
      console.error('[ONLINE] Failed to sync game state:', e)
    }
  }

  private restoreFromGameLog(gameLog: any[]): void {
    try {
      // Create fresh chess board
      const chess = new Chess()
      
      // Replay all moves from game log (only 'M' entries, not 'F' resolution entries)
      for (const entry of gameLog) {
        if (entry.type === 'M') {
          const uciMove = entry.move // UCI format: e2e4
          if (uciMove && uciMove.length >= 4) {
            try {
              chess.move(uciMove, { strict: false })
            } catch (e) {
              console.warn('[ONLINE] Could not replay move:', uciMove, e)
            }
          }
        }
      }
      
      // Reset game state with restored board
      this.gameState.resetBoard(chess)
      console.log('[ONLINE] Board restored to FEN:', chess.fen())
    } catch (e) {
      console.error('[ONLINE] Failed to restore from game log:', e)
    }
  }

  private handleTeammateMove(payload: { playerId: string; move: string; from: string; to: string }) {
    console.log('[ONLINE] Teammate moved:', payload)
    if (payload.playerId !== this._playerId) {
      this.gameState.setPendingMove(payload.playerId as Player, payload.move, payload.from, payload.to, 'unknown')
      // Store move in UCI format (from + to)
      this.gameState.logPlayerMove(payload.playerId as Player, payload.from + payload.to)
      
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

  private handleTurnResolved(payload: { winningTeam: string; winningMove: string; comparison?: MoveComparison | null }) {
    console.log('[ONLINE] Turn resolved:', payload)
    console.log('[ONLINE] Current phase:', this.gameState.phase, 'currentTurn:', this.gameState.currentTeam)
    
    // If comparison data is provided (from coordinator), use it
    // This ensures both players see the same accuracy stats
    if (payload.comparison) {
      console.log('[SYNC] Setting comparison from coordinator broadcast')
      this._lastMoveComparison = payload.comparison
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
      console.log('[SAVE] Game over detected, saving...')
      this.saveGameToDatabase().catch(e => console.error('[SAVE] Error:', e))
    } else {
      // Save game log after each turn - this is the foundational truth
      this.saveGameLogOnly().catch(e => console.error('[SAVE] Error:', e))
    }
    this.notifyStateChange()
  }

  async broadcastMove(move: string, from: string, to: string): Promise<void> {
    if (!this._channel) return

    // Store move in UCI format (from + to)
    const uciMove = from + to
    this.gameState.logPlayerMove(this._playerId as Player, uciMove)

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
    this.turnState = 'resolving'
    console.log('[STATE] Resolving, set turnState to resolving')
    
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
    
    // Log both player moves for this turn
    this.gameState.logPlayerMove(player1Id as Player, player1From + player1To)
    this.gameState.logPlayerMove(player2Id as Player, player2From + player2To)

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
    const winningMoveUci = winningMove === player1Move ? player1From + player1To : player2From + player2To
    const winningScore = winningMove === player1Move ? player1Score : player2Score
    const chosenLoss = winningMove === player1Move ? player1Loss : player2Loss
    const winnerId: 'player1' | 'player2' = isSync ? 'player1' : (winningMove === player1Move ? 'player1' : 'player2')
    const loserId: 'player1' | 'player2' | null = isSync ? null : (winningMove === player1Move ? 'player2' : 'player1')
    const loserFrom = loserId === 'player2' ? player2From : (loserId === 'player1' ? player1From : '')
    const loserTo = loserId === 'player2' ? player2To : (loserId === 'player1' ? player1To : '')

    console.log(`[RESULT] Winner: ${winnerId} with move: ${winningMove} (accuracy: ${winnerId === 'player1' ? player1Accuracy : player2Accuracy}%)`)
    
    // Store the comparison for UI
    this._lastMoveComparison = {
      player1Move: player1Uci,
      player2Move: player2Uci,
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

    // Set lastMove for board animation
    const moveParts = this.getMoveParts(winningMove, this.gameState.board.fen())
    if (moveParts) {
      this._lastMove = moveParts
    }

    // Log the resolution to game log
    const winnerPlayerId = winnerId === 'player1' ? player1Id : player2Id
    this.gameState.logResolution(winningMoveUci, winnerPlayerId as Player, player1Accuracy / 100, player2Accuracy / 100)

    this.gameState.resolve(winningMove)

    // Save game log after EVERY turn - this is the foundational truth
    await this.saveGameLogOnly()

    if (this._channel) {
      await this._channel.send({
        type: 'broadcast',
        event: 'turn_resolved',
        payload: { 
          winningTeam: currentTeam, 
          winningMove,
          // Send comparison data so both players see the same stats
          comparison: this._lastMoveComparison
        }
      })
    }

    if (this.gameState.board.isGameOver()) {
      this._status = GameStatus.GAME_OVER
      // Save full game data (including team dynamics) on game over
      await this.saveGameToDatabase()
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

  getGameLog() {
    return this.gameState.getGameLog()
  }

  async saveGameLogOnly(): Promise<void> {
    if (!this._room) return
    
    const gameLog = this.gameState.getGameLogJSON()
    console.log('[SAVE] Saving game log after turn, entries:', this.gameState.getGameLog().length)
    
    try {
      await supabase
        .from('rooms')
        .update({ game_log: gameLog })
        .eq('id', this._room.id)
    } catch (e) {
      console.error('[SAVE] Failed to save game log:', e)
    }
  }

  async saveGameToDatabase(): Promise<void> {
    if (this.gameSaved) {
      console.log('[SAVE] Game already saved, skipping')
      return
    }
    
    if (!this._room) {
      console.log('[SAVE] No room, skipping save')
      return
    }

    this.gameSaved = true

    const gameLog = this.gameState.getGameLogJSON()
    const outcome = this.gameState.board.isGameOver() 
      ? this.gameState.board.isCheckmate() 
        ? 'checkmate' 
        : this.gameState.board.isDraw() 
          ? 'draw' 
          : 'resigned'
      : null

    const result = this._status === GameStatus.GAME_OVER 
      ? this.gameState.board.isCheckmate() 
        ? (this.gameState.board.turn() === 'w' ? '0-1' : '1-0')
        : this.gameState.board.isDraw() 
          ? '1/2-1/2' 
          : '*'
      : '*'

    console.log('[SAVE] Saving game to database:', { 
      roomId: this._room.id, 
      gameLogLength: gameLog.length,
      outcome,
      result
    })

    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          game_log: gameLog,
          outcome: outcome,
          result: { result, game_log: this.gameState.getGameLog() },
          status: 'finished'
        })
        .eq('id', this._room.id)

      if (error) {
        console.error('[SAVE] Failed to save game:', error)
      } else {
        console.log('[SAVE] Game saved successfully')
        
        // Save team dynamics
        await this.saveTeamDynamics()
      }
    } catch (e) {
      console.error('[SAVE] Error saving game:', e)
    }
  }

  private async saveTeamDynamics(): Promise<void> {
    const gameLog = this.gameState.getGameLog()
    
    // Calculate sync rate
    const teamATurns = gameLog.filter(e => e.team === 'A' && e.p === 'F')
    const teamBTurns = gameLog.filter(e => e.team === 'B' && e.p === 'F')
    
    let syncCount = 0
    let conflictCount = 0
    
    for (const entry of teamATurns) {
      if (entry.a1 !== undefined && entry.a2 !== undefined) {
        // Same accuracy = same move (sync)
        if (Math.abs(entry.a1 - entry.a2) < 0.01) {
          syncCount++
        } else {
          conflictCount++
        }
      }
    }

    for (const entry of teamBTurns) {
      if (entry.a1 !== undefined && entry.a2 !== undefined) {
        if (Math.abs(entry.a1 - entry.a2) < 0.01) {
          syncCount++
        } else {
          conflictCount++
        }
      }
    }

    const totalTurns = teamATurns.length + teamBTurns.length
    const syncRate = totalTurns > 0 ? syncCount / totalTurns : 0
    const learningMoments = conflictCount

    // Calculate average accuracy
    const whiteAccuracy = teamATurns.length > 0 
      ? teamATurns.reduce((sum, e) => sum + (e.a1 || 0), 0) / teamATurns.length 
      : 0
    const blackAccuracy = teamBTurns.length > 0 
      ? teamBTurns.reduce((sum, e) => sum + (e.a1 || 0), 0) / teamBTurns.length 
      : 0

    console.log('[DYNAMICS] Saving team dynamics:', { syncRate, conflictCount, whiteAccuracy, blackAccuracy })

    try {
      await supabase
        .from('team_dynamics')
        .insert({
          room_id: this._room!.id,
          sync_rate: syncRate,
          total_conflicts: conflictCount,
          learning_moments: learningMoments,
          white_accuracy: whiteAccuracy,
          black_accuracy: blackAccuracy
        })
    } catch (e) {
      console.error('[DYNAMICS] Failed to save:', e)
    }
  }
}