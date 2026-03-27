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

export class GameState {
  private chess: Chess
  private _phase: GamePhase
  private _currentTeam: Team
  private whitePlayers: Player[]
  private blackPlayers: Player[]
  private selections: Map<Player, string>
  private locked: Set<Player>

  constructor() {
    this.chess = new Chess()
    this._phase = GamePhase.WAITING
    this._currentTeam = Team.WHITE
    this.whitePlayers = []
    this.blackPlayers = []
    this.selections = new Map()
    this.locked = new Set()
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
    if (this._phase !== GamePhase.SELECTING) {
      throw new Error('Not in selection phase')
    }
    if (!this.isPlayerOnCurrentTeam(player)) {
      throw new Error('Player not on current team')
    }
    if (!this.selections.has(player)) {
      throw new Error('Player has not selected a move')
    }
    this.locked.add(player)

    if (this.areBothTeamPlayersLocked()) {
      this._phase = GamePhase.LOCKED
    }
  }

  resolve(): MoveResult | null {
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

    this.chess.move(winningMove)
    
    const result: MoveResult = {
      move: winningMove,
      player: winner,
      team: this._currentTeam
    }

    this.selections.clear()
    this.locked.clear()
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
