'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'

export interface MoveEntry {
  turn: number
  team: 'WHITE' | 'BLACK'
  winningMove: string
  winningMoveUci: string
  shadowMove: string | null
  shadowMoveUci: string | null
  isSync: boolean
  player1Accuracy: number
  player2Accuracy: number
  fenAfter: string
}

interface MovePlaybackProps {
  moves: MoveEntry[]
  currentIndex: number | null
  initialFen: string
  onSelectMove: (index: number, fen: string) => void
  onReset: () => void
}

export function MovePlayback({ moves, currentIndex, initialFen, onSelectMove, onReset }: MovePlaybackProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showAll, setShowAll] = useState(false)

  if (moves.length === 0) return null

  const activeIndex = currentIndex ?? moves.length - 1
  const isLive = currentIndex === null

  const goTo = (index: number) => {
    if (index < 0) {
      onSelectMove(-1, initialFen)
      return
    }
    const clamped = Math.min(moves.length - 1, index)
    const move = moves[clamped]
    if (move) onSelectMove(clamped, move.fenAfter)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden w-full">
      <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Moves</h3>
        <div className="flex items-center gap-1">
          {!isLive && (
            <button
              onClick={onReset}
              className="focus-ring text-xs text-yellow-600 hover:text-yellow-500 dark:text-yellow-400 dark:hover:text-yellow-300 px-1.5 py-0.5 min-h-[44px] rounded bg-yellow-500/10 transition-colors"
            >
              Live
            </button>
          )}
          <button
            onClick={() => setShowAll(!showAll)}
            className="focus-ring text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 px-2 min-h-[44px] min-w-[44px]"
            aria-label={showAll ? 'Show compact move list' : 'Show all moves'}
          >
            {showAll ? 'compact' : 'all'}
          </button>
        </div>
      </div>

      {showAll ? (
        <div className="max-h-[200px] overflow-y-auto border-b border-slate-200 dark:border-slate-700/50">
          <table className="w-full text-xs">
            <tbody>
              {moves.map((m, i) => (
                <tr
                  key={i}
                  onClick={() => onSelectMove(i, m.fenAfter)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectMove(i, m.fenAfter)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Go to move ${m.turn}: ${m.winningMove}`}
                  className={`cursor-pointer border-b border-slate-200 dark:border-slate-700/30 focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700/40 ${
                    i === activeIndex && !isLive
                      ? 'bg-yellow-500/20'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/30'
                  }`}
                >
                  <td className="py-1 px-2 text-slate-500 dark:text-slate-400 w-8 text-right font-mono">
                    {m.turn}.
                  </td>
                  <td className="py-1 px-1 w-6 text-slate-400 dark:text-slate-500">
                    {m.team === 'WHITE' ? 'W' : 'B'}
                  </td>
                  <td className="py-1 px-2 text-slate-900 dark:text-white">
                    {m.winningMove}
                    {!m.isSync && m.shadowMove && (
                      <span className="text-slate-400 dark:text-slate-500 line-through ml-1">
                        ({m.shadowMove})
                      </span>
                    )}
                    {m.isSync && (
                      <span className="text-green-600 dark:text-green-400 ml-1">✓</span>
                    )}
                  </td>
                  <td className="py-1 px-2 text-slate-500 dark:text-slate-400 text-right">
                    {Math.round((m.player1Accuracy + m.player2Accuracy) / 2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-b border-slate-200 dark:border-slate-700/50">
          <p className="px-2 pt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {isLive ? `${moves.length} moves` : activeIndex === -1 ? 'Start' : `${activeIndex + 1}/${moves.length}`}
          </p>
          <div
            ref={scrollRef}
            className="overflow-x-auto whitespace-nowrap p-2 pt-0"
          >
            {moves.map((m, i) => (
              <span
                key={i}
                onClick={() => onSelectMove(i, m.fenAfter)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectMove(i, m.fenAfter)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Go to move ${m.turn}: ${m.winningMove}`}
                className={`inline-flex items-center cursor-pointer px-1.5 py-0.5 rounded text-xs transition-colors focus-visible:outline-none focus-visible:bg-yellow-500/20 ${
                  i === activeIndex && !isLive
                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-medium'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50'
                }`}
              >
                {m.winningMove}
                {!m.isSync && m.shadowMove && (
                  <span className="text-slate-400 dark:text-slate-500 line-through ml-0.5">
                    {m.shadowMove}
                  </span>
                )}
                {m.isSync && (
                  <span className="text-green-600 dark:text-green-500 ml-0.5">✓</span>
                )}
                <span className="text-slate-400 dark:text-slate-500 ml-0.5">,</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 p-2">
        <button
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === -1}
          aria-label="Previous move"
          className="focus-ring min-h-[44px] min-w-[44px] rounded-full bg-slate-200 hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 text-sm transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={onReset}
          aria-label="Back to live position"
          className={`focus-ring min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-xs transition-colors ${
            isLive
              ? 'bg-yellow-500/30 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-500/50'
              : 'bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
          }`}
        >
          <Circle size={14} fill="currentColor" aria-hidden="true" />
        </button>
        <button
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex >= moves.length - 1}
          aria-label="Next move"
          className="focus-ring min-h-[44px] min-w-[44px] rounded-full bg-slate-200 hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 text-sm transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
