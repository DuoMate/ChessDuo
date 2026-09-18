'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { CompletedGame } from '@/lib/matchHistory'
import { BoardBottomNav } from './BoardBottomNav'
import { ChessBoard } from './ChessBoard'
import { MobileChessBoard } from './MobileChessBoard'
import { BoardTopBar, type BoardTopBarPlayer } from './BoardTopBar'
import type { MoveEntry } from './MovePlayback'

const reasonLabels: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefoldRepetition: 'Repetition',
  insufficientMaterial: 'Insufficient Material',
  draw: 'Draw',
  timeout: "Time's Up",
  resignation: 'Resigned',
}

function parseMoveComparisons(raw: unknown): MoveEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((m): m is MoveEntry => {
    if (typeof m !== 'object' || m === null) return false
    const entry = m as Record<string, unknown>
    return typeof entry.turn === 'number' && typeof entry.fenAfter === 'string' && entry.fenAfter.length > 0
  })
}

interface ReplayViewProps {
  game: CompletedGame
}

export function ReplayView({ game }: ReplayViewProps) {
  const router = useRouter()
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)
  const [playbackFen, setPlaybackFen] = useState<string | null>(null)
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  // P3 perf: parse once per game (was re-filtering 100+ move entries on every
  // scrub render); stable player arrays + noop move handler so the memoized
  // BoardTopBar/ChessBoard comparators hold when only playback index changes.
  // No visual/behavior change — same data, stable refs.
  const moves = useMemo(() => parseMoveComparisons(game.move_comparisons), [game.move_comparisons])
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  const currentFen = playbackFen || (moves.length > 0 ? moves[moves.length - 1].fenAfter : initialFen)

  // Use saved player labels if available, otherwise fall back to generic names
  const whiteLabel = game.player_labels?.white?.[0] || 'Player 1'
  const blackLabel = game.player_labels?.black?.[0] || 'Player 2'
  const whitePlayers: BoardTopBarPlayer[] = useMemo(() => [
    { id: 'p1', label: whiteLabel, type: 'human', isYou: game.winner === 'WHITE', online: true },
  ], [whiteLabel, game.winner])
  const blackPlayers: BoardTopBarPlayer[] = useMemo(() => [
    { id: 'p2', label: blackLabel, type: 'human', isYou: game.winner === 'BLACK', online: true },
  ], [blackLabel, game.winner])
  const handleReplayMove = useCallback(() => {}, [])
  const handleReplayTabChange = useCallback(() => {}, [])
  const handleReplayForward = useCallback(() => {}, [])
  const handleReplayBackMove = useCallback(() => {
    const current = playbackIndex ?? moves.length - 1
    if (current <= 0) {
      setPlaybackIndex(-1)
      setPlaybackFen(initialFen)
    } else {
      setPlaybackIndex(current - 1)
      setPlaybackFen(moves[current - 1]?.fenAfter || initialFen)
    }
  }, [playbackIndex, moves])
  const handleReplayForwardMove = useCallback(() => {
    if (playbackIndex === null) return
    const current = playbackIndex ?? moves.length - 1
    if (current >= moves.length - 1) {
      setPlaybackIndex(null)
      setPlaybackFen(null)
    } else {
      setPlaybackIndex(current + 1)
      setPlaybackFen(moves[current + 1]?.fenAfter || '')
    }
  }, [playbackIndex, moves])

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--color-page-bg)] text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col px-3 pt-[env(safe-area-inset-top,0px)] pb-24">
        <div className="relative">
          <BoardTopBar
            whitePlayers={whitePlayers}
            blackPlayers={blackPlayers}
            matchTimeRemaining={0}
            matchTimerActive={false}
            totalMatchSeconds={0}
            currentTurn={'WHITE' as any}
          />
          <div className="absolute right-3 top-2 flex items-center gap-2">
            <button
              onClick={() => router.push('/history')}
              className="focus-ring min-h-[44px] px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700/70 dark:border-slate-700/60 flex items-center gap-1 text-slate-600 dark:text-slate-300 text-xs"
              aria-label="Back to history"
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-slate-200 shadow-sm dark:bg-slate-900/70 dark:border-slate-700/70 rounded-xl p-3 mb-3 backdrop-blur-xl dark:shadow-none"
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-xl"
              role="img"
              aria-label={game.winner === 'WHITE' ? 'White wins' : game.winner === 'DRAW' ? 'Draw' : 'Black wins'}
            >
              {game.winner === 'WHITE' ? '🏆' : game.winner === 'DRAW' ? '🤝' : '💀'}
            </span>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100">
              {game.winner === 'WHITE' ? 'White Wins' : game.winner === 'DRAW' ? 'Draw' : 'Black Wins'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            {game.game_result || (game.game_over_reason ? reasonLabels[game.game_over_reason] || game.game_over_reason : 'Game Over')}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span>{game.is_online ? 'Online' : 'Offline'}</span>
            <span>·</span>
            <span>{game.white_moves} moves</span>
            <span>·</span>
            <span>Sync {Math.round(game.white_sync_rate * 100)}%</span>
            <span>·</span>
            <span>P1: {Math.round(game.player1_accuracy)}%</span>
            <span>·</span>
            <span>P2: {Math.round(game.player2_accuracy)}%</span>
          </div>
          {moves.length === 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              No moves were recorded for this game — showing the starting position.
            </p>
          )}
        </motion.div>

        <div
          className="relative w-full mx-auto aspect-square mb-3"
          // Per-surface board cap: replay keeps 600px (result + meta cards sit
          // above the board); full game uses 720px, coach 560px.
          style={{ maxWidth: 'min(95vw, 80vh, 600px)' }}
        >
            <div className="absolute inset-0 rounded-2xl ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_0_40px_rgba(15,23,42,0.12)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden bg-slate-100 dark:bg-slate-900/30">
            {isMobile ? (
              <MobileChessBoard
                fen={currentFen}
                enabled={false}
                onMove={handleReplayMove}
              />
            ) : (
              <ChessBoard
                fen={currentFen}
                enabled={false}
                lastMove={null}
                pendingOverlay={null}
                myPendingOverlay={null}
                onMove={handleReplayMove}
                orientation="white"
              />
            )}
          </div>
        </div>

        <div className="flex-1 mb-24" /> {/* spacer for BoardBottomNav */}

        <BoardBottomNav
          activeTab="game"
          onTabChange={handleReplayTabChange}
          onForward={handleReplayForward}
          onBackMove={handleReplayBackMove}
          onForwardMove={handleReplayForwardMove}
          disabledTabs={['moves', 'chat', 'insights']}
        />
      </div>
    </div>
  )
}
