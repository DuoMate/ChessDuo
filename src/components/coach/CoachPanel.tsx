'use client'

import { memo } from 'react'
import { Eye, EyeOff, Sparkles, Volume2, Trophy } from 'lucide-react'
import type { Suggestion, CoachFeedback, MoveVerdict } from '@/features/coach'
import { COACH_MOVE_RANKS, getCoachRank } from './coachMoveRanks'
import { CoachMoveRankBadge } from './CoachMoveRankBadge'
import { CoachMoveLegend } from './CoachMoveLegend'

export const VERDICT_STYLES: Record<MoveVerdict, { label: string; badge: string; text: string }> = {
  best: { label: 'Best move', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
  great: { label: 'Great', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
  good: { label: 'Good', badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30', text: 'text-sky-600 dark:text-sky-400' },
  inaccuracy: { label: 'Inaccuracy', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' },
  mistake: { label: 'Mistake', badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30', text: 'text-orange-600 dark:text-orange-400' },
  blunder: { label: 'Blunder', badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30', text: 'text-rose-600 dark:text-rose-400' },
}

const RANK_CARD_CLASSES: Record<1 | 2 | 3, string> = {
  1: 'border-emerald-500/30 bg-emerald-500/[0.07] dark:bg-emerald-400/[0.07]',
  2: 'border-sky-500/30 bg-sky-500/[0.07] dark:bg-sky-400/[0.07]',
  3: 'border-amber-500/30 bg-amber-500/[0.07] dark:bg-amber-400/[0.07]',
}

interface CoachPanelProps {
  suggestion: Suggestion | null
  feedback: CoachFeedback | null
  analyzing: boolean
  isPlayerTurn: boolean
  onSpeak?: (text: string) => void
  showBestMoves?: boolean
  onToggleBestMoves?: () => void
  /** @deprecated use showBestMoves */
  showBestMove?: boolean
  /** @deprecated use onToggleBestMoves */
  onToggleBestMove?: () => void
}

function CoachPanelInner({
  suggestion,
  feedback,
  analyzing,
  isPlayerTurn,
  onSpeak,
  showBestMoves,
  onToggleBestMoves,
  showBestMove,
  onToggleBestMove,
}: CoachPanelProps) {
  // Backward compat for existing callers/tests using the singular names.
  const expanded = showBestMoves ?? showBestMove ?? false
  const onToggle = onToggleBestMoves ?? onToggleBestMove
  // Stale-suggestion guard: only the current player's live suggestion is visualizable.
  const topMoves = isPlayerTurn ? (suggestion?.topMoves ?? []).slice(0, 3) : []

  return (
    <div className="space-y-3">
      {/* Suggestion — cards + evaluation hidden until the user opts in */}
      {isPlayerTurn && suggestion && (
        <section
          aria-label="AI Coach recommendation"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/60 dark:shadow-none"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
              <Sparkles size={14} aria-hidden="true" className="text-blue-500 dark:text-blue-400" /> Coach recommends
            </span>
            {expanded && topMoves.length > 0 && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{suggestion.evaluationDisplay}</span>
            )}
          </div>

          {expanded && topMoves.length > 0 && (
            <>
              <div className="space-y-1.5" role="list" aria-label="Top recommended moves" id="coach-top3">
                {topMoves.map((m, i) => {
                  const meta = getCoachRank(i)
                  const rank = meta.rank
                  return (
                    <div
                      key={m.uci}
                      role="listitem"
                      aria-label={`Option ${rank}: ${m.san}, ${m.display}, ${meta.label}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${RANK_CARD_CLASSES[rank]}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <CoachMoveRankBadge rank={rank} />
                        <span className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{m.san}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{meta.label}</span>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">{m.display}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2">
                <CoachMoveLegend />
              </div>
            </>
          )}

          {topMoves.length === 0 ? (
            <p className="text-xs text-slate-500">{analyzing ? 'Analyzing position…' : 'No recommendation available'}</p>
          ) : (
            onToggle && (
              <>
                <button
                  onClick={onToggle}
                  aria-expanded={expanded}
                  aria-controls="coach-top3"
                  aria-label={expanded ? 'Hide 3 Best Moves' : 'Show 3 Best Moves on the board'}
                  className="focus-ring mt-3 flex min-h-[44px] min-w-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-[var(--shadow-glow-emerald)] transition-colors hover:bg-emerald-400"
                >
                  {expanded ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  {expanded ? 'Hide 3 Best Moves' : 'Show 3 Best Moves'}
                </button>
                <p className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
                  {expanded
                    ? `Showing ${COACH_MOVE_RANKS.length} ranked moves — match ①②③ with the board.`
                    : 'AI Coach found 3 good moves — reveal them when ready.'}
                </p>
              </>
            )
          )}
        </section>
      )}

      {/* Feedback — shown after the player's move */}
      {feedback && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/60 dark:shadow-none">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${VERDICT_STYLES[feedback.verdict].badge}`}>
              {feedback.verdict === 'best' && <Trophy size={12} aria-hidden="true" />}
              {VERDICT_STYLES[feedback.verdict].label}
            </span>
            <div className="flex items-center gap-2">
              {feedback.centipawnLoss !== null && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400" title="Estimated centipawns lost on your last move">
                  −{feedback.centipawnLoss.toFixed(0)}cp lost
                </span>
              )}
              {onSpeak && (
                <button
                  onClick={() => onSpeak(feedback.explanation)}
                  aria-label="Read AI Coach feedback aloud"
                  className="focus-ring flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                >
                  <Volume2 size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{feedback.explanation}</p>
          {feedback.bestMoveSan && (
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Best move: <span className="font-bold text-blue-600 dark:text-blue-400">{feedback.bestMoveSan}</span>
            </p>
          )}
        </section>
      )}

      {!isPlayerTurn && !feedback && !analyzing && (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/60 dark:text-slate-400 dark:shadow-none">
          Waiting for the opponent… the coach returns on your turn.
        </p>
      )}

      {analyzing && (
        <p role="status" className="text-center text-[11px] text-slate-500 dark:text-slate-400">Coach is thinking…</p>
      )}
    </div>
  )
}

// Memoized — pure view over suggestion/feedback/analyzing flags. Board stays
// mounted separately; analyzing ticks with unchanged suggestion skip this tree.
export const CoachPanel = memo(CoachPanelInner)
