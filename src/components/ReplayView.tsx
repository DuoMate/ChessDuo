'use client'

import { useState } from 'react'
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

  const moves = parseMoveComparisons(game.move_comparisons)
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  const currentFen = playbackFen || (moves.length > 0 ? moves[moves.length - 1].fenAfter : initialFen)

  // Use saved player labels if available, otherwise fall back to generic names
  const whiteLabels = game.player_labels?.white ?? ['Player 1']
  const blackLabels = game.player_labels?.black ?? ['Player 2']

  const whitePlayers: BoardTopBarPlayer[] = [
    { id: 'p1', label: whiteLabels[0] || 'Player 1', type: 'human', isYou: game.winner === 'WHITE', online: true },
  ]
  const blackPlayers: BoardTopBarPlayer[] = [
    { id: 'p2', label: blackLabels[0] || 'Player 2', type: 'human', isYou: game.winner === 'BLACK', online: true },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-page-bg)] text-slate-100">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col px-3">
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
              className="min-h-[44px] px-3 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700/60 flex items-center gap-1 text-slate-300 text-xs"
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
          className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3 mb-3 backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">
              {game.winner === 'WHITE' ? '🏆' : game.winner === 'DRAW' ? '🤝' : '💀'}
            </span>
            <span className="font-bold text-base">
              {game.winner === 'WHITE' ? 'White Wins' : game.winner === 'DRAW' ? 'Draw' : 'Black Wins'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-2">
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
        </motion.div>

        <div
          className="relative w-full mx-auto aspect-square mb-3"
          style={{ maxWidth: 'min(95vw, 80vh, 600px)' }}
        >
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden bg-slate-900/30">
            {isMobile ? (
              <MobileChessBoard
                fen={currentFen}
                enabled={false}
                onMove={() => {}}
              />
            ) : (
              <ChessBoard
                fen={currentFen}
                enabled={false}
                lastMove={null}
                pendingOverlay={null}
                myPendingOverlay={null}
                onMove={() => {}}
                orientation="white"
              />
            )}
          </div>
        </div>

        <div className="flex-1 mb-24" /> {/* spacer for BoardBottomNav */}

        <BoardBottomNav
          activeTab="game"
          onTabChange={() => {}}
          onForward={() => {}}
          onBackMove={() => {
            const current = playbackIndex ?? moves.length - 1
            if (current <= 0) {
              setPlaybackIndex(-1)
              setPlaybackFen(initialFen)
            } else {
              setPlaybackIndex(current - 1)
              setPlaybackFen(moves[current - 1]?.fenAfter || initialFen)
            }
          }}
          onForwardMove={() => {
            if (playbackIndex === null) return
            const current = playbackIndex ?? moves.length - 1
            if (current >= moves.length - 1) {
              setPlaybackIndex(null)
              setPlaybackFen(null)
            } else {
              setPlaybackIndex(current + 1)
              setPlaybackFen(moves[current + 1]?.fenAfter || '')
            }
          }}
        />
      </div>
    </div>
  )
}
