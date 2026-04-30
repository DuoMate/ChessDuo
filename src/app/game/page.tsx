import { Game } from '@/components/Game'

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; mode?: string; room?: string; code?: string; team?: string }>
}) {
  const resolved = await searchParams
  const level = resolved.level ? parseInt(resolved.level, 10) : undefined
  const mode = resolved.mode
  const roomId = resolved.room
  const roomCode = resolved.code
  const team = resolved.team as 'WHITE' | 'BLACK' | undefined

  return <Game level={level} mode={mode} roomId={roomId} roomCode={roomCode} team={team} />
}
