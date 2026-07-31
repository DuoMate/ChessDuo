'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ErrorBoundary, GameErrorFallback } from '@/components/ErrorBoundary'
import { Spinner } from '@/components/Spinner'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'

const GameComponent = dynamic(() => import('@/components/Game').then(mod => ({ default: mod.Game })), {
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] flex items-center justify-center">
      <Spinner size="md" label="Loading game..." />
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
  const colorParam = searchParams.get('color')
  const playerColor: 'white' | 'black' | 'random' =
    colorParam === 'black' ? 'black' :
    colorParam === 'random' ? 'random' : 'white'
  const [validated, setValidated] = useState(false)
  const validatedRef = useRef(false)

  const buildGameRedirect = () => {
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    if (roomId) params.set('room', roomId)
    if (roomCode) params.set('code', roomCode)
    if (team) params.set('team', team)
    if (playerId) params.set('playerId', playerId)
    if (timeLimit) params.set('time', String(timeLimit))
    if (challengeId) params.set('challengeId', challengeId)
    if (fourplayer) params.set('fourplayer', '1')
    const redirectUrl = encodeURIComponent(`/game?${params.toString()}`)
    return `/?redirect=${redirectUrl}`
  }

  useEffect(() => {
    if (validatedRef.current) return
    const isMultiplayer = mode === 'online' || mode === 'fourplayer'
    if (!isMultiplayer || !playerId) {
      setValidated(true)
      return
    }
    validatedRef.current = true
    AuthService.getSession().then(session => {
      if (!session?.user || session.user.id !== playerId) {
        router.replace(buildGameRedirect())
        return
      }
      setValidated(true)
    }).catch(() => {
      router.replace(buildGameRedirect())
    })

    const unsubscribe = AuthService.onAuthChange((_event, session) => {
      if (!session) {
        router.replace('/')
      }
    })
    return () => { unsubscribe() }
  }, [mode, playerId, roomId, roomCode, team, timeLimit, challengeId, fourplayer, router])

  if (!validated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] flex items-center justify-center">
        <Spinner size="md" label="Verifying session..." />
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
        playerColor={playerColor}
      />
    </ErrorBoundary>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] flex items-center justify-center">
        <Spinner size="md" label="Loading..." />
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}
