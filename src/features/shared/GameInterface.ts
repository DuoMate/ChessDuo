import { Chess } from 'chess.js'
import { GameStatus, MoveComparison } from './gameTypes'
import { Team, Player, CapturedPieces, PendingMoveInfo } from '../game-engine/gameState'
import type { ResolvedColor } from './gameConstants'
import type { GameEvaluator } from '../mobile-engine/evaluatorFactory'

export interface GameInterface {
  readonly status: GameStatus
  readonly currentTurn: Team
  readonly board: Chess
  readonly lastMove: { from: string; to: string } | null
  readonly lastMoveComparison: MoveComparison | null
  readonly player1Id: string

  start(): void
  startPendingTurn(): void
  setPendingMove(player: Player, move: string, from: string, to: string, piece: string): void
  lockPendingMove(player: Player): void
  isPendingMoveLocked(player: Player): boolean
  isBothPendingLocked(): boolean
  getPendingMoves(): { human: PendingMoveInfo | null; teammate: PendingMoveInfo | null }
  getAllPendingMoves(): Map<Player, PendingMoveInfo>
  resolvePendingMoves(skipStatsUpdate?: boolean): Promise<{ winnerId: string; winningMove: string }>
  getSelectedMove(player: Player): string | null
  getTurnStartFen(): string
  getTurnState(): string
  setTurnState(state: string): void

  getMatchTimeRemaining(): number
  setMatchTimeRemaining(seconds: number): void
  isMatchTimerActive(): boolean
  setMatchTimerActive(active: boolean): void

  setGameOverTimeup(result: string, reason: string): void
  setGameOverResult(result: string): void
  setGameOverReason(reason: string): void
  getResult(): string
  getGameOverReason(): string | null

  getStats(): { movesPlayed: number; syncRate: number; conflicts: number; player1Accuracy: number; player2Accuracy: number }
  getCapturedPieces(): { white: string[]; black: string[] }
  getEvaluator(): GameEvaluator

  /** Returns the viewer's team */
  getTeam(): 'WHITE' | 'BLACK'
  /** Resolved color the human player occupies (random resolved at construction) */
  getPlayerColor(): ResolvedColor
  /** Slot ID of the human player on their team (depends on color) */
  getHumanSlot(): Player
  /** Slot ID of the teammate bot (same team as human) */
  getTeammateSlot(): Player
  /** Whether this game is a 4-player (all-human) match */
  isFourPlayer(): boolean
  /** Get the team for a given player ID */
  getPlayerTeam(playerId: string): 'WHITE' | 'BLACK' | null
  /** Whether this client is the turn coordinator */
  isCoordinator(): boolean
  /** Get the ID of the turn coordinator */
  getCoordinatorId(): string
  /** Get all player IDs on a team */
  getPlayers(team: Team): Player[]
  /** Saved move history from DB (populated after reconnection sync) */
  readonly savedMoveHistory: Array<{ team: string; move: string }>
}
