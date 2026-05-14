'use client'

import { motion } from 'framer-motion'
import { classifyMove, MoveClassification } from '@/lib/moveClassifier'

interface MoveInsightsProps {
  player1Move: string
  player2Move: string
  player1Accuracy: number
  player2Accuracy: number
  player1Loss: number
  player2Loss: number
  isSync: boolean
  winnerId: 'player1' | 'player2'
  bestEngineMove?: string
  bestEngineScore?: number
}

export function MoveInsights({
  player1Move,
  player2Move,
  player1Accuracy,
  player2Accuracy,
  player1Loss,
  player2Loss,
  isSync,
  winnerId,
  bestEngineMove,
  bestEngineScore,
}: MoveInsightsProps) {
  if (isSync) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="mt-3 pt-3 border-t border-gray-600"
      >
        <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-3 text-center">
          <p className="text-green-400 text-sm font-medium">✓ Both players synchronized</p>
          <p className="text-gray-500 text-xs mt-1">You and your teammate chose the same move</p>
        </div>
      </motion.div>
    )
  }

  const winnerMove = winnerId === 'player1' ? player1Move : player2Move
  const loserMove = winnerId === 'player1' ? player2Move : player1Move
  const winnerAccuracy = winnerId === 'player1' ? player1Accuracy : player2Accuracy
  const loserAccuracy = winnerId === 'player1' ? player2Accuracy : player1Accuracy
  const winnerLoss = winnerId === 'player1' ? player1Loss : player2Loss
  const loserLoss = winnerId === 'player1' ? player2Loss : player1Loss

  const winnerClass = classifyMove(winnerMove)
  const loserClass = classifyMove(loserMove)

  const scoreDiff = winnerId === 'player1'
    ? player2Loss - player1Loss
    : player1Loss - player2Loss

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-3 pt-3 border-t border-gray-600 space-y-2"
    >
      {bestEngineMove && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Engine best:</span>
            <span className="text-white text-sm font-bold">{bestEngineMove}</span>
          </div>
          {bestEngineScore != null && (
            <span className="text-xs text-blue-400">+{Math.round(bestEngineScore)}cp</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <InsightCard
          move={winnerMove}
          accuracy={winnerAccuracy}
          loss={winnerLoss}
          classification={winnerClass}
          isWinner
          scoreDiff={scoreDiff}
        />
        <InsightCard
          move={loserMove}
          accuracy={loserAccuracy}
          loss={loserLoss}
          classification={loserClass}
          isWinner={false}
          scoreDiff={scoreDiff}
        />
      </div>
    </motion.div>
  )
}

function InsightCard({
  move,
  accuracy,
  loss,
  classification,
  isWinner,
  scoreDiff,
}: {
  move: string
  accuracy: number
  loss: number
  classification: MoveClassification
  isWinner: boolean
  scoreDiff: number
}) {
  return (
    <div className={`p-2 rounded-lg border text-sm ${isWinner ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-white font-bold">{move}</span>
        <span className="text-xs">{classification.icon}</span>
      </div>
      <p className="text-xs text-gray-400 leading-tight">{classification.description}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-gray-500">{accuracy.toFixed(0)}% · {loss.toFixed(0)}cp loss</span>
        {!isWinner && scoreDiff > 0 && (
          <span className="text-xs text-yellow-400">{scoreDiff.toFixed(0)}cp worse</span>
        )}
      </div>
    </div>
  )
}
