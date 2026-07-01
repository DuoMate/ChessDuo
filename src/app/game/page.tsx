'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ErrorBoundary, GameErrorFallback } from '@/components/ErrorBoundary'
import { supabase } from '@/lib/supabase'

const GameComponent = dynamic(() => import('@/components/Game').then(mod => ({ default: mod.Game })), {
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400">Loading game...</p>
    </div>
  ),
  ssr: false,
})

function GameContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const level = searchParams.get('level') ? parseInt(searchParams.get('level')!, 10) : undefined
  const mode = searchParams.get('mode')
  const roomId = searchParams.get('room')
  const roomCode = searchParams.get('code')
  const team = searchParams.get('team') as 'WHITE' | 'BLACK' | undefined
  const playerId = searchParams.get('playerId')
  const timeLimit = searchParams.get('time') ? parseInt(searchParams.get('time')!, 10) : undefined
  const challengeId = searchParams.get('challengeId')
  const fourplayer = searchParams.get('fourplayer') === '1'
  const [validated, setValidated] = useState(false)
  const validatedRef = useRef(false)

  useEffect(() => {
    if (validatedRef.current) return
    const isMultiplayer = mode === 'online' || mode === 'fourplayer'
    if (!isMultiplayer || !playerId) {
      setValidated(true)
      return
    }
    validatedRef.current = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user || session.user.id !== playerId) {
        const redirectUrl = encodeURIComponent(`/game?mode=${mode}&room=${roomId}&code=${roomCode}&team=${team}&playerId=${playerId}&time=${timeLimit}${challengeId ? `&challengeId=${challengeId}` : ''}${fourplayer ? '&fourplayer=1' : ''}`)
        router.replace(`/?redirect=${redirectUrl}`)
        return
      }
      setValidated(true)
    }).catch(() => {
      const redirectUrl = encodeURIComponent(`/game?mode=${mode}&room=${roomId}&code=${roomCode}&team=${team}&playerId=${playerId}&time=${timeLimit}${challengeId ? `&challengeId=${challengeId}` : ''}${fourplayer ? '&fourplayer=1' : ''}`)
      router.replace(`/?redirect=${redirectUrl}`)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = '/'
      }
    })
    return () => { subscription?.unsubscribe() }
  }, [mode, playerId, roomId, roomCode, team, timeLimit, challengeId, fourplayer, router])

  if (!validated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Verifying session...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <GameComponent
        level={level}
        mode={mode}
        roomId={roomId}
        roomCode={roomCode}
        team={team}
        playerId={playerId}
        timeLimitSeconds={timeLimit}
        challengeId={challengeId}
        fourplayer={fourplayer}
      />
    </ErrorBoundary>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}
