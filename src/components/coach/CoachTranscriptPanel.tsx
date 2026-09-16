'use client'

import { memo } from 'react'
import { Bot } from 'lucide-react'
import type { CoachInsight, Suggestion } from '@/features/coach'

/**
 * Coach transcript — a read-only log of coach notes emitted this session, in
 * chronological order. Coach-specific and deliberately separate from the
 * 1:1 direct-message chat (`ChatPanel` + `messages.ts`): no peer, no send
 * box, no Supabase, no Realtime, no persistence, no unread badges.
 * Strictly a view over data the coach already produced.
 */
function CoachTranscriptPanelInner({
  history,
  suggestion,
}: {
  history: CoachInsight[]
  suggestion: Suggestion | null
}) {
  const hasNotes = history.length > 0 || suggestion !== null

  if (!hasNotes) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">No coach notes yet</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Coach notes from this session will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 py-4">
      {history.map((insight) => (
        <div
          key={`note-${insight.moveNumber}`}
          className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700/50 dark:bg-slate-900/60"
        >
          <span className="flex min-h-[32px] min-w-[32px] items-start justify-center pt-0.5 text-blue-400">
            <Bot size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Move {insight.moveNumber}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              {insight.feedback.explanation}
            </p>
          </div>
        </div>
      ))}
      {suggestion && suggestion.bestMoveSan && (
        <div className="flex gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3">
          <span className="flex min-h-[32px] min-w-[32px] items-start justify-center pt-0.5 text-blue-400">
            <Bot size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-500 dark:text-blue-300">
              Current suggestion
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              {suggestion.topMoves.map((m) => m.san).join(', ')} — open the Coach tab for the best-move preview.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Memoized — read-only log; suggestion/history identity gates re-renders.
export const CoachTranscriptPanel = memo(CoachTranscriptPanelInner)
