'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getCompletedGame, type CompletedGame } from '@/lib/matchHistory'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const ReplayViewComponent = dynamic(() => import('@/components/ReplayView').then(mod => ({ default: mod.ReplayView })), {
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading replay...</p>
      </div>
    )
  }

  if (!game || error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold mb-2">Game Not Found</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">This replay is no longer available.</p>
        <Link
          href="/history"
          className="px-6 py-2 bg-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-yellow-400 text-sm"
        >
          Back to History
        </Link>
      </div>
    )
  }

  return <ReplayViewComponent game={game} />
}
