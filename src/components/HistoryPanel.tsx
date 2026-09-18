'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getMatchHistory, getPlayerStats, CompletedGame } from '@/lib/matchHistory'
import { motion } from 'framer-motion'
import { History, Trophy, Skull, Handshake, Clock, Target, TrendingUp, ChevronRight } from 'lucide-react'
import { Spinner } from '@/components/Spinner'

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
  resignation: 'Resigned',
  timeout: "Time's Up",
}

export function HistoryPanel({ playerId, onClose }: HistoryPanelProps) {
  const router = useRouter()
  const [games, setGames] = useState<CompletedGame[]>([])
  const [playerStats, setPlayerStats] = useState<Awaited<ReturnType<typeof getPlayerStats>>>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!playerId) return
    Promise.all([
      getMatchHistory(50, playerId),
      getPlayerStats(playerId),
    ]).then(([g, s]) => {
      setGames(g)
      setPlayerStats(s)
      setLoading(false)
    }).catch(() => {
      // History is best-effort: surface the failure with a retry instead of
      // silently rendering an empty list.
      setLoadError(true)
      setLoading(false)
    })
  }, [playerId, retryKey])

  if (loading) {
    return (
    <div className="flex flex-col h-full min-h-full bg-[var(--color-page-bg)] text-slate-900 dark:text-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <History size={18} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Match History</h2>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close match history" className="focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
              <span className="text-slate-500 dark:text-slate-400 text-lg" aria-hidden="true">&times;</span>
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
          <Spinner size="md" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading match history…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
    <div className="flex flex-col h-full min-h-full bg-[var(--color-page-bg)] text-slate-900 dark:text-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <History size={18} className="text-white" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Match History</h2>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close match history" className="focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
              <span className="text-slate-500 dark:text-slate-400 text-lg" aria-hidden="true">&times;</span>
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <p role="alert" className="text-sm font-medium text-slate-700 dark:text-slate-300">Couldn&apos;t load your match history.</p>
          <p className="text-xs text-slate-500">Check your connection and try again.</p>
          <button
            onClick={() => {
              setLoadError(false)
              setLoading(true)
              setRetryKey((k) => k + 1)
            }}
            className="focus-ring mt-2 min-h-[44px] px-6 py-2 rounded-xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-500"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-full bg-[var(--color-page-bg)] text-slate-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <History size={18} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Match History</h2>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close match history" className="focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <span className="text-slate-500 dark:text-slate-400 text-lg" aria-hidden="true">&times;</span>
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
            <div className="bg-white border border-slate-200 shadow-sm dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none p-3 rounded-2xl text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Target size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{playerStats.totalGames}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Games</p>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none p-3 rounded-2xl text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-bold">
                <span className="text-emerald-600 dark:text-emerald-400">{playerStats.wins}</span>
                <span className="text-slate-400 dark:text-slate-500">/</span>
                <span className="text-rose-600 dark:text-rose-400">{playerStats.losses}</span>
                <span className="text-slate-400 dark:text-slate-500">/</span>
                <span className="text-amber-600 dark:text-amber-400">{playerStats.draws}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">W/L/D</p>
            </div>
            <div className="bg-white border border-slate-200 shadow-sm dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none p-3 rounded-2xl text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Clock size={14} className="text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{Math.round(playerStats.avgSyncRate * 100)}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Avg Sync</p>
            </div>
          </motion.div>
        )}

        {/* Games List */}
        {games.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
              <History size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-sm font-medium mb-1">No matches yet</p>
            <p className="text-slate-500 text-xs">Complete a game to see it here</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">Recent Games</p>
            {games.map((game, i) => {
              const playerLabel = game.player_labels
              const playerColor = playerLabel
                ? (playerLabel.white.includes(playerId) ? 'WHITE' : playerLabel.black.includes(playerId) ? 'BLACK' : null)
                : null
              const isDraw = game.winner === 'DRAW'
              const isWin = playerColor ? game.winner === playerColor : game.winner === 'WHITE'
              const resultBg = isDraw ? 'bg-amber-500/20' : isWin ? 'bg-emerald-500/20' : 'bg-rose-500/20'
              const resultColor = isDraw ? 'text-amber-600 dark:text-amber-400' : isWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              const resultText = isDraw ? 'Draw' : isWin ? 'You Win' : 'You Lose'
              const icon = isDraw ? (<Handshake size={14} aria-hidden="true" className="text-amber-600 dark:text-amber-400" />)
                : isWin ? (<Trophy size={14} aria-hidden="true" className="text-emerald-600 dark:text-emerald-400" />)
                : (<Skull size={14} aria-hidden="true" className="text-rose-600 dark:text-rose-400" />)

              return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                // P1 perf: cap stagger at the first viewport (~8 rows). Previously
                // all 50 rows staggered (delay up to 1.5s), keeping 50 concurrent
                // animations alive on open. Offscreen rows skip layout/paint via
                // content-visibility until scrolled into view — order/appearance identical.
                transition={{ delay: Math.min(i, 8) * 0.03 }}
                className="bg-white border border-slate-200 shadow-sm hover:bg-slate-50 dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none dark:hover:bg-slate-800/70 p-3 rounded-2xl transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_80px]"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${resultBg}`}>
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <span className={`text-sm font-semibold truncate block ${resultColor}`}>
                        {resultText}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span><span aria-hidden="true">{game.is_online ? '🌐' : '🤖'}</span> {game.is_online ? 'Online' : 'Offline'}</span>
                        <span>·</span>
                        <span>{new Date(game.played_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/replay/${game.id}`)
                    }}
                    aria-label={`Replay game ${i + 1}: ${resultText}`}
                    className="focus-ring shrink-0 min-h-[44px] px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    Replay
                    <ChevronRight size={12} aria-hidden="true" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{game.game_over_reason ? reasonLabels[game.game_over_reason] || game.game_over_reason : 'Game Over'}</span>
                  <span>·</span>
                  <span>{game.white_moves} moves</span>
                  <span>·</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Sync {(game.white_sync_rate * 100).toFixed(0)}%
                  </span>
                </div>
              </motion.div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
