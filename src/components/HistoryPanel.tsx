'use client'

import { useState, useEffect } from 'react'
import { getMatchHistory, getPlayerStats, CompletedGame } from '@/lib/matchHistory'
import { motion } from 'framer-motion'
import { History, Trophy, Skull, Handshake, Clock, Target, TrendingUp, ChevronRight } from 'lucide-react'

interface HistoryPanelProps {
  playerId: string
  onClose?: () => void
}

const reasonLabels: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefoldRepetition: 'Repetition',
  insufficientMaterial: 'Insufficient Material',
  draw: 'Draw',
  timeout: "Time's Up",
}

export function HistoryPanel({ playerId, onClose }: HistoryPanelProps) {
  const [games, setGames] = useState<CompletedGame[]>([])
  const [playerStats, setPlayerStats] = useState<Awaited<ReturnType<typeof getPlayerStats>>>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playerId) return
    Promise.all([
      getMatchHistory(50, playerId),
      getPlayerStats(playerId),
    ]).then(([g, s]) => {
      setGames(g)
      setPlayerStats(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [playerId])

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#0a0e1a] text-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <History size={18} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Match History</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <span className="text-slate-400 text-lg">&times;</span>
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <History size={18} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Match History</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <span className="text-slate-400 text-lg">&times;</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Stats */}
        {playerStats && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2"
          >
            <div className="bg-slate-800/50 border border-white/5 p-3 rounded-2xl text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Target size={14} className="text-blue-400" />
              </div>
              <p className="text-lg font-bold text-white">{playerStats.totalGames}</p>
              <p className="text-xs text-slate-400">Games</p>
            </div>
            <div className="bg-slate-800/50 border border-white/5 p-3 rounded-2xl text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp size={14} className="text-emerald-400" />
              </div>
              <p className="text-sm font-bold">
                <span className="text-emerald-400">{playerStats.wins}</span>
                <span className="text-slate-500">/</span>
                <span className="text-rose-400">{playerStats.losses}</span>
                <span className="text-slate-500">/</span>
                <span className="text-amber-400">{playerStats.draws}</span>
              </p>
              <p className="text-xs text-slate-400">W/L/D</p>
            </div>
            <div className="bg-slate-800/50 border border-white/5 p-3 rounded-2xl text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Clock size={14} className="text-purple-400" />
              </div>
              <p className="text-lg font-bold text-white">{Math.round(playerStats.avgSyncRate * 100)}%</p>
              <p className="text-xs text-slate-400">Avg Sync</p>
            </div>
          </motion.div>
        )}

        {/* Games List */}
        {games.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-700/50 flex items-center justify-center">
              <History size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-300 text-sm font-medium mb-1">No matches yet</p>
            <p className="text-slate-500 text-xs">Complete a game to see it here</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">Recent Games</p>
            {games.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-slate-800/50 border border-white/5 p-3 rounded-2xl hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      game.winner === 'WHITE' 
                        ? 'bg-emerald-500/20' 
                        : game.winner === 'DRAW' 
                          ? 'bg-amber-500/20' 
                          : 'bg-rose-500/20'
                    }`}>
                      {game.winner === 'WHITE' ? (
                        <Trophy size={14} className="text-emerald-400" />
                      ) : game.winner === 'DRAW' ? (
                        <Handshake size={14} className="text-amber-400" />
                      ) : (
                        <Skull size={14} className="text-rose-400" />
                      )}
                    </div>
                    <div>
                      <span className={`text-sm font-semibold ${
                        game.winner === 'WHITE' 
                          ? 'text-emerald-400' 
                          : game.winner === 'DRAW' 
                            ? 'text-amber-400' 
                            : 'text-rose-400'
                      }`}>
                        {game.winner === 'WHITE' ? 'White Wins' : game.winner === 'DRAW' ? 'Draw' : 'Black Wins'}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{game.is_online ? '🌐 Online' : '🤖 Offline'}</span>
                        <span>·</span>
                        <span>{new Date(game.played_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.location.href = `/replay/${game.id}`
                    }}
                    className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                  >
                    Replay
                    <ChevronRight size={12} />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{game.game_over_reason ? reasonLabels[game.game_over_reason] || game.game_over_reason : 'Game Over'}</span>
                  <span>·</span>
                  <span>{game.white_moves} moves</span>
                  <span>·</span>
                  <span className="text-emerald-400">
                    Sync {(game.white_sync_rate * 100).toFixed(0)}%
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
