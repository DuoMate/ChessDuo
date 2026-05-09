'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getGameResult } from '@/lib/resultsStore'
import { HeroBanner } from '@/components/HeroBanner'
import { MatchDynamics } from '@/components/MatchDynamics'
import { MoveQualityBreakdown } from '@/components/MoveQualityBreakdown'
import { MoveHistoryTable } from '@/components/MoveHistoryTable'

export default function ResultsPage() {
  const router = useRouter()
  const result = getGameResult()

  useEffect(() => {
    if (!result) {
      router.push('/')
    }
  }, [result, router])

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading results...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 h-16 flex items-center justify-between px-4">
        <span className="text-2xl font-extrabold italic uppercase tracking-tighter text-yellow-400">ClashMate</span>
        <div className="hidden md:flex gap-6">
          <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">War Room</span>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tournaments</span>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leaderboard</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-500 hover:text-yellow-400 transition-colors rounded-lg">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="w-9 h-9 rounded-full border border-yellow-500/30 bg-gray-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-yellow-400 text-sm">person</span>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-8 px-4 max-w-[1400px] mx-auto w-full">
        <HeroBanner
          result={result.result}
          teamName={result.team === 'WHITE' ? 'TEAM WHITE' : 'TEAM BLACK'}
          difficulty={result.difficulty}
          onPlayAgain={() => router.push(`/game?level=${result.difficulty}`)}
          onChangeDifficulty={() => router.push('/')}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <MatchDynamics
              stats={result.stats}
              bestMove={result.bestMove}
              worstMove={result.worstMove}
            />
            <MoveQualityBreakdown
              player1Accuracy={result.stats.player1Accuracy}
              player2Accuracy={result.stats.player2Accuracy}
              categories={result.categoryBreakdown}
            />
          </div>

          <div className="lg:col-span-4">
            <MoveHistoryTable turns={result.turnHistory} />
          </div>
        </div>
      </main>

      <footer className="w-full bg-gray-950 border-t border-gray-800/50">
        <div className="flex flex-col md:flex-row justify-between items-center p-4 gap-3 max-w-[1400px] mx-auto">
          <span className="text-base font-bold text-yellow-400">ClashMate</span>
          <p className="text-[10px] font-bold text-gray-600 uppercase">ClashMate. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="text-[10px] font-bold text-gray-600 hover:text-yellow-400 transition-colors cursor-pointer">Terms</span>
            <span className="text-[10px] font-bold text-gray-600 hover:text-yellow-400 transition-colors cursor-pointer">Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
