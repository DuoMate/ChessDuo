'use client'

import { motion } from 'framer-motion'
import { Zap, Trophy, X, Check, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { classifyMove } from '@/lib/moveClassifier'
import { getAccuracyCategory } from '@/features/shared/accuracy'

export interface MoveResolutionData {
  yourMove: { san: string; piece?: string; color?: 'white' | 'black' }
  teammateMove: { san: string; piece?: string; color?: 'white' | 'black' }
  engineChoseMove: { san: string }
  yourAccuracy: number
  teammateAccuracy: number
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
  tone: 'blue' | 'purple' | 'green'
}) {
  const labelClass = {
    blue: 'text-blue-300',
    purple: 'text-purple-300',
    green: 'text-emerald-300',
  }[tone]
  const accClass = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-emerald-400',
  }[tone]
  const borderClass = {
    blue: 'border-blue-500/30',
    purple: 'border-purple-500/30',
    green: 'border-emerald-500/30',
  }[tone]
  const bgClass = {
    blue: 'bg-blue-500/5',
    purple: 'bg-purple-500/5',
    green: 'bg-emerald-500/5',
  }[tone]

  return (
    <div className={`flex-1 rounded-xl border ${borderClass} ${bgClass} px-3 py-3 flex flex-col items-center gap-1 min-w-0`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${labelClass}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-2xl leading-none">{pieceChar(move.piece, move.color)}</span>
        <span className="text-lg font-extrabold text-slate-100">{move.san}</span>
      </div>
      <span className={`text-[10px] font-semibold uppercase tracking-wider text-slate-400`}>Accuracy</span>
      <span className={`text-2xl font-extrabold ${accClass}`}>{accuracy.toFixed(1)}</span>
      <div className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
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
      className="w-full max-w-3xl mx-auto rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        <Zap size={16} className="text-amber-400" />
        <span className="text-sm font-extrabold uppercase tracking-[0.2em] text-amber-300">
          Move Resolved
        </span>
        <Zap size={16} className="text-amber-400" />
      </div>

      <div className="flex items-stretch gap-2">
        <MoveColumn
          label="Your Move"
          move={data.yourMove}
          accuracy={data.yourAccuracy}
          outcome={data.result === 'you_won' ? 'won' : data.result === 'teammate_won' ? 'lost' : 'tied'}
          tone="blue"
        />
        <div className="flex flex-col items-center justify-center gap-2 px-1 min-w-[100px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Engine Chose</span>
          <Trophy size={22} className="text-amber-300" />
          <span className="text-2xl font-extrabold text-emerald-300">
            {data.engineChoseMove.san}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Played
          </span>
        </div>
        <MoveColumn
          label="Teammate"
          move={data.teammateMove}
          accuracy={data.teammateAccuracy}
          outcome={data.result === 'teammate_won' ? 'won' : data.result === 'you_won' ? 'lost' : 'tied'}
          tone="purple"
        />
      </div>

      {(() => {
        const san = data.engineChoseMove.san || ''
        const moveClass = classifyMove(san)
        // Reverse-derive centipawn loss from the winner's accuracy (Lichess model).
        const acc = data.result === 'you_won' ? data.yourAccuracy : data.teammateAccuracy
        const cpLoss = acc >= 100 ? 0 : acc <= 0 ? 300 : Math.round(10 + (100 - acc) * (290 / 100))
        const verdict = getAccuracyCategory(cpLoss)
        const verdictTone = verdict.color
        const improved = data.evaluationImproved
        const delta = data.scoreDelta
        const evalText = `${data.evaluationAfter > 0 ? '+' : ''}${data.evaluationAfter.toFixed(2)}`
        const deltaText = `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`
        return (
          <div className="mt-3 px-2 py-2.5 rounded-xl border border-slate-700/60 bg-slate-900/50">
            <div className="flex items-center justify-center gap-1.5 text-[11px]">
              <span className="text-base leading-none" aria-hidden>{moveClass.icon}</span>
              <span className="text-slate-200 font-semibold">{moveClass.description}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] flex-wrap">
              <span
                className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${verdictTone}22`, color: verdictTone }}
              >
                {verdict.emoji}{verdict.label}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">Evaluation</span>
              <span className={`font-bold ${improved ? 'text-emerald-300' : 'text-rose-300'}`}>{evalText}</span>
              <span className={`flex items-center gap-0.5 font-bold ${improved ? 'text-emerald-300' : 'text-rose-300'}`}>
                {improved ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {improved ? 'Improved' : 'Declined'} {deltaText}
              </span>
            </div>
          </div>
        )
      })()}

      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full min-h-[52px] rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] transition-all"
      >
        Continue
        <ChevronRight size={18} />
      </button>
    </motion.div>
  )
}
