'use client'

interface StatsTickerProps {
  syncRate: number
  conflicts: number
  totalMoves?: number
}

export function StatsTicker({ syncRate, conflicts, totalMoves }: StatsTickerProps) {
  return (
    <footer className="fixed bottom-0 left-0 w-full h-10 bg-gray-950 border-t border-gray-800/50 z-50 flex items-center px-4">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sync Rate</span>
          <span className="text-xs font-bold text-yellow-400">{Math.round(syncRate * 100)}%</span>
          <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.round(syncRate * 100)}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Conflicts</span>
          <span className="text-xs font-bold text-white">{String(conflicts).padStart(2, '0')}</span>
        </div>
        {totalMoves !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Moves</span>
            <span className="text-xs font-bold text-white">{totalMoves}</span>
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-6 opacity-40">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">wifi</span>
          <span className="text-[10px] font-bold">12ms</span>
        </div>
      </div>
    </footer>
  )
}
