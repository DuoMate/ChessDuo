'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCompletedGame, type CompletedGame } from '@/lib/matchHistory'
import { AuthService } from '@/lib/authService'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import dynamic from 'next/dynamic'
import { PageLoading } from '@/components/PageLoading'
import { BackButton } from '@/components/BackButton'
import { Clapperboard } from 'lucide-react'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

const ReplayViewComponent = dynamic(() => import('@/components/ReplayView').then(mod => ({ default: mod.ReplayView })), {
  loading: () => <PageLoading label="Loading replay..." />,
  ssr: false,
})

export default function ReplayPageClient() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.gameId as string
  const [game, setGame] = useState<CompletedGame | null | undefined>(undefined)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [authState, setAuthState] = useState<'checking' | 'signed_out' | 'signed_in'>('checking')
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string; avatarUrl?: string | null } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useCapacitorBackButton(() => { router.push('/history'); return true }, true)

  useEffect(() => {
    AuthService.getSession().then(session => {
      const uid = session?.user?.id || null
      setUserId(uid)
      setAuthState(uid ? 'signed_in' : 'signed_out')
    }).catch(() => {
      setAuthState('signed_out')
    })
  }, [])

  useEffect(() => {
    if (authState !== 'signed_in' || !userId) return
    let cancelled = false
    async function load() {
      try {
        const result = await getCompletedGame(gameId, userId || undefined)
        if (cancelled) return
        if (result) {
          setGame(result)
        } else {
          setGame(null)
        }
      } catch {
        if (cancelled) return
        setError(true)
        setGame(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [gameId, authState, userId, retryKey])

  const handleAuthComplete = (uid: string) => {
    setUserId(uid)
    setAuthState('signed_in')
  }

  const handleNeedUsername = (uid: string, suggestedName: string, avatarUrl?: string | null) => {
    setNeedsUsername({ userId: uid, suggestedName, avatarUrl })
  }

  const handleUsernameChosen = (uid: string) => {
    setNeedsUsername(null)
    setUserId(uid)
    setAuthState('signed_in')
  }

  if (needsUsername) {
    return (
      <ErrorBoundary>
        <ChooseUsername
          userId={needsUsername.userId}
          suggestedName={needsUsername.suggestedName}
          avatarUrl={needsUsername.avatarUrl}
          onAuthComplete={handleUsernameChosen}
        />
      </ErrorBoundary>
    )
  }

  if (authState === 'checking') {
    return <PageLoading label="Loading replay..." />
  }

  if (authState === 'signed_out') {
    return (
      <ErrorBoundary>
        <div className="min-h-dvh bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15">
              <Clapperboard size={28} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Match Replay</h1>
            <p className="text-gray-500 dark:text-gray-400">Sign in to view this match replay</p>
            <Auth onAuthComplete={handleAuthComplete} onNeedUsername={handleNeedUsername} />
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  if (game === undefined) {
    return <PageLoading label="Loading replay..." />
  }

  if (!game || error) {
    return (
      <div className="min-h-dvh bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
        <h1 className="text-xl font-bold mb-2">{error ? "Couldn't load replay" : 'Game Not Found'}</h1>
        <p role={error ? 'alert' : undefined} className="text-slate-500 dark:text-slate-400 text-sm mb-4 text-center max-w-xs">
          {error
            ? 'Check your connection and try again.'
            : 'This replay is no longer available.'}
        </p>
        {error && (
          <button
            onClick={() => {
              setError(false)
              setGame(undefined)
              setRetryKey((k) => k + 1)
            }}
            className="min-h-[44px] px-6 py-2.5 mb-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
          >
            Retry
          </button>
        )}
        <BackButton label="Back to History" fallbackHref="/history" />
      </div>
    )
  }

  return <ReplayViewComponent game={game} />
}
