'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getCompletedGame, type CompletedGame } from '@/lib/matchHistory'
import dynamic from 'next/dynamic'
import { BackButton } from '@/components/BackButton'

const ReplayViewComponent = dynamic(() => import('@/components/ReplayView').then(mod => ({ default: mod.ReplayView })), {
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center pb-20">
      <p className="text-gray-500 dark:text-gray-400">Loading replay...</p>
    </div>
  ),
  ssr: false,
})

export default function ReplayPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const [game, setGame] = useState<CompletedGame | null | undefined>(undefined)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const result = await getCompletedGame(gameId)
        if (result) {
          setGame(result)
        } else {
          setGame(null)
        }
      } catch {
        setError(true)
        setGame(null)
      }
    }
    load()
  }, [gameId])

  if (game === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center pb-20">
        <p className="text-gray-500 dark:text-gray-400">Loading replay...</p>
      </div>
    )
  }

  if (!game || error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
        <h1 className="text-xl font-bold mb-2">Game Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">This replay is no longer available.</p>
        <BackButton label="Back to History" fallbackHref="/history" />
      </div>
    )
  }

  return <ReplayViewComponent game={game} />
}
