import { getCompletedGame } from '@/lib/matchHistory'
import { ReplayView } from '@/components/ReplayView'
import Link from 'next/link'

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const game = await getCompletedGame(gameId)

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold mb-2">Game Not Found</h1>
        <p className="text-gray-400 text-sm mb-4">This replay is no longer available.</p>
        <Link
          href="/history"
          className="px-6 py-2 bg-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-yellow-400 text-sm"
        >
          Back to History
        </Link>
      </div>
    )
  }

  return <ReplayView game={game} />
}
