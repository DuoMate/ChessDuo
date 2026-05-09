'use client'

import { TurnEntry } from '@/lib/resultsStore'

interface MoveHistoryTableProps {
  turns: TurnEntry[]
}

export function MoveHistoryTable({ turns }: MoveHistoryTableProps) {
  return (
    <div className="glass-panel rounded-xl flex flex-col max-h-[600px]">
      <div className="p-4 border-b border-gray-700/30 flex justify-between items-center">
        <h3 className="text-sm font-bold text-white">Move History</h3>
        <span className="text-xs font-bold text-gray-500">{turns.length} Turns</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-gray-900/90 backdrop-blur z-20">
            <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-700/30">
              <th className="p-3">Turn</th>
              <th className="p-3">You</th>
              <th className="p-3">Teammate</th>
              <th className="p-3 text-center">Res</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {turns.map((turn) => (
              <tr
                key={turn.turnNumber}
                className={`border-b border-gray-700/20 hover:bg-gray-700/20 transition-colors ${turn.isSync ? 'bg-green-500/5' : ''}`}
              >
                <td className="p-3 text-gray-500 text-xs">{String(turn.turnNumber).padStart(2, '0')}</td>
                <td className={`p-3 ${turn.winnerId === 'player1' ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {turn.player1Move}
                  <span className="text-[10px] text-gray-500 ml-1">{Math.round(turn.player1Accuracy)}%</span>
                </td>
                <td className={`p-3 ${turn.winnerId === 'player2' ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {turn.player2Move}
                  <span className="text-[10px] text-gray-500 ml-1">{Math.round(turn.player2Accuracy)}%</span>
                </td>
                <td className="p-3 text-center">
                  {turn.isSync ? (
                    <span className="material-symbols-outlined text-sm text-emerald-400">link</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm text-red-400">warning</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {turns.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">No moves recorded</div>
        )}
      </div>
    </div>
  )
}
