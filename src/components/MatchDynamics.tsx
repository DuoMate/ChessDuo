'use client'

import { GameStats } from '@/features/offline/game/localGame'

interface MatchDynamicsProps {
  stats: GameStats
  bestMove?: { move: string; accuracy: number; player: string }
  worstMove?: { move: string; accuracy: number; player: string }
}

export function MatchDynamics({ stats, bestMove, worstMove }: MatchDynamicsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 glass-panel p-5 rounded-xl flex flex-col justify-between">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-base font-bold text-white">Match Dynamics</h3>
          <span className="material-symbols-outlined text-yellow-400">analytics</span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Sync Rate</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-yellow-400">{Math.round(stats.whiteSyncRate * 100)}%</span>
              <span className="material-symbols-outlined text-yellow-500/40 mb-1 text-sm">link</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Moves</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-white">{stats.whiteMovesPlayed}</span>
              <span className="material-symbols-outlined text-gray-500 mb-1 text-sm">format_list_numbered</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Conflicts</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-red-400">{stats.whiteConflicts}</span>
              <span className="material-symbols-outlined text-red-500/40 mb-1 text-sm">warning</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Accuracy</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-white">{Math.round(stats.player1Accuracy)}%</span>
              <span className="material-symbols-outlined text-gray-500 mb-1 text-sm">verified</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-xl space-y-5">
        {bestMove && (
          <div>
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <span className="material-symbols-outlined text-sm">workspace_premium</span>
              <p className="text-[10px] font-bold uppercase tracking-widest">Best Move</p>
            </div>
            <p className="text-lg font-bold text-white">{bestMove.move}</p>
            <p className="text-xs font-bold text-green-400">{bestMove.player} · {Math.round(bestMove.accuracy)}%</p>
          </div>
        )}
        {bestMove && worstMove && <div className="h-px bg-gray-700/50" />}
        {worstMove && (
          <div>
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <span className="material-symbols-outlined text-sm">error_outline</span>
              <p className="text-[10px] font-bold uppercase tracking-widest">Worst Move</p>
            </div>
            <p className="text-lg font-bold text-white">{worstMove.move}</p>
            <p className="text-xs font-bold text-red-400">{worstMove.player} · {Math.round(worstMove.accuracy)}%</p>
          </div>
        )}
      </div>
    </div>
  )
}
