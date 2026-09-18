'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getMatchHistory, getPlayerStats, CompletedGame } from '@/lib/matchHistory'
import { motion } from 'framer-motion'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoading } from '@/components/PageLoading'
import { BackButton } from '@/components/BackButton'
import { History, Trophy, Skull, Handshake, Clock, Target, TrendingUp, ChevronRight, Globe, Bot } from 'lucide-react'
import { AuthGate } from '@/components/AuthGate'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

const reasonLabels: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  threefoldRepetition: 'Repetition',
  insufficientMaterial: 'Insufficient Material',
  draw: 'Draw',
  resignation: 'Resigned',
  timeout: "Time's Up",
}

export default function HistoryPage() {
  const router = useRouter()
  useCapacitorBackButton(() => { router.push('/'); return true }, true)

  return (
    <AuthGate variant="page" pageTitle="Match History" pageEmoji="📜" subtitle="Sign in to view your match history" onBack={() => router.push('/')}>
      {(playerId) => <HistoryContent playerId={playerId} />}
    </AuthGate>
  )
}

function HistoryContent({ playerId }: { playerId: string }) {
  const router = useRouter()
  const [games, setGames] = useState<CompletedGame[]>([])
  const [playerStats, setPlayerStats] = useState<Awaited<ReturnType<typeof getPlayerStats>>>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!mountedRef.current) return
    Promise.all([
      getMatchHistory(50, playerId),
      getPlayerStats(playerId),
    ]).then(([g, s]) => {
      if (!mountedRef.current) return
      setGames(g)
      setPlayerStats(s)
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setGames([])
      setPlayerStats(null)
      setLoadError(true)
      setLoading(false)
    })
  }, [playerId, retryKey])

  if (loading) {
    return <PageLoading label="Loading match history…" />
  }

  if (loadError) {
    return (
      <ErrorBoundary>
        <div className="min-h-dvh bg-[var(--color-page-bg)] text-slate-900 dark:text-white p-4 pb-20">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Match History</h1>
              <BackButton alwaysFallback />
            </div>
            <div className="text-center py-12">
              <p role="alert" className="text-slate-700 dark:text-slate-300 text-lg font-medium mb-1">Couldn&apos;t load your match history</p>
              <p className="text-slate-500 text-sm mb-4">Check your connection and try again</p>
              <button
                onClick={() => {
                  setLoadError(false)
                  setLoading(true)
                  setRetryKey((k) => k + 1)
                }}
                className="focus-ring min-h-[44px] px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-dvh bg-[var(--color-page-bg)] text-slate-900 dark:text-white p-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Match History</h1>
            <BackButton alwaysFallback />
          </div>

          {/* Stats */}
          {playerStats && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-3 mb-6"
            >
              <div className="bg-white border border-slate-200 shadow-sm dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none p-4 rounded-2xl text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Target size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{playerStats.totalGames}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Games</p>
              </div>
              <div className="bg-white border border-slate-200 shadow-sm dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none p-4 rounded-2xl text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-lg font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400">{playerStats.wins}</span>
                  <span className="text-slate-400 dark:text-slate-500"> / </span>
                  <span className="text-rose-600 dark:text-rose-400">{playerStats.losses}</span>
                  <span className="text-slate-400 dark:text-slate-500"> / </span>
                  <span className="text-amber-600 dark:text-amber-400">{playerStats.draws}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">W / L / D</p>
              </div>
              <div className="bg-white border border-slate-200 shadow-sm dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none p-4 rounded-2xl text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Clock size={18} className="text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{Math.round(playerStats.avgSyncRate * 100)}%</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Avg Sync</p>
              </div>
            </motion.div>
          )}

          {/* Games List */}
          {games.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
                <History size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-lg font-medium mb-1">No matches yet</p>
              <p className="text-slate-500 text-sm mb-4">Complete a game to see it here</p>
              <button
                onClick={() => router.push('/')}
                className="focus-ring min-h-[44px] px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
              >
                Play a Game
              </button>
            </div>
          ) : (
            <div className="space-y-3">
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
                const icon = isDraw ? (<Handshake size={18} aria-hidden="true" className="text-amber-600 dark:text-amber-400" />)
                  : isWin ? (<Trophy size={18} aria-hidden="true" className="text-emerald-600 dark:text-emerald-400" />)
                  : (<Skull size={18} aria-hidden="true" className="text-rose-600 dark:text-rose-400" />)

                return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white border border-slate-200 shadow-sm hover:bg-slate-50 dark:bg-slate-800/50 dark:border-white/5 dark:shadow-none dark:hover:bg-slate-800/70 p-4 rounded-2xl transition-colors"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${resultBg}`}>
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <span className={`text-base font-semibold truncate block ${resultColor}`}>
                          {resultText}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="inline-flex">{game.is_online ? <Globe size={12} /> : <Bot size={12} />}</span> {game.is_online ? 'Online' : 'Offline'}</span>
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
                      aria-label={`Replay game: ${resultText}`}
                      className="focus-ring shrink-0 min-h-[44px] px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      Replay
                      <ChevronRight size={12} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-3">
                    <span>{game.game_over_reason ? reasonLabels[game.game_over_reason] || game.game_over_reason : 'Game Over'}</span>
                    <span>·</span>
                    <span>{game.white_moves} moves</span>
                    <span>·</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Sync {(game.white_sync_rate * 100).toFixed(0)}%
                    </span>
                    <span>·</span>
                    <span>
                      P1: {Math.round(game.player1_accuracy)}% | P2: {Math.round(game.player2_accuracy)}%
                    </span>
                  </div>
                </motion.div>
              )})}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}