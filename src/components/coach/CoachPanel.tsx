'use client'

import { Sparkles, Volume2, Trophy } from 'lucide-react'
import type { Suggestion, CoachFeedback, MoveVerdict } from '@/features/coach'

const VERDICT_STYLES: Record<MoveVerdict, { label: string; badge: string; text: string }> = {
  best: { label: 'Best move', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', text: 'text-emerald-400' },
  great: { label: 'Great', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', text: 'text-emerald-400' },
  good: { label: 'Good', badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30', text: 'text-sky-400' },
  inaccuracy: { label: 'Inaccuracy', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', text: 'text-amber-400' },
  mistake: { label: 'Mistake', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', text: 'text-orange-400' },
  blunder: { label: 'Blunder', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', text: 'text-rose-400' },
}

interface CoachPanelProps {
  suggestion: Suggestion | null
  feedback: CoachFeedback | null
  analyzing: boolean
  isPlayerTurn: boolean
  onSpeak?: (text: string) => void
}

export function CoachPanel({ suggestion, feedback, analyzing, isPlayerTurn, onSpeak }: CoachPanelProps) {
  return (
    <div className="space-y-3">
      {/* Suggestion — shown while it's the player's turn to move */}
      {isPlayerTurn && suggestion && (
        <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
              <Sparkles size={14} className="text-blue-400" /> Coach recommends
            </span>
            <span className="text-xs font-semibold text-blue-400">{suggestion.evaluationDisplay}</span>
          </div>
          <div className="space-y-1.5">
            {suggestion.topMoves.length === 0 ? (
              <p className="text-xs text-slate-500">{analyzing ? 'Analyzing position…' : 'No recommendation available'}</p>
            ) : (
              suggestion.topMoves.map((m, i) => (
                <div key={m.uci} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/40 bg-slate-800/40 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-700/70 text-[11px] font-bold text-slate-300">{i + 1}</span>
                    <span className="min-w-0 truncate text-sm font-bold text-slate-100">{m.san}</span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-400">{m.display}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Feedback — shown after the player's move */}
      {feedback && (
        <section className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${VERDICT_STYLES[feedback.verdict].badge}`}>
              {feedback.verdict === 'best' && <Trophy size={12} />}
              {VERDICT_STYLES[feedback.verdict].label}
            </span>
            <div className="flex items-center gap-2">
              {feedback.centipawnLoss !== null && (
                <span className="text-[11px] text-slate-400">−{feedback.centipawnLoss.toFixed(0)}cp</span>
              )}
              {onSpeak && (
                <button
                  onClick={() => onSpeak(feedback.explanation)}
                  aria-label="Read AI Coach feedback aloud"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-blue-400"
                >
                  <Volume2 size={16} />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-200">{feedback.explanation}</p>
          {feedback.bestMoveSan && (
            <p className="mt-2 text-[11px] text-slate-400">
              Best move: <span className="font-bold text-blue-400">{feedback.bestMoveSan}</span>
            </p>
          )}
        </section>
      )}

      {analyzing && (
        <p className="text-center text-[11px] text-slate-500">Coach is thinking…</p>
      )}
    </div>
  )
}
