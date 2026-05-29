import { Chess } from 'chess.js'

export enum GamePhase {
  WAITING = 'WAITING',
  SELECTING = 'SELECTING',
  LOCKED = 'LOCKED',
  RESOLVED = 'RESOLVED',
  GAME_OVER = 'GAME_OVER'
}

export enum Team {
  WHITE = 'WHITE',
  BLACK = 'BLACK'
}

export type Player = string

export interface MoveResult {
  move: string
  player: Player
  team: Team
}

export interface CapturedPieces {
  white: string[]
  black: string[]
}

export interface PendingMoveInfo {
  move: string
  isHuman: boolean
  locked: boolean
  from: string
  to: string
  piece: string
}

export class GameState {
  private chess: Chess
  private _phase: GamePhase
  private _currentTeam: Team
  private whitePlayers: Player[]
  private blackPlayers: Player[]
  private selections: Map<Player, string>
  private locked: Set<Player>
  private _capturedByWhite: string[]
  private _capturedByBlack: string[]

  private turnStartFen: string
  private pendingMoves: Map<Player, PendingMoveInfo>
  private _matchTimeRemaining: number
  private _matchTimerActive: boolean

  constructor(timeLimitSeconds: number = 600) {
    this.chess = new Chess()
    this._phase = GamePhase.WAITING
    this._currentTeam = Team.WHITE
    this.whitePlayers = []
    this.blackPlayers = []
    this.selections = new Map()
    this.locked = new Set()
    this._capturedByWhite = []
    this._capturedByBlack = []

    this.turnStartFen = ''
    this.pendingMoves = new Map()
    this._matchTimeRemaining = timeLimitSeconds
    this._matchTimerActive = false
  }

  get phase(): GamePhase {
    return this._phase
  }

  get currentTeam(): Team {
    return this._currentTeam
  }

  get board(): Chess {
    return this.chess
  }

  get fen(): string {
    return this.chess.fen()
  }

  get capturedPieces(): CapturedPieces {
    return {
      white: [...this._capturedByWhite],
      black: [...this._capturedByBlack]
    }
  }

  getPlayers(team: Team): Player[] {
    return team === Team.WHITE ? [...this.whitePlayers] : [...this.blackPlayers]
  }

  addPlayer(player: Player, team: Team): void {
    const players = team === Team.WHITE ? this.whitePlayers : this.blackPlayers
    if (players.length >= 2) {
      throw new Error(`Team ${team} already has 2 players`)
    }
    players.push(player)
  }

  startMatch(): void {
    if (this.whitePlayers.length !== 2 || this.blackPlayers.length !== 2) {
      throw new Error('Both teams must have 2 players to start')
    }
    this._phase = GamePhase.SELECTING
  }

  startPendingTurn(fen: string): void {
    const clearing = this.pendingMoves.size > 0
      ? Array.from(this.pendingMoves.entries()).map(([k, v]) => ({ key: k, move: v.move, locked: v.locked }))
      : null
    if (clearing) {
      console.warn('[DEBUG-startPendingTurn] CLEARING pendingMoves that had entries:', clearing, new Error().stack)
    }
    this.turnStartFen = fen
    this.pendingMoves.clear()
  }

  setPendingMove(player: Player, move: string, from: string, to: string, piece: string): void {
    if (this._phase !== GamePhase.SELECTING && this._phase !== GamePhase.LOCKED) {
      console.warn('[DEBUG-setPendingMove] BLOCKED by phase guard. phase:', this._phase, 'expected SELECTING or LOCKED')
      return
    }

    // In online mode, we use actual player IDs. Determine isHuman based on team.
    // WHITE team = human players, BLACK team = bots (in 2v2 mode)
    const isHuman = this.whitePlayers.includes(player) || (player === 'player1' || player === 'player3')

    this.pendingMoves.set(player, {
      move,
      isHuman,
      locked: false,
      from,
      to,
      piece
    })

    this.selections.set(player, move)
  }

  lockPendingMove(player: Player): void {
    const pending = this.pendingMoves.get(player)
    if (pending) {
      pending.locked = true
      this.locked.add(player)
    } else {
      console.warn('[DEBUG-lockPendingMove] No pending move found for player:', player, 'pendingMoves keys:', Array.from(this.pendingMoves.keys()))
    }

    if (this.areBothTeamPlayersLocked()) {
      this._phase = GamePhase.LOCKED
    }
  }

  isPendingMoveLocked(player: Player): boolean {
    const pending = this.pendingMoves.get(player)
    return pending ? pending.locked : false
  }

  isBothPendingLocked(): boolean {
    const currentPlayers = this._currentTeam === Team.WHITE
      ? this.whitePlayers
      : this.blackPlayers
    const result = currentPlayers.every(p => {
      const pending = this.pendingMoves.get(p)
      return pending && pending.locked
    })
    if (!result) {
      console.log('[DEBUG-isBothPendingLocked] RETURNING FALSE', {
        _currentTeam: this._currentTeam,
        _phase: this._phase,
        whitePlayers: this.whitePlayers,
        blackPlayers: this.blackPlayers,
        currentPlayers,
        pendingMovesKeys: Array.from(this.pendingMoves.keys()),
        pendingMovesEntries: Array.from(this.pendingMoves.entries()).map(([k, v]) => ({ key: k, move: v.move, locked: v.locked }))
      })
    }
    return result
  }

  getPendingMoves(): { human: PendingMoveInfo | null; teammate: PendingMoveInfo | null } {
    const currentPlayers = this._currentTeam === Team.WHITE
      ? this.whitePlayers
      : this.blackPlayers

    const human = this.pendingMoves.get(currentPlayers[0]) ?? null
    const teammate = this.pendingMoves.get(currentPlayers[1]) ?? null

    return { human, teammate }
  }

  getAllPendingMoves(): Map<Player, PendingMoveInfo> {
    return this.pendingMoves
  }

  getTurnStartFen(): string {
    return this.turnStartFen
  }

  getMatchTimeRemaining(): number {
    return this._matchTimeRemaining
  }

  setMatchTimeRemaining(seconds: number): void {
    this._matchTimeRemaining = seconds
  }

  isMatchTimerActive(): boolean {
    return this._matchTimerActive
  }

  setMatchTimerActive(active: boolean): void {
    this._matchTimerActive = active
  }

  setCurrentTeam(team: Team): void {
    this._currentTeam = team
  }

  resetBoard(fen: string): void {
    const { Chess } = require('chess.js')
    const newBoard = new Chess(fen)
    this.board.load(fen)
    const fenParts = fen.split(' ')
    this._currentTeam = fenParts[1] === 'w' ? Team.WHITE : Team.BLACK
  }

  selectMove(player: Player, move: string): void {
    if (this._phase !== GamePhase.SELECTING) {
      throw new Error('Not in selection phase')
    }
    if (!this.isPlayerOnCurrentTeam(player)) {
      throw new Error('Player not on current team')
    }
    this.selections.set(player, move)
  }

  getSelectedMove(player: Player): string | null {
    return this.selections.get(player) ?? null
  }

  lockMove(player: Player): void {
    if (this._phase === GamePhase.GAME_OVER) {
      return
    }
    if (this._phase !== GamePhase.SELECTING && this._phase !== GamePhase.LOCKED) {
      return
    }
    if (!this.isPlayerOnCurrentTeam(player)) {
      return
    }
    if (!this.selections.has(player)) {
      return
    }
    this.locked.add(player)

    if (this.areBothTeamPlayersLocked()) {
      this._phase = GamePhase.LOCKED
    }
  }

  resolve(forcedWinningMove?: string): MoveResult | null {
    if (this._phase !== GamePhase.LOCKED) {
      return null
    }

    const currentPlayers = this._currentTeam === Team.WHITE
      ? this.whitePlayers
      : this.blackPlayers

    const move1 = this.selections.get(currentPlayers[0])!
    const move2 = this.selections.get(currentPlayers[1])!

    let winningMove = move1
    let winner = currentPlayers[0]

    if (forcedWinningMove) {
      if (forcedWinningMove === move1) {
        winner = currentPlayers[0]
        winningMove = move1
      } else if (forcedWinningMove === move2) {
        winner = currentPlayers[1]
        winningMove = move2
      }
    } else if (move1 !== move2) {
      const result1 = this.tryMove(move1)
      const result2 = this.tryMove(move2)

      if (result1 && !result2) {
        winningMove = move1
        winner = currentPlayers[0]
      } else if (!result1 && result2) {
        winningMove = move2
        winner = currentPlayers[1]
      } else if (result1 && result2) {
        winningMove = move1
        winner = currentPlayers[0]
      }
    }

    const moveResult = this.chess.move(winningMove)
    if (moveResult && moveResult.captured) {
      this.trackCapturedPiece(this._currentTeam, moveResult.captured)
    }

    const result: MoveResult = {
      move: winningMove,
      player: winner,
      team: this._currentTeam
    }

    this.selections.clear()
    this.locked.clear()
    this.pendingMoves.clear()
    this._currentTeam = this._currentTeam === Team.WHITE ? Team.BLACK : Team.WHITE
    this._phase = GamePhase.SELECTING

    return result
  }

  private tryMove(move: string): boolean {
    try {
      const testChess = new Chess(this.chess.fen())
      const result = testChess.move(move)
      return result !== null
    } catch {
      return false
    }
  }

  private trackCapturedPiece(team: Team, piece: string): void {
    const lowercasePiece = piece.toLowerCase()
    if (team === Team.WHITE) {
      this._capturedByWhite.push(lowercasePiece)
    } else {
      this._capturedByBlack.push(lowercasePiece)
    }
  }

  private isPlayerOnCurrentTeam(player: Player): boolean {
    const currentPlayers = this._currentTeam === Team.WHITE
      ? this.whitePlayers
      : this.blackPlayers
    return currentPlayers.includes(player)
  }

  private areBothTeamPlayersLocked(): boolean {
    const currentPlayers = this._currentTeam === Team.WHITE
      ? this.whitePlayers
      : this.blackPlayers
    return currentPlayers.every(p => this.locked.has(p))
  }
}