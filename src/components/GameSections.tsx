'use client'

import { memo, type ReactNode } from 'react'
import { BoardTopBar, type BoardTopBarPlayer } from './BoardTopBar'
import { GameMenu } from './GameMenu'
import { ChessBoard, type HighlightSquares, type PendingOverlay } from './ChessBoard'
import { MobileChessBoard } from './MobileChessBoard'
import type { Team } from '@/features/game-engine/gameState'
import type { PromotionPiece } from '@/features/shared/gameTypes'

/**
 * P5 — Memoized Game screen sections.
 *
 * Game.tsx owns a large state object, so the shell re-renders on every engine
 * event. These sections (default shallow memo) bail out unless their own
 * slice actually changed — the top bar no longer reconciles on moves, and the
 * board subtree no longer reconciles on chat/panel/timer-parent updates.
 *
 * Rules for props (enforced by callers):
 * - Pass fully-computed primitives + stable refs only. Ref reads
 *   (myTeamRef, inputLockedRef, engine maps) happen in Game's render and are
 *   passed as values, so freshness is identical to the previous inline JSX.
 * - `key={boardKey}` remount semantics preserved: the key is applied to the
 *   board element inside the section, exactly as before.
 */

interface GameTopBarSectionProps {
  whitePlayers: BoardTopBarPlayer[]
  blackPlayers: BoardTopBarPlayer[]
  /** Captured-piece material rows. Optional — DuelGame has no capture display. */
  capturedWhite?: string[]
  capturedBlack?: string[]
  matchTimeRemaining: number
  matchTimerActive: boolean
  totalMatchSeconds: number
  roundLabel?: string
  currentTurn: Team
  timerNode: ReactNode
  /** In-flow thinking hint below the turn pill — boolean keeps the memo stable. */
  isThinking?: boolean
  resignVisible: boolean
  onResign: () => void
  onOpenSettings: () => void
  soundEnabled: boolean
  onToggleSound: () => void
  onOpenProfile?: () => void
  /**
   * P7: wrapper classes differ per game mode (Game vs DuelGame) — passed as
   * stable string literals so the memo holds. Defaults preserve Game's visuals.
   */
  shellClassName?: string
}

function GameTopBarSectionInner({
  whitePlayers,
  blackPlayers,
  capturedWhite = [],
  capturedBlack = [],
  matchTimeRemaining,
  matchTimerActive,
  totalMatchSeconds,
  roundLabel,
  currentTurn,
  timerNode,
  isThinking = false,
  resignVisible,
  onResign,
  onOpenSettings,
  soundEnabled,
  onToggleSound,
  onOpenProfile,
  shellClassName = 'w-full bg-white dark:bg-[var(--color-page-bg)] border-b border-slate-200 dark:border-white/5 px-3 py-2',
}: GameTopBarSectionProps) {
  return (
    <div className={shellClassName}>
      <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
        <div className="min-w-0 flex-1">
          <BoardTopBar
            whitePlayers={whitePlayers}
            blackPlayers={blackPlayers}
            capturedWhite={capturedWhite}
            capturedBlack={capturedBlack}
            matchTimeRemaining={matchTimeRemaining}
            matchTimerActive={matchTimerActive}
            totalMatchSeconds={totalMatchSeconds}
            roundLabel={roundLabel}
            currentTurn={currentTurn}
            timerNode={timerNode}
            isThinking={isThinking}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <GameMenu
            onResign={resignVisible ? onResign : undefined}
            onOpenSettings={onOpenSettings}
            soundEnabled={soundEnabled}
            onToggleSound={onToggleSound}
            onOpenProfile={onOpenProfile}
          />
        </div>
      </div>
    </div>
  )
}

export const GameTopBarSection = memo(GameTopBarSectionInner)

interface GameBoardSectionProps {
  boardKey: number
  fen: string
  enabled: boolean
  orientation: 'white' | 'black'
  lastMove: { from: string; to: string } | null
  pendingOverlay: PendingOverlay | null
  myPendingOverlay: PendingOverlay | null
  highlightSquares: HighlightSquares | null
  onMove: (move: string, promotion?: PromotionPiece) => void
  onAnimationComplete: () => void
  isMobile: boolean
  maxWidth: string
  /** P7: outer flex wrapper differs per mode (Game has px-3, DuelGame does not). */
  outerClassName?: string
}

function GameBoardSectionInner({
  boardKey,
  fen,
  enabled,
  orientation,
  lastMove,
  pendingOverlay,
  myPendingOverlay,
  highlightSquares,
  onMove,
  onAnimationComplete,
  isMobile,
  maxWidth,
  outerClassName = 'flex justify-center px-3',
}: GameBoardSectionProps) {
  return (
    <div className={outerClassName}>
      <div
        className="w-full aspect-square flex-shrink-0 relative"
        style={{ maxWidth }}
      >
        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden bg-slate-900/30">
          {isMobile ? (
            <MobileChessBoard
              key={boardKey}
              fen={fen}
              onMove={onMove}
              enabled={enabled}
              orientation={orientation}
              lastMove={lastMove}
              pendingOverlay={pendingOverlay}
              myPendingOverlay={myPendingOverlay}
              highlightSquares={highlightSquares}
              onAnimationComplete={onAnimationComplete}
            />
          ) : (
            <ChessBoard
              key={boardKey}
              fen={fen}
              onMove={onMove}
              enabled={enabled}
              orientation={orientation}
              lastMove={lastMove}
              pendingOverlay={pendingOverlay}
              myPendingOverlay={myPendingOverlay}
              highlightSquares={highlightSquares}
              onAnimationComplete={onAnimationComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export const GameBoardSection = memo(GameBoardSectionInner)
