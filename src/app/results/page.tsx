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
      <header className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 h-16 flex items-center px-4">
        <span className="text-2xl font-extrabold italic uppercase tracking-tighter text-yellow-400">ChessDuo</span>
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
    </div>
  )
}
