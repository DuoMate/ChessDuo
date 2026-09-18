'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Lock } from 'lucide-react'
import { formatTrialCountdown, getCoachTrialState } from '@/features/coach/coachTrial'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { Spinner } from '../Spinner'

interface CoachGateProps {
  playerId: string
  children: React.ReactNode
}

/**
 * Premium + daily-trial gate for Coach Mode.
 *
 * - Premium users: unlimited, no trial messaging.
 * - Non-premium + daily trial available: game mounts; the trial is consumed
 *   at game START (see CoachGame), never by opening this screen.
 * - Non-premium + trial consumed: hard block with countdown + existing
 *   `/premium` upgrade CTA (Google Play flow on mobile, download CTA on web).
 * Fail-closed: subscription/trial lookup failure keeps the game locked.
 */
export function CoachGate({ playerId, children }: CoachGateProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'unlocked' | 'trial' | 'locked'>('loading')
  const [nextEligibleAt, setNextEligibleAt] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    getCoachTrialState(playerId)
      .then((trial) => {
        if (!active) return
        if (trial.isPremium) {
          setStatus('unlocked')
          return
        }
        if (trial.eligible) {
          setStatus('trial')
          return
        }
        setNextEligibleAt(trial.nextEligibleAt)
        setStatus('locked')
      })
      .catch(() => {
        // Subscription lookup failed — stay locked (fail closed) but say so
        // honestly instead of claiming the free game was consumed.
        if (active) {
          setLoadFailed(true)
          setStatus('locked')
        }
      })
    return () => {
      active = false
    }
  }, [playerId, retryKey])

  // Locked screen owns no game shell, so without its own handler the Android
  // hardware Back would fall through to App.exitApp(). Route-level replace
  // keeps Home → Coach → Home free of history pollution.
  useCapacitorBackButton(
    () => {
      router.replace('/')
      return true
    },
    status === 'locked',
  )

  if (status === 'loading') {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
        <Spinner size="lg" />
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Checking coach access…</p>
      </div>
    )
  }

  if (status === 'trial') {
    return (
      <>
        <div className="mx-auto w-full max-w-md px-4 pt-3">
          <p className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-center text-xs font-semibold text-blue-600 dark:text-blue-300">
            Free daily game — enjoy your AI Coach session
          </p>
        </div>
        {children}
      </>
    )
  }

  if (status === 'locked') {
    const countdown = formatTrialCountdown(nextEligibleAt, Date.now())
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-page-bg)] px-4 text-gray-900 dark:text-white">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white/80 p-6 text-center backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15">
            <Lock size={24} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-wide">AI Coach</h1>
          {loadFailed ? (
            <>
              <p role="alert" className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                We couldn&apos;t verify your coach access. Check your connection and try again.
              </p>
              <button
                onClick={() => {
                  setLoadFailed(false)
                  setStatus('loading')
                  setRetryKey((k) => k + 1)
                }}
                className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-[0_4px_20px_rgba(59,130,246,0.35)] transition-all hover:from-blue-500 hover:to-cyan-400"
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Your free AI Coach game is complete. Unlock unlimited AI Coach games.
                {countdown ? ` Or come back for your next free game in ${countdown}.` : ''}
              </p>
              <button
                onClick={() => router.replace('/premium')}
                className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-[0_4px_20px_rgba(59,130,246,0.35)] transition-all hover:from-blue-500 hover:to-cyan-400"
              >
                <Crown size={16} aria-hidden="true" />
                UPGRADE NOW
              </button>
            </>
          )}
          <button
            onClick={() => router.replace('/')}
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
