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

export interface GameLogEntry {
  t: number          // Turn number
  team: string       // 'A' (White) or 'B' (Black)
  p: string          // Player ID: 'A1', 'A2', 'B1', 'B2', 'F'
  m: string          // Move in UCI format
  ts: number         // Timestamp in seconds
  a1?: number        // Player 1 accuracy (only for F entry)
  a2?: number        // Player 2 accuracy (only for F entry)
  w?: string         // Winner: 'A1', 'A2', 'B1', 'B2' (only for F entry)
}

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
  private teamTimer: number
  private timerActive: boolean

  private gameLog: GameLogEntry[] = []
  private turnStartTime: number = 0

  constructor() {
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
    this.teamTimer = 10
    this.timerActive = false
    this.gameLog = []
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

  resetBoard(chess: Chess): void {
    this.chess = chess
    this._phase = GamePhase.SELECTING
    this._currentTeam = Team.WHITE
    this.selections.clear()
    this.locked.clear()
    this.pendingMoves.clear()
    this._capturedByWhite = []
    this._capturedByBlack = []
    this.timerActive = false
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
    this.teamTimer = 10
    this.timerActive = true
    this.turnStartTime = Date.now()
  }

  setPendingMove(player: Player, move: string, from: string, to: string, piece: string): void {
    if (this._phase !== GamePhase.SELECTING && this._phase !== GamePhase.LOCKED) {
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
    return currentPlayers.every(p => {
      const pending = this.pendingMoves.get(p)
      return pending && pending.locked
    })
  }

  getPendingMoves(): { human: PendingMoveInfo | null; teammate: PendingMoveInfo | null } {
    let human: PendingMoveInfo | null = null
    let teammate: PendingMoveInfo | null = null

    for (const [player, pending] of this.pendingMoves) {
      if (pending.isHuman) {
        human = pending
      } else {
        teammate = pending
      }
    }

    return { human, teammate }
  }

  getAllPendingMoves(): Map<Player, PendingMoveInfo> {
    return this.pendingMoves
  }

  getTurnStartFen(): string {
    return this.turnStartFen
  }

  getTeamTimer(): number {
    return this.teamTimer
  }

  setTeamTimer(seconds: number): void {
    this.teamTimer = seconds
  }

  setCurrentTeam(team: Team): void {
    this._currentTeam = team
  }

  isTimerActive(): boolean {
    return this.timerActive
  }

  setTimerActive(active: boolean): void {
    this.timerActive = active
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
    this.timerActive = false

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

  logPlayerMove(player: Player, move: string): void {
    const teamLetter = this._currentTeam === Team.WHITE ? 'A' : 'B'
    
    // Determine player number - check if this player is first or second in the team's player list
    let playerNum = '1'
    const currentTeamPlayers = this._currentTeam === Team.WHITE ? this.whitePlayers : this.blackPlayers
    const playerIndex = currentTeamPlayers.indexOf(player)
    if (playerIndex === 0) {
      playerNum = '1'
    } else if (playerIndex === 1) {
      playerNum = '2'
    } else {
      // Fallback for players not in the list - use heuristics
      playerNum = (player.includes('1') || player === 'player1' || player.includes('anon')) ? '1' : '2'
    }
    
    const playerId = `${teamLetter}${playerNum}`
    const timestamp = this.getTurnElapsedTime()

    this.gameLog.push({
      t: this.getTurnNumber(),
      team: teamLetter,
      p: playerId,
      m: move,
      ts: timestamp
    })
    console.log('[GAME_LOG] logPlayerMove:', playerId, move, 'total entries:', this.gameLog.length)
  }

  logResolution(winningMove: string, winnerPlayer: Player, player1Accuracy: number, player2Accuracy: number): void {
    const teamLetter = this._currentTeam === Team.WHITE ? 'A' : 'B'
    const timestamp = this.getTurnElapsedTime()
    const winnerNum = this.whitePlayers.includes(winnerPlayer) || winnerPlayer === 'player1' ? '1' : '2'

    this.gameLog.push({
      t: this.getTurnNumber(),
      team: teamLetter,
      p: 'F',
      m: winningMove,
      ts: timestamp,
      a1: player1Accuracy,
      a2: player2Accuracy,
      w: `${teamLetter}${winnerNum}`
    })
    console.log('[GAME_LOG] logResolution:', winningMove, 'winner:', `${teamLetter}${winnerNum}`, 'a1:', player1Accuracy, 'a2:', player2Accuracy, 'total entries:', this.gameLog.length)
  }

  private getTurnNumber(): number {
    const fullMoves = this.chess.moveNumber()
    return this._currentTeam === Team.WHITE ? fullMoves : fullMoves
  }

  private getTurnElapsedTime(): number {
    return (Date.now() - this.turnStartTime) / 1000
  }

  getGameLog(): GameLogEntry[] {
    return [...this.gameLog]
  }

  getGameLogJSON(): string {
    return JSON.stringify(this.gameLog)
  }
}