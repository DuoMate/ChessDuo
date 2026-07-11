'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { DEFAULT_TEAM_TIMER_SECONDS } from '@/features/shared/gameConstants'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { supabase } from '@/lib/supabase'

const DuelGameComponent = dynamic(() => import('@/components/DuelGame').then(mod => ({ default: mod.DuelGame })), {
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex items-center justify-center">
      <p className="text-gray-400">Loading duel...</p>
    </div>
  ),
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
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (session?.user && playerId && session.user.id === playerId) {
        setIsValidSession(true)
      }
      setSessionChecked(true)
    }).catch(() => {
      setSessionChecked(true)
    })
  }, [playerId])

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex items-center justify-center">
        <p className="text-gray-400">Verifying session...</p>
      </div>
    )
  }

  if (!roomId || !roomCode || !playerId || !team || !isValidSession) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold text-red-400">Invalid Duel Link</h1>
            <p className="text-gray-400">Missing required parameters</p>
            <button onClick={() => router.push('/')} className="px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400">
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
        onLeave={() => { sessionStorage.setItem(`chessduo_left_${roomCode}`, 'true'); window.location.href = '/' }}
      />
    </ErrorBoundary>
  )
}

export default function DuelPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      }>
        <DuelContent />
      </Suspense>
    </ErrorBoundary>
  )
}
