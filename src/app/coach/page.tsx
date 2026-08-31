'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ErrorBoundary, GameErrorFallback } from '@/components/ErrorBoundary'
import { PageLoading } from '@/components/PageLoading'
import { AuthService } from '@/lib/authService'
import { resolvePlayerColor } from '@/features/shared/gameConstants'
import { CoachGate } from '@/components/coach/CoachGate'

const CoachGameComponent = dynamic(() => import('@/components/coach/CoachGame').then((mod) => ({ default: mod.CoachGame })), {
  loading: () => <PageLoading label="Loading coach…" />,
  ssr: false,
})

function CoachContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const levelParam = searchParams.get('level')
  const level = levelParam ? Math.min(6, Math.max(1, parseInt(levelParam, 10) || 3)) : 3
  const colorParam = (searchParams.get('color') as 'white' | 'black' | 'random' | null) ?? 'white'
  const playerColor = resolvePlayerColor(colorParam)

  const [sessionChecked, setSessionChecked] = useState(false)
  const [playerId, setPlayerId] = useState<string | null>(null)

  useEffect(() => {
    AuthService.getSession()
      .then((session) => {
        setPlayerId(session?.user?.id ?? null)
        setSessionChecked(true)
      })
      .catch(() => {
        setSessionChecked(true)
      })
  }, [])

  useEffect(() => {
    if (sessionChecked && !playerId) {
      const redirect = encodeURIComponent(`/coach?level=${level}&color=${colorParam}`)
      router.replace(`/?redirect=${redirect}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, playerId])

  if (!sessionChecked || !playerId) {
    return <PageLoading label="Signing in…" />
  }

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <CoachGate playerId={playerId}>
        <CoachGameComponent
          playerId={playerId}
          playerColor={playerColor}
          botLevel={level}
          onLeave={() => router.replace('/')}
        />
      </CoachGate>
    </ErrorBoundary>
  )
}

export default function CoachPage() {
  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <Suspense fallback={<PageLoading />}>
        <CoachContent />
      </Suspense>
    </ErrorBoundary>
  )
}
