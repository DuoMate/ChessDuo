'use client'

import { useRef, useEffect } from 'react'

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
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentIndex !== null && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-move-index]')
      const target = items[currentIndex]
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [currentIndex])

  if (moves.length === 0) return null

  const whiteMoves = moves.filter(m => m.team === 'WHITE')
  const blackMoves = moves.filter(m => m.team === 'BLACK')
  const maxRows = Math.max(whiteMoves.length, blackMoves.length)

  const getGlobalIndex = (row: number, team: 'WHITE' | 'BLACK'): number => {
    let count = 0
    for (const m of moves) {
      if (m.team === team) {
        if (count === row) return moves.indexOf(m)
        count++
      }
    }
    return -1
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Moves</h3>
        {currentIndex !== null && (
          <button
            onClick={onReset}
            className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            ← Live
          </button>
        )}
      </div>

      <div ref={listRef} className="max-h-[260px] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: maxRows }).map((_, row) => {
              const wIdx = getGlobalIndex(row, 'WHITE')
              const bIdx = getGlobalIndex(row, 'BLACK')
              const wMove = wIdx >= 0 ? moves[wIdx] : null
              const bMove = bIdx >= 0 ? moves[bIdx] : null

              return (
                <tr key={row} className="border-b border-gray-700/50">
                  <td className="py-1.5 px-2 text-gray-500 text-xs w-8 text-right font-mono">
                    {row + 1}.
                  </td>
                  <td
                    data-move-index={wIdx}
                    className={`py-1.5 px-2 cursor-pointer transition-colors w-[45%] ${
                      currentIndex === wIdx
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'hover:bg-gray-700/50 text-white'
                    }`}
                    onClick={() => wMove && onSelectMove(wIdx, wMove.fenAfter)}
                  >
                    {wMove && (
                      <div>
                        <span className="font-medium">{wMove.winningMove}</span>
                        {!wMove.isSync && wMove.shadowMove && (
                          <span className="text-gray-600 line-through ml-1 text-xs">
                            ({wMove.shadowMove})
                          </span>
                        )}
                        {wMove.isSync && (
                          <span className="text-green-400 ml-1 text-xs">✓</span>
                        )}
                        <span className="text-gray-600 text-[10px] ml-1">
                          {wMove.player1Accuracy}%
                        </span>
                      </div>
                    )}
                  </td>
                  <td
                    data-move-index={bIdx}
                    className={`py-1.5 px-2 cursor-pointer transition-colors w-[45%] ${
                      currentIndex === bIdx
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'hover:bg-gray-700/50 text-gray-400'
                    }`}
                    onClick={() => bMove && onSelectMove(bIdx, bMove.fenAfter)}
                  >
                    {bMove && (
                      <div>
                        <span className="font-medium">{bMove.winningMove}</span>
                        {!bMove.isSync && bMove.shadowMove && (
                          <span className="text-gray-600 line-through ml-1 text-xs">
                            ({bMove.shadowMove})
                          </span>
                        )}
                        {bMove.isSync && (
                          <span className="text-green-400 ml-1 text-xs">✓</span>
                        )}
                      </div>
                    )}
                    {bMove && !bMove && <span>&nbsp;</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="p-2 border-t border-gray-700 flex gap-4 text-[10px] text-gray-500 justify-center">
        <span>✓ sync</span>
        <span className="line-through">(shadow)</span>
        <span>SAN acc%</span>
      </div>
    </div>
  )
}
