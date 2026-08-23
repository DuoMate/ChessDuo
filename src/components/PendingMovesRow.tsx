'use client'

import { motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'
import { memo } from 'react'

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

function SubmittedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-[11px] font-semibold leading-4 text-green-300">
      <Check size={10} className="shrink-0" strokeWidth={3} aria-hidden />
      <span>Submitted</span>
    </span>
  )
}

/**
 * "Your Move" / "Teammate" status cards.
 *
 * Layout per card (robust at narrow widths — never relies on absolute
 * positioning for the Submitted badge):
 *
 *   [icon] [title row: label · name (truncate)]
 *          [move text (truncate)]
 *          [Submitted badge (shrink-0, own space)]
 *
 * Player names and moves truncate with ellipsis inside `min-w-0` containers so
 * a long username (e.g. VeryLongPlayerName123456789) can never overlap or push
 * the Submitted badge off the card.
 */
function MoveCard({
  icon,
  label,
  name,
  status,
  submitted,
  accentSubmitted,
  delay,
}: {
  icon: React.ReactNode
  label: string
  name?: string
  status: string
  submitted: boolean
  accentSubmitted: boolean
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`flex h-full min-h-[64px] items-center gap-2 rounded-xl border px-3 py-2 ${
        submitted
          ? 'border-green-500/40 bg-green-500/10'
          : accentSubmitted
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-slate-700/60 bg-slate-800/50'
      }`}
    >
      <div className="flex w-7 shrink-0 items-center justify-center self-center">{icon}</div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className={`min-w-0 truncate text-xs font-bold uppercase tracking-wider ${submitted ? 'text-green-400' : 'text-slate-400'}`}>
          {label}
        </p>
        {name ? (
          <p className="min-w-0 truncate text-[11px] leading-4 text-slate-300">{name}</p>
        ) : null}
        <p className="min-w-0 truncate text-sm font-bold text-slate-100">{status}</p>
      </div>

      {submitted && <SubmittedBadge />}
    </motion.div>
  )
}

function PendingMovesRowInner({
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
      <div className="mx-auto grid max-w-3xl grid-cols-2 items-stretch gap-2">
        <MoveCard
          icon={<span className="text-2xl leading-none">{pieceChar(yourMove?.piece, yourMove?.color)}</span>}
          label={yourLabel}
          name={yourName}
          status={yourMove?.san || 'Selecting...'}
          submitted={youSubmitted}
          accentSubmitted={false}
        />
        <MoveCard
          icon={
            teammateSubmitted ? (
              <span className="text-2xl leading-none">{pieceChar(teammateMove?.piece, teammateMove?.color)}</span>
            ) : (
              <Clock size={20} className="text-amber-400 animate-pulse" />
            )
          }
          label={teammateLabel}
          name={teammateName}
          status={teammateSubmitted ? teammateMove?.san || 'Submitted' : 'Waiting...'}
          submitted={teammateSubmitted}
          accentSubmitted
          delay={0.05}
        />
      </div>
    </div>
  )
}

export const PendingMovesRow = memo(PendingMovesRowInner, (prev, next) => {
  return (
    prev.yourMove?.san === next.yourMove?.san &&
    prev.yourMove?.piece === next.yourMove?.piece &&
    prev.yourMove?.color === next.yourMove?.color &&
    prev.teammateMove?.san === next.teammateMove?.san &&
    prev.teammateMove?.piece === next.teammateMove?.piece &&
    prev.teammateMove?.color === next.teammateMove?.color &&
    prev.yourLabel === next.yourLabel &&
    prev.teammateLabel === next.teammateLabel &&
    prev.yourName === next.yourName &&
    prev.teammateName === next.teammateName
  )
})
