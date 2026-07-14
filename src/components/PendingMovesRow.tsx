'use client'

import { motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'

export interface PendingMove {
  san?: string
  from?: string
  to?: string
  piece?: string
  color?: 'white' | 'black'
}

interface PendingMovesRowProps {
  yourMove: PendingMove | null
  teammateMove: PendingMove | null
  yourLabel?: string
  teammateLabel?: string
  /** Optional display name (e.g. "Alice", "WhiteBot"). Shown next to the label. */
  yourName?: string
  teammateName?: string
}

const PIECE_CHARS: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
}

function pieceChar(piece?: string, color?: 'white' | 'black'): string {
  if (!piece) return '♟'
  const key = color === 'white' ? piece.toUpperCase() : piece.toLowerCase()
  return PIECE_CHARS[key] || piece
}

export function PendingMovesRow({
  yourMove,
  teammateMove,
  yourLabel = 'Your Move',
  teammateLabel = 'Teammate',
  yourName,
  teammateName,
}: PendingMovesRowProps) {
  const youSubmitted = !!yourMove
  const teammateSubmitted = !!teammateMove

  return (
    <div className="w-full px-3">
      <div className="grid grid-cols-2 gap-2 max-w-3xl mx-auto">
        {/* Your Move */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`relative flex items-center gap-2 rounded-xl border px-3 py-2 ${
            youSubmitted
              ? 'border-green-500/40 bg-green-500/10'
              : 'border-slate-700/60 bg-slate-800/50'
          }`}
        >
          <div className="flex flex-col items-center justify-center min-w-[28px]">
            <span className="text-2xl leading-none">{pieceChar(yourMove?.piece, yourMove?.color)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${youSubmitted ? 'text-green-400' : 'text-slate-400'} truncate`}>
              {yourLabel}{yourName ? <> · <span className="text-slate-300 normal-case tracking-normal">{yourName}</span></> : null}
            </p>
            <p className="text-sm font-bold text-slate-100 truncate">
              {yourMove?.san || 'Selecting...'}
            </p>
          </div>
          {youSubmitted && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
              <Check size={10} />
              Submitted
            </span>
          )}
        </motion.div>

        {/* Teammate */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className={`relative flex items-center gap-2 rounded-xl border px-3 py-2 ${
            teammateSubmitted
              ? 'border-green-500/40 bg-green-500/10'
              : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          <div className="flex flex-col items-center justify-center min-w-[28px]">
            {teammateSubmitted ? (
              <span className="text-2xl leading-none">{pieceChar(teammateMove?.piece, teammateMove?.color)}</span>
            ) : (
              <Clock size={20} className="text-amber-400 animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wider ${teammateSubmitted ? 'text-green-400' : 'text-amber-400'} truncate`}>
              {teammateLabel}{teammateName ? <> · <span className="text-slate-300 normal-case tracking-normal">{teammateName}</span></> : null}
            </p>
            <p className="text-sm font-bold text-slate-100 truncate">
              {teammateSubmitted ? teammateMove?.san : 'Waiting...'}
            </p>
          </div>
          {teammateSubmitted && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
              <Check size={10} />
              Submitted
            </span>
          )}
        </motion.div>
      </div>
    </div>
  )
}
