'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Crown, BarChart3 } from 'lucide-react'
import { MoveInsights } from './MoveInsights'
import { Spinner } from './Spinner'
import { getUserInsightsState, incrementInsightsReveals } from '@/lib/insights'
import { SubscriptionService } from '@/features/billing'

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
  onStateChange?: (state: { isPremium: boolean; revealsRemaining: number | null }) => void
}

export function InsightsGate({ playerId, onStateChange, ...comparison }: InsightsGateProps) {
  const [isPremium, setIsPremium] = useState(false)
  const [revealsRemaining, setRevealsRemaining] = useState<number | null>(null)
  const [showInsights, setShowInsights] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!playerId) {
      setLoading(false)
      return
    }
    Promise.all([
      SubscriptionService.isPremium(),
      getUserInsightsState(playerId),
    ]).then(([premium, state]) => {
      setIsPremium(premium)
      setRevealsRemaining(state.revealsRemaining)
      if (premium) setShowInsights(true)
      setLoading(false)
      onStateChange?.({ isPremium: premium, revealsRemaining: state.revealsRemaining })
    }).catch(() => {
      setLoading(false)
    })
  }, [playerId, onStateChange])

  const handleReveal = async () => {
    if (!playerId || revealsRemaining === null || revealsRemaining <= 0) return
    const remaining = await incrementInsightsReveals(playerId)
    setRevealsRemaining(remaining)
    setShowInsights(true)
    onStateChange?.({ isPremium, revealsRemaining: remaining })
  }

  if (loading) {
    return <div className="mt-3 pt-3 border-t border-gray-600 flex justify-center"><Spinner size="sm" /></div>
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="space-y-3"
      >
        {/* Premium upsell card */}
        <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-4 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Lock size={20} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
                UNLOCK <span className="text-blue-400">PREMIUM</span> INSIGHTS
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Get in-depth analysis, move accuracy, mistakes, best moves and more.
              </p>
            </div>
          </div>
          <a
            href="/premium"
            className="mt-3 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold shadow-[0_4px_20px_rgba(59,130,246,0.35)] hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] transition-all"
          >
            <Crown size={16} className="text-white" />
            UPGRADE NOW
          </a>
        </div>

        {/* Bottom premium teaser banner */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Crown size={14} className="shrink-0 text-amber-400" />
            <span className="text-[11px] text-slate-400 leading-snug">
              Premium members get real-time insights and win more games.
            </span>
          </div>
          <a
            href="/premium"
            className="shrink-0 px-3 py-1.5 rounded-lg border border-blue-500/30 text-blue-400 text-[11px] font-bold hover:bg-blue-500/10 transition-colors min-h-[32px] flex items-center"
          >
            VIEW PLANS
          </a>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="mt-3 pt-3 border-t border-gray-600 text-center"
    >
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-2">
        <BarChart3 size={14} strokeWidth={2} />
        <span>{revealsRemaining ?? 3}/3 free insights remaining</span>
      </div>
      <button
        onClick={handleReveal}
        className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg border border-slate-600 transition-colors min-h-[36px]"
      >
        Reveal Move Insights
      </button>
    </motion.div>
  )
}
