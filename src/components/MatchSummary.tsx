'use client'

import { motion } from 'framer-motion'

export interface MatchStats {
  whiteMovesPlayed: number
  whiteSyncRate: number
  whiteConflicts: number
  player1Accuracy: number
  player2Accuracy: number
  totalMoves: number
}

interface MatchSummaryProps {
  winner: 'WHITE' | 'BLACK' | 'DRAW'
  gameResult: string
  gameOverReason: string | null
  stats: MatchStats
  isOnline: boolean
  roomId?: string
}

const reasonLabels: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Draw by Stalemate',
  threefoldRepetition: 'Draw by Repetition',
  insufficientMaterial: 'Draw by Insufficient Material',
  draw: 'Draw',
}

export function MatchSummary({ winner, gameResult, gameOverReason, stats, isOnline }: MatchSummaryProps) {
  const syncPercent = Math.round(stats.whiteSyncRate * 100)

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg ${winner === 'WHITE' ? 'bg-green-900/30 border border-green-600' : winner === 'DRAW' ? 'bg-yellow-900/30 border border-yellow-600' : 'bg-red-900/30 border border-red-600'}`}>
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">Result</p>
          <p className="text-lg font-bold text-white">{gameResult}</p>
          {gameOverReason && (
            <p className="text-xs text-gray-400 mt-1">
              {reasonLabels[gameOverReason] || gameOverReason}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Sync Rate"
          value={`${syncPercent}%`}
          subtitle={`${stats.whiteMovesPlayed} white moves`}
          valueColor={syncPercent >= 70 ? '#22c55e' : syncPercent >= 40 ? '#eab308' : '#ef4444'}
        />
        <StatCard
          label="Conflicts"
          value={stats.whiteConflicts.toString()}
          subtitle={`${stats.totalMoves} total turns`}
          valueColor={stats.whiteConflicts <= 2 ? '#22c55e' : stats.whiteConflicts <= 5 ? '#eab308' : '#ef4444'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="You"
          value={`${Math.round(stats.player1Accuracy)}%`}
          subtitle="Avg accuracy"
          valueColor={stats.player1Accuracy >= 80 ? '#22c55e' : stats.player1Accuracy >= 60 ? '#eab308' : '#ef4444'}
        />
        <StatCard
          label="Teammate"
          value={`${Math.round(stats.player2Accuracy)}%`}
          subtitle="Avg accuracy"
          valueColor={stats.player2Accuracy >= 80 ? '#22c55e' : stats.player2Accuracy >= 60 ? '#eab308' : '#ef4444'}
        />
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          {isOnline ? 'Online match' : 'Offline match'}
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, subtitle, valueColor }: {
  label: string
  value: string
  subtitle: string
  valueColor: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 text-center"
    >
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: valueColor }}>{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </motion.div>
  )
}
