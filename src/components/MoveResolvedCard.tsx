'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Trophy, X, Check, ArrowRight, ChevronRight } from 'lucide-react'

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

interface MoveResolvedCardProps {
  open: boolean
  data: MoveResolutionData | null
  onNext: () => void
  onClose?: () => void
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

export function MoveResolvedCard({ open, data, onNext, onClose }: MoveResolvedCardProps) {
  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 80, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 shadow-2xl backdrop-blur-xl"
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
              <div className="flex flex-col items-center justify-center gap-1 px-1 min-w-[80px]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">Engine Chose</span>
                <div className="relative">
                  <Trophy size={14} className="absolute -top-1 left-1/2 -translate-x-1/2 text-amber-300" />
                  <div className="w-12 h-12 rounded-lg bg-slate-800/70 border border-emerald-500/30 flex items-center justify-center text-xl font-extrabold text-emerald-300">
                    {data.engineChoseMove.san}
                  </div>
                </div>
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

            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-300">
              <span>Better by</span>
              <span className={`font-extrabold ${data.scoreDelta > 0 ? 'text-emerald-300' : data.scoreDelta < 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                {data.scoreDelta > 0 ? '+' : ''}{data.scoreDelta.toFixed(2)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-slate-400">
              <span>Evaluation after move</span>
              <span className={`font-bold ${data.evaluationImproved ? 'text-emerald-300' : 'text-rose-300'}`}>
                {data.evaluationAfter > 0 ? '+' : ''}{data.evaluationAfter.toFixed(2)}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${data.evaluationImproved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {data.evaluationImproved ? 'Improved' : 'Declined'}
              </span>
            </div>

            <button
              type="button"
              onClick={onNext}
              className="mt-4 w-full min-h-[48px] rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-[0_0_24px_rgba(99,102,241,0.35)] hover:from-blue-400 hover:to-purple-400 transition-all"
            >
              Next Move
              <ChevronRight size={18} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
