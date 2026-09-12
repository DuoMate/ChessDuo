'use client'

import type { CoachInsight } from '@/features/coach'
import { VERDICT_STYLES } from './CoachPanel'

/**
 * Coach Insights — HISTORICAL coaching timeline (oldest-first, matching the
 * existing Insights ordering). Each card shows what the coach said about a
 * past move, with the suggested best move rendered INLINE — no reveal click,
 * no gating. This deliberately differs from Quick/Duo/4P insights: Coach
 * entry is already premium/trial-gated and the live panel shows best moves
 * openly, so hiding them here would be inconsistent within Coach itself.
 *
 * Pure presentational view over `feedbackHistory`. Read-only.
 */
export function CoachInsightsPanel({ history }: { history: CoachInsight[] }) {
  if (history.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">No insights yet</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Make a move and the coach will comment on it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 py-4">
      {history.map((insight) => {
        const { feedback } = insight
        const style = VERDICT_STYLES[feedback.verdict]
        return (
          <article
            key={`insight-${insight.moveNumber}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700/50 dark:bg-slate-900/60"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Move {insight.moveNumber} · {feedback.playerMoveSan}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.badge}`}
              >
                {style.label}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              {feedback.explanation}
            </p>
            {feedback.bestMoveSan && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Best move: <span className="font-bold text-slate-900 dark:text-white">{feedback.bestMoveSan}</span>
                {feedback.centipawnLoss !== null && (
                  <span> · −{feedback.centipawnLoss} cp</span>
                )}
                {feedback.evaluationDisplay !== '—' && (
                  <span> · Eval {feedback.evaluationDisplay}</span>
                )}
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}
