'use client'

import { useRef, useState } from 'react'

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
  onSelectMove: (index: number, fen: string) => void
  onReset: () => void
}

export function MovePlayback({ moves, currentIndex, onSelectMove, onReset }: MovePlaybackProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showAll, setShowAll] = useState(false)

  if (moves.length === 0) return null

  const activeIndex = currentIndex ?? moves.length - 1
  const isLive = currentIndex === null

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(moves.length - 1, index))
    const move = moves[clamped]
    if (move) onSelectMove(clamped, move.fenAfter)
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden w-full">
      <div className="p-2 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-400">Moves</h3>
        <div className="flex items-center gap-1">
          {!isLive && (
            <button
              onClick={onReset}
              className="text-[10px] text-yellow-400 hover:text-yellow-300 px-1.5 py-0.5 rounded bg-yellow-400/10 transition-colors"
            >
              Live
            </button>
          )}
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[10px] text-gray-500 hover:text-gray-400 px-1"
          >
            {showAll ? 'compact' : 'all'}
          </button>
        </div>
      </div>

      {showAll ? (
        <div className="max-h-[200px] overflow-y-auto border-b border-gray-700/50">
          <table className="w-full text-xs">
            <tbody>
              {moves.map((m, i) => (
                <tr
                  key={i}
                  onClick={() => onSelectMove(i, m.fenAfter)}
                  className={`cursor-pointer border-b border-gray-700/30 ${
                    i === activeIndex && !isLive
                      ? 'bg-yellow-500/20'
                      : 'hover:bg-gray-700/30'
                  }`}
                >
                  <td className="py-1 px-2 text-gray-500 w-8 text-right font-mono">
                    {m.turn}.
                  </td>
                  <td className="py-1 px-1 w-6 text-gray-500">
                    {m.team === 'WHITE' ? 'W' : 'B'}
                  </td>
                  <td className="py-1 px-2 text-white">
                    {m.winningMove}
                    {!m.isSync && m.shadowMove && (
                      <span className="text-gray-600 line-through ml-1">
                        ({m.shadowMove})
                      </span>
                    )}
                    {m.isSync && (
                      <span className="text-green-400 ml-1">✓</span>
                    )}
                  </td>
                  <td className="py-1 px-2 text-gray-500 text-right">
                    {Math.round((m.player1Accuracy + m.player2Accuracy) / 2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-b border-gray-700/50">
          <p className="px-2 pt-1.5 text-[10px] text-gray-500">
            {isLive ? `${moves.length} moves` : `${activeIndex + 1}/${moves.length}`}
          </p>
          <div
            ref={scrollRef}
            className="overflow-x-auto whitespace-nowrap p-2 pt-0"
          >
            {moves.map((m, i) => (
              <span
                key={i}
                onClick={() => onSelectMove(i, m.fenAfter)}
                className={`inline-flex items-center cursor-pointer px-1.5 py-0.5 rounded text-xs transition-colors ${
                  i === activeIndex && !isLive
                    ? 'bg-yellow-400/20 text-yellow-400 font-medium'
                    : 'text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {m.winningMove}
                {!m.isSync && m.shadowMove && (
                  <span className="text-gray-600 line-through ml-0.5">
                    {m.shadowMove}
                  </span>
                )}
                {m.isSync && (
                  <span className="text-green-500 ml-0.5">✓</span>
                )}
                <span className="text-gray-600 ml-0.5">,</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 p-2">
        <button
          onClick={() => goTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-sm transition-colors"
        >
          ←
        </button>
        <button
          onClick={onReset}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] transition-colors ${
            isLive
              ? 'bg-yellow-500/30 text-yellow-400 ring-1 ring-yellow-400/50'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          ●
        </button>
        <button
          onClick={() => goTo(activeIndex + 1)}
          disabled={activeIndex >= moves.length - 1}
          className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-sm transition-colors"
        >
          →
        </button>
      </div>
    </div>
  )
}
