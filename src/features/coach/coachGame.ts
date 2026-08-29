import { Chess, Move, Square } from 'chess.js'
import { ChessBot } from '../bots/chessBot'
import { CoachEngine, EngineMove } from './coachEngine'
import { buildFeedback, buildSuggestion, type CoachFeedback, type Suggestion } from './coachAnalysis'
import { calculateAccuracy } from '../shared/accuracy'
import type { PromotionPiece } from '../shared/gameTypes'

/**
 * Coach Mode game lifecycle — Player vs AI with an advisory coach.
 *
 * Isolation: this class owns its own board state (chess.js), its own analysis
 * engine (`CoachEngine`, a dedicated Stockfish worker), and reuses `ChessBot`
 * (read-only) for the AI opponent. It does NOT implement `GameInterface` and
 * touches none of the production Local/Online/Duel game logic.
 */

export type CoachStatus = 'idle' | 'playing' | 'game_over'

export interface CoachGameState {
  fen: string
  status: CoachStatus
  playerColor: 'w' | 'b'
  botLevel: number
  turn: 'w' | 'b'
  lastMove: { from: string; to: string } | null
  suggestion: Suggestion | null
  feedback: CoachFeedback | null
  result: string | null
  gameOverReason: string | null
  moveHistory: string[]
  blunders: number
  mistakes: number
  accuracy: number
  analyzing: boolean
}

export type CoachGameListener = (state: CoachGameState) => void

interface CoachGameOptions {
  playerColor?: 'w' | 'b'
  botLevel?: number
  engine?: CoachEngine
  bot?: ChessBot
}

export class CoachGame {
  private chess: Chess
  private playerColor: 'w' | 'b'
  private botLevel: number
  private engine: CoachEngine
  private bot: ChessBot
  private status: CoachStatus = 'idle'
  private lastMove: { from: string; to: string } | null = null
  private suggestion: Suggestion | null = null
  private feedback: CoachFeedback | null = null
  private result: string | null = null
  private gameOverReason: string | null = null
  private moveHistory: string[] = []
  private blunders = 0
  private mistakes = 0
  private totalAccuracy = 0
  private movesAnalyzed = 0
  private analyzing = false
  private listener: CoachGameListener | null = null
  /** Raw top moves for the position the player last moved from (used to score the player's move). */
  private pendingTopMoves: EngineMove[] = []

  constructor(options: CoachGameOptions = {}) {
    this.chess = new Chess()
    this.playerColor = options.playerColor ?? 'w'
    this.botLevel = options.botLevel ?? 3
    this.engine = options.engine ?? new CoachEngine()
    this.bot = options.bot ?? new ChessBot({ skillLevel: this.botLevel })
  }

  get fen(): string {
    return this.chess.fen()
  }

  getState(): CoachGameState {
    return {
      fen: this.chess.fen(),
      status: this.status,
      playerColor: this.playerColor,
      botLevel: this.botLevel,
      turn: this.chess.turn(),
      lastMove: this.lastMove,
      suggestion: this.suggestion,
      feedback: this.feedback,
      result: this.result,
      gameOverReason: this.gameOverReason,
      moveHistory: [...this.moveHistory],
      blunders: this.blunders,
      mistakes: this.mistakes,
      accuracy: this.movesAnalyzed > 0 ? Math.round(this.totalAccuracy / this.movesAnalyzed) : 0,
      analyzing: this.analyzing,
    }
  }

  onStateChange(listener: CoachGameListener): () => void {
    this.listener = listener
    this.emit()
    return () => {
      this.listener = null
    }
  }

  private emit(): void {
    this.listener?.(this.getState())
  }

  async start(): Promise<void> {
    if (this.status !== 'idle') return
    this.status = 'playing'
    this.emit()

    // Black player: the White bot opens the game.
    if (this.playerColor === 'b') {
      await this.playBotMove()
      return
    }
    await this.computeSuggestion()
  }

  /** Apply the human player's move. Returns feedback for the move (or null if not applied). */
  async applyPlayerMove(from: string, to: string, promotion?: PromotionPiece): Promise<CoachFeedback | null> {
    if (this.status !== 'playing') return null
    if (this.chess.turn() !== this.playerColor) return null
    if (this.analyzing) return null

    const beforeFen = this.chess.fen()
    const beforeTop = this.pendingTopMoves
    const move = this.tryMove(from, to, promotion)
    if (!move) return null

    this.moveHistory.push(move.san)
    this.lastMove = { from: move.from, to: move.to }

    // Score the player's move + the resulting position to produce feedback.
    this.analyzing = true
    this.emit()
    try {
      const uci = from + to + (move.promotion ?? '')
      const chosen = await this.engine.scoreMove(beforeFen, uci)
      const afterBest = await this.engine.evaluatePosition(this.chess.fen())
      this.feedback = buildFeedback({
        playerMoveSan: move.san,
        playerMoveUci: uci,
        beforeTop,
        chosen,
        afterBest,
      })
      if (this.feedback.isBlunder) this.blunders++
      else if (this.feedback.verdict === 'mistake') this.mistakes++
      if (this.feedback.centipawnLoss !== null) {
        this.totalAccuracy += calculateAccuracy(this.feedback.centipawnLoss)
        this.movesAnalyzed++
      }
    } catch {
      // Analysis is advisory — never block the game on an engine error.
      this.feedback = null
    } finally {
      this.analyzing = false
    }

    if (this.chess.isGameOver()) {
      this.finishGame()
      return this.feedback
    }

    await this.playBotMove()
    return this.feedback
  }

  async resign(): Promise<void> {
    if (this.status !== 'playing') return
    this.result = 'Loss by resignation'
    this.gameOverReason = 'resignation'
    this.status = 'game_over'
    this.emit()
  }

  destroy(): void {
    this.engine.terminate()
  }

  private async playBotMove(): Promise<void> {
    if (this.chess.isGameOver()) {
      this.finishGame()
      return
    }
    this.analyzing = true
    this.emit()
    try {
      const uci = await this.bot.selectMoveAsync(this.chess.fen())
      if (!uci) {
        // Bot failed to produce a move — end the game defensively rather than hang.
        this.result = 'Game aborted (bot error)'
        this.gameOverReason = 'bot_error'
        this.status = 'game_over'
        this.emit()
        return
      }
      const botMove = this.applyUci(uci)
      if (botMove) {
        this.moveHistory.push(botMove.san)
        this.lastMove = { from: botMove.from, to: botMove.to }
      }
    } finally {
      this.analyzing = false
    }

    if (this.chess.isGameOver()) {
      this.finishGame()
      return
    }
    await this.computeSuggestion()
  }

  private async computeSuggestion(): Promise<void> {
    // Gate input while the coach analyses — the board must not accept a move
    // before `pendingTopMoves` is populated, or the feedback would be empty.
    this.analyzing = true
    this.emit()
    this.pendingTopMoves = []
    try {
      const top = await this.engine.analyzeTopMoves(this.chess.fen(), 3)
      this.pendingTopMoves = top
      this.suggestion = buildSuggestion(top)
    } catch {
      this.suggestion = { topMoves: [], bestMoveSan: null, evaluationDisplay: '—' }
    }
    this.analyzing = false
    this.emit()
  }

  private tryMove(from: string, to: string, promotion?: PromotionPiece): Move | null {
    try {
      const piece = this.chess.get(from as Square)
      const promo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? promotion ?? 'q' : undefined
      return this.chess.move({ from, to, promotion: promo })
    } catch {
      return null
    }
  }

  private applyUci(uci: string): Move | null {
    try {
      return this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as PromotionPiece | undefined })
    } catch {
      return null
    }
  }

  private finishGame(): void {
    const info = this.gameOverInfo()
    if (info) {
      this.result = info.result
      this.gameOverReason = info.reason
    }
    this.status = 'game_over'
    this.emit()
  }

  private gameOverInfo(): { result: string; reason: string } | null {
    const b = this.chess
    if (b.isCheckmate()) {
      const playerMated = b.turn() === this.playerColor
      return { result: playerMated ? 'Loss by checkmate' : 'Win by checkmate', reason: 'checkmate' }
    }
    if (b.isStalemate()) return { result: 'Draw by stalemate', reason: 'stalemate' }
    if (b.isThreefoldRepetition()) return { result: 'Draw by threefold repetition', reason: 'threefoldRepetition' }
    if (b.isInsufficientMaterial()) return { result: 'Draw by insufficient material', reason: 'insufficientMaterial' }
    if (b.isDraw()) return { result: 'Draw', reason: 'draw' }
    return null
  }
}
