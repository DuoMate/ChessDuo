'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ErrorBoundary, GameErrorFallback } from '@/components/ErrorBoundary'
import { PageLoading } from '@/components/PageLoading'
import { AuthService } from '@/lib/authService'
import {
  DEFAULT_PLAYER_COLOR,
  SELECTED_COLOR_KEY,
  resolvePlayerColor,
  type PlayerColor,
  type ResolvedColor,
} from '@/features/shared/gameConstants'
import { DIFFICULTY_LEVELS, SELECTED_LEVEL_KEY } from '@/components/difficultyLevels'
import { CoachGate } from '@/components/coach/CoachGate'
import { CoachSetup } from '@/components/coach/CoachSetup'

const CoachGameComponent = dynamic(() => import('@/components/coach/CoachGame').then((mod) => ({ default: mod.CoachGame })), {
  loading: () => <PageLoading label="Loading coach…" />,
  ssr: false,
})

/** Setup accepts the same 5 home-UI levels (1-5); anything else falls back to 3 (mirrors home). */
function validLevel(raw: string | null): number {
  if (!raw) return 3
  const parsed = parseInt(raw, 10)
  return DIFFICULTY_LEVELS.some((d) => d.level === parsed) ? parsed : 3
}

function validColor(raw: string | null): PlayerColor {
  return raw === 'white' || raw === 'black' || raw === 'random' ? raw : DEFAULT_PLAYER_COLOR
}

function CoachContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL params are deep-link/initial values only — the setup screen owns the
  // explicit selection (same defaults/validation as the home screen).
  const initialLevel = validLevel(searchParams.get('level'))
  const initialColor = validColor(searchParams.get('color'))

  // 'setup' → user picks side + difficulty; 'playing' → game runs the selection.
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup')
  const [level, setLevel] = useState(initialLevel)
  const [playerColor, setPlayerColor] = useState<ResolvedColor>(() => resolvePlayerColor(initialColor))

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
      const redirect = encodeURIComponent(`/coach?level=${initialLevel}&color=${initialColor}`)
      router.replace(`/?redirect=${redirect}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, playerId])

  if (!sessionChecked || !playerId) {
    return <PageLoading label="Signing in…" />
  }

  const handleStart = (nextLevel: number, nextColor: PlayerColor) => {
    // Remember the selection (same keys as the home screen) and resolve
    // `random` once per game via the shared mechanism.
    try {
      localStorage.setItem(SELECTED_LEVEL_KEY, String(nextLevel))
      localStorage.setItem(SELECTED_COLOR_KEY, nextColor)
    } catch {
      // Storage may throw in SSR/quota — the game still starts with the selection.
    }
    setLevel(nextLevel)
    setPlayerColor(resolvePlayerColor(nextColor))
    setPhase('playing')
  }

  return (
    <ErrorBoundary fallback={<GameErrorFallback />}>
      <CoachGate playerId={playerId}>
        {phase === 'setup' ? (
          <CoachSetup
            initialLevel={initialLevel}
            initialColor={initialColor}
            onStart={handleStart}
            onBack={() => router.replace('/')}
          />
        ) : (
          <CoachGameComponent
            key={`${playerColor}-${level}`}
            playerId={playerId}
            playerColor={playerColor}
            botLevel={level}
            onLeave={() => router.replace('/')}
          />
        )}
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
