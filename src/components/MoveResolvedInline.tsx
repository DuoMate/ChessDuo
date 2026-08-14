'use client'

import { motion } from 'framer-motion'
import { Zap, Trophy, X, Check, ChevronRight, Sparkles, Target, Lightbulb, AlertTriangle, XCircle } from 'lucide-react'
import { classifyMove } from '@/lib/moveClassifier'
import { getAccuracyCategory } from '@/features/shared/accuracy'

function getMoveImpact(san: string): string {
  if (!san) return ''
  if (san.includes('#')) return 'Checkmate!'
  if (san.includes('+')) return 'Puts king in check'
  if (san.includes('O-O-O')) return 'Queenside castling — king is safer'
  if (san.includes('O-O')) return 'Kingside castling — king is safer'
  if (san.includes('x')) return 'Captured a piece'
  if (san.includes('=')) return 'Promoted a pawn'
  return ''
}

function getBlunderWarning(loss: number): { label: string; colorClass: string; Icon: typeof XCircle } | null {
  if (loss >= 500) return { label: 'Critical blunder — lost a piece!', colorClass: 'text-rose-400', Icon: XCircle }
  if (loss >= 200) return { label: 'Blunder — costly mistake', colorClass: 'text-amber-400', Icon: AlertTriangle }
  if (loss >= 100) return { label: 'Inaccuracy — missed a better move', colorClass: 'text-yellow-400', Icon: AlertTriangle }
  return null
}

export interface MoveResolutionData {
  yourMove: { san: string; piece?: string; color?: 'white' | 'black' }
  teammateMove: { san: string; piece?: string; color?: 'white' | 'black' }
  engineChoseMove: { san: string }
  yourAccuracy: number
  teammateAccuracy: number
  yourLoss: number
  teammateLoss: number
  isSync: boolean
  youMatchedEngine: boolean
  teammateMatchedEngine: boolean
  result: 'you_won' | 'teammate_won' | 'draw' | 'pending'
  scoreDelta: number
  evaluationAfter: number
  evaluationImproved: boolean
}

interface MoveResolvedInlineProps {
  data: MoveResolutionData
  onNext: () => void
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

function MoveColumn({
  label,
  move,
  accuracy,
  outcome,
  tone,
}: {
  label: string
  move: { san: string; piece?: string; color?: 'white' | 'black' }
  accuracy: number
  outcome: 'won' | 'lost' | 'tied'
  tone: 'blue' | 'slate' | 'green'
}) {
  const labelClass = {
    blue: 'text-blue-300',
    slate: 'text-slate-300',
    green: 'text-emerald-300',
  }[tone]
  const accClass = {
    blue: 'text-blue-400',
    slate: 'text-slate-400',
    green: 'text-emerald-400',
  }[tone]
  const borderClass = {
    blue: 'border-blue-500/30',
    slate: 'border-slate-600/30',
    green: 'border-emerald-500/30',
  }[tone]
  const bgClass = {
    blue: 'bg-blue-500/5',
    slate: 'bg-slate-800/40',
    green: 'bg-emerald-500/5',
  }[tone]

  return (
    <div className={`flex-1 rounded-xl border ${borderClass} ${bgClass} px-3 py-3 flex flex-col items-center gap-1 min-w-0`}>
      <span className={`text-xs font-bold uppercase tracking-wider ${labelClass}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-2xl leading-none">{pieceChar(move.piece, move.color)}</span>
        <span className="text-lg font-extrabold text-slate-100">{move.san}</span>
      </div>
      <span className={`text-xs font-semibold uppercase tracking-wider text-slate-400`}>Accuracy</span>
      <span className={`text-2xl font-extrabold ${accClass}`}>{accuracy.toFixed(1)}</span>
      <div className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
        outcome === 'won' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : outcome === 'lost' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'
      }`}>
        {outcome === 'won' && <Check size={10} />}
        {outcome === 'lost' && <X size={10} />}
        {outcome === 'won' ? 'Won' : outcome === 'lost' ? 'Lost' : 'Tied'}
      </div>
    </div>
  )
}

export function MoveResolvedInline({ data, onNext }: MoveResolvedInlineProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="w-full max-w-3xl mx-auto rounded-2xl border border-blue-500/30 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <Zap size={14} className="text-blue-400" />
        <span className="text-sm font-extrabold uppercase tracking-[0.2em] text-slate-100">
          Move Resolved
        </span>
      </div>

      <div className="flex items-stretch gap-2">
        <MoveColumn
          label="Your Move"
          move={data.yourMove}
          accuracy={data.yourAccuracy}
          outcome={data.result === 'you_won' ? 'won' : data.result === 'teammate_won' ? 'lost' : 'tied'}
          tone="blue"
        />
        <div className="flex flex-col items-center justify-center gap-2 px-2 py-3 min-w-[100px] rounded-xl border border-blue-500/40 bg-blue-500/5">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Engine Chose</span>
          <Trophy size={22} className="text-amber-400" />
          <span className="text-2xl font-extrabold text-blue-300">
            {data.engineChoseMove.san}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Played
          </span>
        </div>
        <MoveColumn
          label="Teammate"
          move={data.teammateMove}
          accuracy={data.teammateAccuracy}
          outcome={data.result === 'teammate_won' ? 'won' : data.result === 'you_won' ? 'lost' : 'tied'}
          tone="slate"
        />
      </div>

      {(() => {
        const san = data.engineChoseMove.san || ''
        const moveClass = classifyMove(san)
        const moveImpact = getMoveImpact(san)
        // Headline insight line — mirrors the AccuracyBottomSheet phrasing.
        let headline = ''
        let HeadlineIcon: typeof Sparkles = Sparkles
        let headlineColor = 'text-amber-300'
        if (data.isSync) {
          headline = 'Both played exactly the same move!'
          HeadlineIcon = Sparkles
          headlineColor = 'text-amber-300'
        } else if (data.youMatchedEngine && data.teammateMatchedEngine) {
          headline = 'Perfect — both matched the engine\u2019s best move!'
          HeadlineIcon = Sparkles
          headlineColor = 'text-amber-300'
        } else if (data.youMatchedEngine) {
          headline = 'You found the engine\u2019s top move!'
          HeadlineIcon = Target
          headlineColor = 'text-emerald-300'
        } else if (data.teammateMatchedEngine) {
          headline = 'Teammate found the engine\u2019s best move'
          HeadlineIcon = Lightbulb
          headlineColor = 'text-blue-300'
        }
        // The "loser" gets a blunder warning if their loss is large.
        const isYouWinner = data.result === 'you_won'
        const loserLoss = isYouWinner ? data.teammateLoss : data.yourLoss
        const loserName = isYouWinner ? 'Teammate' : 'You'
        const blunder = !data.isSync ? getBlunderWarning(loserLoss) : null
        // The winner gets the quality verdict (Perfect / Great / Good / …).
        const winnerAcc = isYouWinner ? data.yourAccuracy : data.teammateAccuracy
        const winnerCpLoss = winnerAcc >= 100 ? 0 : winnerAcc <= 0 ? 300 : Math.round(10 + (100 - winnerAcc) * (290 / 100))
        const verdict = getAccuracyCategory(winnerCpLoss)
        return (
          <div className="mt-3 px-2 py-2.5 rounded-xl border border-slate-700/60 bg-slate-900/50 space-y-1.5">
            {headline && (
              <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium">
                <HeadlineIcon size={14} className={headlineColor} />
                <span className={headlineColor}>{headline}</span>
              </div>
            )}
            {moveImpact && (
              <p className="text-center text-[11px] text-slate-300">
                {moveImpact}
              </p>
            )}
            {!data.isSync && blunder && (
              <p className={`text-center text-[11px] font-semibold inline-flex items-center justify-center gap-1 w-full ${blunder.colorClass}`}>
                <blunder.Icon size={12} /> {loserName}: {blunder.label}
              </p>
            )}
            {!data.isSync && (
              <div className="flex items-center justify-center gap-1.5 text-xs flex-wrap">
                <span
                  className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    verdict.color === '#22c55e' ? 'bg-emerald-500/10 text-emerald-400' :
                    verdict.color === '#84cc16' ? 'bg-lime-500/10 text-lime-400' :
                    verdict.color === '#eab308' ? 'bg-yellow-500/10 text-yellow-400' :
                    verdict.color === '#ef4444' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-slate-700/40 text-slate-300'
                  }`}
                >
                  {verdict.emoji}{verdict.label} move
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">{loserLoss}cp lost</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="text-base leading-none" aria-hidden>{moveClass.icon}</span>
              <span>{moveClass.description}</span>
            </div>
          </div>
        )
      })()}

      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full min-h-[52px] rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white shadow-[var(--shadow-glow-emerald-strong)] transition-all"
      >
        Continue
        <ChevronRight size={18} />
      </button>
    </motion.div>
  )
}
