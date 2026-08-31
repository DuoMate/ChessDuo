'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Lock } from 'lucide-react'
import { SubscriptionService } from '@/features/billing'
import { Spinner } from '../Spinner'

interface CoachGateProps {
  playerId: string
  children: React.ReactNode
}

/**
 * Premium gate for Coach Mode. Enforces access client-side via
 * `SubscriptionService.isPremium()` (mirrors the existing InsightsGate pattern).
 * Non-premium users are shown an upsell and can never mount the coach game.
 */
export function CoachGate({ playerId, children }: CoachGateProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'locked' | 'unlocked'>('loading')

  useEffect(() => {
    let active = true
    SubscriptionService.isPremium()
      .then((premium) => {
        if (active) setStatus(premium ? 'unlocked' : 'locked')
      })
      .catch(() => {
        // Subscription lookup failed — treat as locked (fail closed).
        if (active) setStatus('locked')
      })
    return () => {
      active = false
    }
  }, [playerId])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-page-bg)] px-4 text-gray-900 dark:text-white">
        <div className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white/80 p-6 text-center backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15">
            <Lock size={24} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-wide">AI Coach</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            AI Coach is a premium feature. Get real-time analysis, top-3 move recommendations,
            blunder detection, and personalised coaching explanations.
          </p>
          <button
            onClick={() => router.push('/premium')}
            className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-[0_4px_20px_rgba(59,130,246,0.35)] transition-all hover:from-blue-500 hover:to-cyan-400"
          >
            <Crown size={16} />
            UPGRADE NOW
          </button>
          <button
            onClick={() => router.push('/')}
            className="mt-2 min-h-[44px] w-full rounded-xl text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
