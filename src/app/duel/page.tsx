'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { DEFAULT_TEAM_TIMER_SECONDS } from '@/features/shared/gameConstants'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoading } from '@/components/PageLoading'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'

const DuelGameComponent = dynamic(() => import('@/components/DuelGame').then(mod => ({ default: mod.DuelGame })), {
  loading: () => <PageLoading label="Loading duel..." />,
  ssr: false,
})

function DuelContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)
  const roomId = searchParams.get('room')
  const roomCode = searchParams.get('code')
  const playerId = searchParams.get('playerId')
  const team = searchParams.get('team') as 'WHITE' | 'BLACK' | null
  const time = searchParams.get('time') ? parseInt(searchParams.get('time')!, 10) : DEFAULT_TEAM_TIMER_SECONDS

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (session?.user && playerId && session.user.id === playerId) {
        setIsValidSession(true)
      }
      setSessionChecked(true)
    }).catch(() => {
      setSessionChecked(true)
    })
  }, [playerId])

  if (!sessionChecked) {
    return <PageLoading label="Verifying session..." />
  }

  if (!roomId || !roomCode || !playerId || !team) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold text-red-400">Invalid Duel Link</h1>
            <p className="text-slate-400">Missing required parameters</p>
            <button onClick={() => router.push('/')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors">
              Go Home
            </button>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  if (!isValidSession) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="text-5xl">🔒</div>
            <h1 className="text-xl font-bold text-red-400">Session Expired</h1>
            <p className="text-slate-400">Please sign in again to continue.</p>
            <button onClick={() => router.push('/')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors">
              Go Home
            </button>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <DuelGameComponent
        roomId={roomId}
        roomCode={roomCode}
        playerId={playerId}
        team={team}
        timeLimit={time}
        onLeave={() => { sessionStorage.setItem(`chessduo_left_${roomCode}`, 'true'); router.push('/') }}
      />
    </ErrorBoundary>
  )
}

export default function DuelPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoading />}>
        <DuelContent />
      </Suspense>
    </ErrorBoundary>
  )
}
