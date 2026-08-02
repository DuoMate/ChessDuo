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
  const [authState, setAuthState] = useState<'checking' | 'signed_out' | 'signed_in'>('checking')
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string; avatarUrl?: string | null } | null>(null)

  useCapacitorBackButton(() => { router.push('/history'); return true }, true)

  useEffect(() => {
    AuthService.getSession().then(session => {
      setAuthState(session?.user ? 'signed_in' : 'signed_out')
    }).catch(() => {
      setAuthState('signed_out')
    })
  }, [])

  useEffect(() => {
    if (authState !== 'signed_in') return
    let cancelled = false
    async function load() {
      try {
        const result = await getCompletedGame(gameId)
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
  }, [gameId, authState])

  const handleAuthComplete = (userId: string) => {
    setAuthState('signed_in')
  }

  const handleNeedUsername = (userId: string, suggestedName: string, avatarUrl?: string | null) => {
    setNeedsUsername({ userId, suggestedName, avatarUrl })
  }

  const handleUsernameChosen = (userId: string) => {
    setNeedsUsername(null)
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
        <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="text-5xl mb-2">🎬</div>
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
      <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
        <h1 className="text-xl font-bold mb-2">Game Not Found</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">This replay is no longer available.</p>
        <BackButton label="Back to History" fallbackHref="/history" />
      </div>
    )
  }

  return <ReplayViewComponent game={game} />
}
