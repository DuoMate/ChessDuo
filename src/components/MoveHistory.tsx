'use client'

import { useState } from 'react'

interface TurnEntry {
  turnNumber: number
  player1Move: string
  player1Accuracy: number
  player2Move: string
  player2Accuracy: number
  isSync: boolean
  winnerId: string
}

interface MoveHistoryProps {
  turns: TurnEntry[]
  roomCode?: string
  isOnline?: boolean
}

const PAGE_SIZE = 5

export function MoveHistory({ turns, roomCode, isOnline }: MoveHistoryProps) {
  const [pageIndex, setPageIndex] = useState(0)

  const totalPages = Math.max(1, Math.ceil(turns.length / PAGE_SIZE))
  const start = pageIndex * PAGE_SIZE
  const visibleTurns = turns.slice(start, start + PAGE_SIZE)

  const goPrev = () => setPageIndex(p => Math.max(0, p - 1))
  const goNext = () => setPageIndex(p => Math.min(totalPages - 1, p + 1))

  return (
    <aside className="w-64 glass-panel border-l border-gray-700/30 flex flex-col shrink-0">
      <div className="p-3 border-b border-gray-700/30">
        <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">history</span>
          ChessDuo
        </h2>
      </div>

      {isOnline && roomCode && (
        <div className="px-3 py-2 border-b border-gray-700/30">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Room: </span>
          <span className="text-xs font-bold text-yellow-400 font-mono">{roomCode}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-3">
            <span className="material-symbols-outlined text-3xl text-gray-600 mb-2">history</span>
            <p className="text-xs text-gray-500">No moves yet</p>
            <p className="text-[10px] text-gray-600">Make your first move!</p>
          </div>
        ) : (
          visibleTurns.map((turn) => (
            <div
              key={turn.turnNumber}
              className={`p-2 rounded-lg text-xs border ${
                turn.isSync
                  ? 'border-green-800/30 bg-green-500/5'
                  : turn.winnerId === 'player1'
                    ? 'border-yellow-500/30 bg-yellow-500/5'
                    : 'border-gray-700/30 bg-gray-700/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-500">
                  {String(turn.turnNumber).padStart(2, '0')}
                </span>
                {turn.isSync ? (
                  <span className="material-symbols-outlined text-xs text-green-400">link</span>
                ) : turn.winnerId === 'player1' ? (
                  <span className="material-symbols-outlined text-xs text-yellow-400">check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-xs text-gray-500">swap_horiz</span>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className={`font-mono ${turn.winnerId === 'player1' ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                  {turn.player1Move}
                </span>
                <span className={`font-mono ${turn.winnerId === 'player2' ? 'text-yellow-400 font-bold' : 'text-gray-400'}`}>
                  {turn.player2Move}
                </span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] ${turn.winnerId === 'player1' ? 'text-green-400' : 'text-gray-500'}`}>
                    {Math.round(turn.player1Accuracy)}%
                  </span>
                  <div className="w-8 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${turn.player1Accuracy}%`,
                        backgroundColor: turn.player1Accuracy >= 90 ? '#22c55e' : turn.player1Accuracy >= 70 ? '#eab308' : '#ef4444'
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${turn.player2Accuracy}%`,
                        backgroundColor: turn.player2Accuracy >= 90 ? '#22c55e' : turn.player2Accuracy >= 70 ? '#eab308' : '#ef4444'
                      }}
                    />
                  </div>
                  <span className={`text-[9px] ${turn.winnerId === 'player2' ? 'text-green-400' : 'text-gray-500'}`}>
                    {Math.round(turn.player2Accuracy)}%
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {turns.length > 0 && (
        <div className="p-2 border-t border-gray-700/30 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={pageIndex === 0}
            className="p-1 text-gray-400 hover:text-yellow-400 disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </button>
          <span className="text-[10px] font-bold text-gray-500">
            {start + 1}-{Math.min(start + PAGE_SIZE, turns.length)} of {turns.length}
          </span>
          <button
            onClick={goNext}
            disabled={pageIndex >= totalPages - 1}
            className="p-1 text-gray-400 hover:text-yellow-400 disabled:opacity-30 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      )}
    </aside>
  )
}
