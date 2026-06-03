'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { CompletedGame } from '@/lib/matchHistory'
import { MovePlayback, MoveEntry } from './MovePlayback'
import { ChessBoard } from './ChessBoard'
import { MobileChessBoard } from './MobileChessBoard'

const reasonLabels: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefoldRepetition: 'Repetition',
  insufficientMaterial: 'Insufficient Material',
  draw: 'Draw',
  timeout: "Time's Up",
}

function parseMoveComparisons(raw: unknown): MoveEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((m): m is MoveEntry => {
    if (typeof m !== 'object' || m === null) return false
    const entry = m as Record<string, unknown>
    return typeof entry.turn === 'number' && typeof entry.fenAfter === 'string'
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

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col p-4 ${isMobile ? 'pb-16 pt-14' : ''}`}>
      <div className="max-w-xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4"
        >
          <button
            onClick={() => router.push('/history')}
            className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-yellow-400 text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className="text-xs text-gray-500">
            {new Date(game.played_at).toLocaleDateString()}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">
              {game.winner === 'WHITE' ? '🏆' : game.winner === 'DRAW' ? '🤝' : '💀'}
            </span>
            <span className="font-bold text-lg">
              {game.winner === 'WHITE' ? 'White Wins' : game.winner === 'DRAW' ? 'Draw' : 'Black Wins'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {game.game_result || (game.game_over_reason ? reasonLabels[game.game_over_reason] || game.game_over_reason : 'Game Over')}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
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

        <div className="mb-4">
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

        {moves.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <MovePlayback
              moves={moves}
              currentIndex={playbackIndex}
              initialFen={initialFen}
              onSelectMove={(index, fen) => {
                setPlaybackIndex(index)
                setPlaybackFen(fen)
              }}
              onReset={() => {
                setPlaybackIndex(null)
                setPlaybackFen(null)
              }}
            />
          </motion.div>
        )}

        {moves.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No move data available for this game.</p>
          </div>
        )}
      </div>
    </div>
  )
}
