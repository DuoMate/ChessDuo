import { Chess } from 'chess.js'
import { DEFAULT_TEAM_TIMER_SECONDS } from '../shared/gameConstants'

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

  constructor(timeLimitSeconds: number = DEFAULT_TEAM_TIMER_SECONDS) {
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

  removePlayer(player: Player, team: Team): void {
    const players = team === Team.WHITE ? this.whitePlayers : this.blackPlayers
    const idx = players.indexOf(player)
    if (idx !== -1) {
      players.splice(idx, 1)
    }
  }

  replacePlayer(oldPlayer: Player, newPlayer: Player, team: Team): void {
    const players = team === Team.WHITE ? this.whitePlayers : this.blackPlayers
    const idx = players.indexOf(oldPlayer)
    if (idx !== -1) {
      players[idx] = newPlayer
    } else {
      players.push(newPlayer)
    }
  }

  startMatch(): void {
    if (this.whitePlayers.length !== 2 || this.blackPlayers.length !== 2) {
      throw new Error('Both teams must have 2 players to start')
    }
    this._phase = GamePhase.SELECTING
  }

  startPendingTurn(fen: string): void {
    this.turnStartFen = fen
    this.pendingMoves.clear()
    this.locked.clear()
    this.selections.clear()
  }

  setPendingMove(player: Player, move: string, from: string, to: string, piece: string): void {
    if (this._phase !== GamePhase.SELECTING && this._phase !== GamePhase.LOCKED) {
      console.warn('[GameState] setPendingMove dropped — phase is', this._phase, 'for player', player)
      return
    }

    // Determine isHuman: offline slots (player1-player4) are human,
    // online UUIDs are human, bot_ prefixed IDs are bots.
    const isOfflineSlot = (player === 'player1' || player === 'player2' || player === 'player3' || player === 'player4')
    const isBot = player.startsWith('bot_')
    const isHuman = isOfflineSlot || (!isBot && player.length > 8)

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
    const lockedCount = Array.from(this.pendingMoves.values())
      .filter(m => m.locked).length
    return lockedCount >= 2
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

    let winningMove: string
    let winner: Player

    if (forcedWinningMove) {
      winningMove = forcedWinningMove
      const entries = Array.from(this.pendingMoves.entries())
      const match = entries.find(([, m]) => m.move === forcedWinningMove)
      winner = match?.[0] || entries[0]?.[0] || 'player1'
    } else {
      const currentPlayers = this._currentTeam === Team.WHITE
        ? this.whitePlayers
        : this.blackPlayers

      const move1 = this.selections.get(currentPlayers[0])!
      const move2 = this.selections.get(currentPlayers[1])!

      winningMove = move1
      winner = currentPlayers[0]

      if (move1 !== move2) {
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
    return this.locked.size >= 2
  }
}