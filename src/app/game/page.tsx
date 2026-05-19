import { Game } from '@/components/Game'
import { ErrorBoundary, GameErrorFallback } from '@/components/ErrorBoundary'

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; mode?: string; room?: string; code?: string; team?: string; playerId?: string; time?: string }>
}) {
  const resolved = await searchParams
  const level = resolved.level ? parseInt(resolved.level, 10) : undefined
  const mode = resolved.mode
  const roomId = resolved.room
  const roomCode = resolved.code
  const team = resolved.team as 'WHITE' | 'BLACK' | undefined
  const playerId = resolved.playerId
  const timeLimit = resolved.time ? parseInt(resolved.time, 10) : undefined

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <Game level={level} mode={mode} roomId={roomId} roomCode={roomCode} team={team} playerId={playerId} timeLimitSeconds={timeLimit} />
    </ErrorBoundary>
  )
}
