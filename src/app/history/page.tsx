'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMatchHistory, getPlayerStats, CompletedGame } from '@/lib/matchHistory'
import { motion } from 'framer-motion'

const reasonLabels: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefoldRepetition: 'Repetition',
  insufficientMaterial: 'Insufficient Material',
  draw: 'Draw',
}

export default function HistoryPage() {
  const router = useRouter()
  const [games, setGames] = useState<CompletedGame[]>([])
  const [playerStats, setPlayerStats] = useState<Awaited<ReturnType<typeof getPlayerStats>>>(null)
  const [loading, setLoading] = useState(true)
  const [playerId, setPlayerId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPlayerId(session.user.id)
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!playerId) return
    getMatchHistory(50).then(setGames).catch(() => setGames([]))
    getPlayerStats().then(setPlayerStats).catch(() => setPlayerStats(null))
  }, [playerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!playerId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Match History</h1>
        <p className="text-gray-400 mb-4">Sign in to view your match history</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-yellow-400"
        >
          Go Home
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Match History</h1>
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-yellow-400 text-sm"
          >
            ← Home
          </button>
        </div>

        {playerStats && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="bg-gray-800 p-3 rounded-lg text-center border border-gray-700">
              <p className="text-xs text-gray-400">Games</p>
              <p className="text-xl font-bold">{playerStats.totalGames}</p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center border border-gray-700">
              <p className="text-xs text-gray-400">W/L/D</p>
              <p className="text-xl font-bold">
                <span className="text-green-400">{playerStats.wins}</span>
                {' / '}
                <span className="text-red-400">{playerStats.losses}</span>
                {' / '}
                <span className="text-yellow-400">{playerStats.draws}</span>
              </p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg text-center border border-gray-700">
              <p className="text-xs text-gray-400">Avg Sync</p>
              <p className="text-xl font-bold">{Math.round(playerStats.avgSyncRate * 100)}%</p>
            </div>
          </motion.div>
        )}

        {games.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No matches yet</p>
            <p className="text-gray-600 text-sm mt-1">Complete a game to see it here</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm"
            >
              Play a Game
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {game.winner === 'WHITE' ? '🏆' : game.winner === 'DRAW' ? '🤝' : '💀'}
                    </span>
                    <span className="font-bold">
                      {game.winner === 'WHITE' ? 'White Wins' : game.winner === 'DRAW' ? 'Draw' : 'Black Wins'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{game.is_online ? '🌐 Online' : '🤖 Offline'}</span>
                    <span>·</span>
                    <span>{new Date(game.played_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{game.game_over_reason ? reasonLabels[game.game_over_reason] || game.game_over_reason : 'Game Over'}</span>
                  <span>·</span>
                  <span>{game.white_moves} moves</span>
                  <span>·</span>
                  <span className="text-green-400">
                    Sync {(game.white_sync_rate * 100).toFixed(0)}%
                  </span>
                  <span>·</span>
                  <span>
                    P1: {Math.round(game.player1_accuracy)}% | P2: {Math.round(game.player2_accuracy)}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
