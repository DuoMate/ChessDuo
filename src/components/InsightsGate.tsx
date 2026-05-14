'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoveInsights } from './MoveInsights'
import { getUserInsightsState, incrementInsightsReveals, isUserPremium } from '@/lib/insights'

interface InsightsGateProps {
  playerId: string
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

export function InsightsGate({ playerId, ...comparison }: InsightsGateProps) {
  const [isPremium, setIsPremium] = useState(() => isUserPremium(playerId))
  const [revealsRemaining, setRevealsRemaining] = useState<number | null>(null)
  const [showInsights, setShowInsights] = useState(() => isUserPremium(playerId))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playerId) return
    const premium = isUserPremium(playerId)
    setIsPremium(premium)
    if (premium) setShowInsights(true)

    getUserInsightsState(playerId).then(state => {
      setIsPremium(state.isPremium)
      setRevealsRemaining(state.revealsRemaining)
      if (state.isPremium) setShowInsights(true)
      setLoading(false)
    })
  }, [playerId])

  const handleReveal = async () => {
    if (!playerId || revealsRemaining === null || revealsRemaining <= 0) return
    const remaining = await incrementInsightsReveals(playerId)
    setRevealsRemaining(remaining)
    setShowInsights(true)
  }

  if (loading) {
    return <div className="mt-3 pt-3 border-t border-gray-600 text-center text-gray-500 text-xs">Loading...</div>
  }

  if (isPremium || showInsights) {
    return (
      <AnimatePresence>
        <MoveInsights {...comparison} />
      </AnimatePresence>
    )
  }

  if (revealsRemaining !== null && revealsRemaining <= 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-3 pt-3 border-t border-gray-600"
      >
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">🔒 0/3 free insights used</p>
          <p className="text-gray-500 text-[10px] mb-2 leading-tight">
            Unlock unlimited AI-powered move analysis,<br />positional insights, and more.
          </p>
          <a
            href="/premium"
            className="inline-block px-3 py-1.5 bg-yellow-500 text-gray-900 text-xs font-bold rounded hover:bg-yellow-400 transition-colors"
          >
            ✨ Get Premium
          </a>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3 pt-3 border-t border-gray-600 text-center"
    >
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-2">
        <span>🔍</span>
        <span>{revealsRemaining ?? 3}/3 free insights remaining</span>
      </div>
      <button
        onClick={handleReveal}
        className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded border border-gray-500 transition-colors"
      >
        Reveal Move Insights
      </button>
    </motion.div>
  )
}
