'use client'

interface StatsTickerProps {
  totalMoves?: number
}

export function StatsTicker({ totalMoves }: StatsTickerProps) {
  return (
    <footer className="fixed bottom-0 left-0 w-full h-10 bg-gray-950 border-t border-gray-800/50 z-50 flex items-center px-4">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Moves</span>
          <span className="text-xs font-bold text-white">{totalMoves ?? 0}</span>
        </div>
      </div>
    </footer>
  )
}
