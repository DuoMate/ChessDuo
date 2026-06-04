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

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; mode?: string; room?: string; code?: string; team?: string; playerId?: string; time?: string; challengeId?: string }>
}) {
  const resolved = await searchParams
  const level = resolved.level ? parseInt(resolved.level, 10) : undefined
  const mode = resolved.mode
  const roomId = resolved.room
  const roomCode = resolved.code
  const team = resolved.team as 'WHITE' | 'BLACK' | undefined
  const playerId = resolved.playerId
  const timeLimit = resolved.time ? parseInt(resolved.time, 10) : undefined
  const challengeId = resolved.challengeId

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <GameComponent level={level} mode={mode} roomId={roomId} roomCode={roomCode} team={team} playerId={playerId} timeLimitSeconds={timeLimit} challengeId={challengeId} />
    </ErrorBoundary>
  )
}
