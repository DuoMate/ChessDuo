import { Game } from '@/components/Game'

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; code?: string }>
}) {
  const resolved = await searchParams
  const level = resolved.level ? parseInt(resolved.level, 10) : undefined
  const roomCode = resolved.code

  return <Game level={level} roomCode={roomCode} />
}
