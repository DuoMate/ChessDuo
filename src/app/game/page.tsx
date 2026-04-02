import { Game } from '@/components/Game'

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>
}) {
  const resolved = await searchParams
  const level = resolved.level ? parseInt(resolved.level, 10) : undefined
  
  return <Game level={level} />
}
