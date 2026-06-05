'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { ErrorBoundary, GameErrorFallback } from '@/components/ErrorBoundary'

const GameComponent = dynamic(() => import('@/components/Game').then(mod => ({ default: mod.Game })), {
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400">Loading game...</p>
    </div>
  ),
  ssr: false,
})

function GameContent() {
  const searchParams = useSearchParams()
  const level = searchParams.get('level') ? parseInt(searchParams.get('level')!, 10) : undefined
  const mode = searchParams.get('mode')
  const roomId = searchParams.get('room')
  const roomCode = searchParams.get('code')
  const team = searchParams.get('team') as 'WHITE' | 'BLACK' | undefined
  const playerId = searchParams.get('playerId')
  const timeLimit = searchParams.get('time') ? parseInt(searchParams.get('time')!, 10) : undefined
  const challengeId = searchParams.get('challengeId')
  const fourplayer = searchParams.get('fourplayer') === '1'

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <GameComponent
        level={level}
        mode={mode}
        roomId={roomId}
        roomCode={roomCode}
        team={team}
        playerId={playerId}
        timeLimitSeconds={timeLimit}
        challengeId={challengeId}
        fourplayer={fourplayer}
      />
    </ErrorBoundary>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}
