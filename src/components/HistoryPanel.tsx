'use client'

import { useState, useEffect } from 'react'
import { getMatchHistory, getPlayerStats, CompletedGame } from '@/lib/matchHistory'
import { motion } from 'framer-motion'

interface HistoryPanelProps {
  playerId: string
}

const reasonLabels: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefoldRepetition: 'Repetition',
  insufficientMaterial: 'Insufficient Material',
  draw: 'Draw',
}

export function HistoryPanel({ playerId }: HistoryPanelProps) {
  const [games, setGames] = useState<CompletedGame[]>([])
  const [playerStats, setPlayerStats] = useState<Awaited<ReturnType<typeof getPlayerStats>>>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playerId) return
    Promise.all([
      getMatchHistory(50),
      getPlayerStats(),
    ]).then(([g, s]) => {
      setGames(g)
      setPlayerStats(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return <p className="text-gray-400 text-center py-8">Loading...</p>
  }

  return (
    <div className="space-y-4">
      {playerStats && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2"
        >
          <div className="bg-gray-800 p-3 rounded-lg text-center border border-gray-700">
            <p className="text-[10px] text-gray-400">Games</p>
            <p className="text-lg font-bold">{playerStats.totalGames}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg text-center border border-gray-700">
            <p className="text-[10px] text-gray-400">W/L/D</p>
            <p className="text-sm font-bold">
              <span className="text-green-400">{playerStats.wins}</span>
              {'/'}
              <span className="text-red-400">{playerStats.losses}</span>
              {'/'}
              <span className="text-yellow-400">{playerStats.draws}</span>
            </p>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg text-center border border-gray-700">
            <p className="text-[10px] text-gray-400">Avg Sync</p>
            <p className="text-lg font-bold">{Math.round(playerStats.avgSyncRate * 100)}%</p>
          </div>
        </motion.div>
      )}

      {games.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No matches yet</p>
          <p className="text-gray-600 text-xs mt-1">Complete a game to see it here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {games.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-gray-800 p-3 rounded-lg border border-gray-700"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">
                    {game.winner === 'WHITE' ? '🏆' : game.winner === 'DRAW' ? '🤝' : '💀'}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {game.winner === 'WHITE' ? 'Win' : game.winner === 'DRAW' ? 'Draw' : 'Loss'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <span>{game.is_online ? '🌐' : '🤖'}</span>
                  <span>{new Date(game.played_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span>{game.game_over_reason ? reasonLabels[game.game_over_reason] || game.game_over_reason : 'End'}</span>
                <span>{game.white_moves}m</span>
                <span className="text-green-400">S{(game.white_sync_rate * 100).toFixed(0)}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
