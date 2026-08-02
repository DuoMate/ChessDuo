'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { RoomService } from '@/lib/roomService'
import { getChallengeByCode, deactivateChallenge } from '@/lib/challenges'
import { generateRoomCode } from '@/lib/roomActions'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageLoading } from '@/components/PageLoading'
import { BackButton } from '@/components/BackButton'
import InstallBanner from '@/components/InstallBanner'

export default function ChallengePageClient() {
  const params = useParams()
  const router = useRouter()
  const challengeCode = params.code as string

  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'loading' | 'need_auth' | 'invalid' | 'expired' | 'joining' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [challengeInfo, setChallengeInfo] = useState<{
    id: string
    game_mode: string
    time_seconds: number
    creator_id: string
    room_id: string | null
  } | null>(null)
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string; avatarUrl?: string | null } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    AuthService.getSession().then(session => {
      if (!mountedRef.current) return
      setPlayerId(session?.user?.id || null)
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setLoading(false)
    })

    getChallengeByCode(challengeCode).then((challenge) => {
      if (!mountedRef.current) return
      if (!challenge) {
        setStatus('invalid')
        setLoading(false)
        return
      }

      if (new Date(challenge.expires_at) < new Date()) {
        setStatus('expired')
        setLoading(false)
        return
      }

      setChallengeInfo({
        id: challenge.id,
        game_mode: challenge.game_mode,
        time_seconds: challenge.time_seconds,
        creator_id: challenge.creator_id,
        room_id: challenge.room_id ?? null,
      })
    }).catch(() => {
      if (!mountedRef.current) return
      setStatus('invalid')
      setLoading(false)
    })
  }, [challengeCode])

  const joinChallenge = useCallback(async () => {
    if (!challengeInfo || !playerId) return
    setStatus('joining')

    try {
      let room: { id: string; code: string } | null = null

      // Duel challenges pre-create a room + duel_games row; the acceptor must
      // join THAT room so both players end up in the same match. Fall back to
      // creating a fresh room if the pre-created one is gone or non-existent.
      if (challengeInfo.room_id) {
        const { data } = await supabase.from('rooms').select('id, code').eq('id', challengeInfo.room_id).maybeSingle()
        if (data) room = data
      }

      if (!room) {
        const roomCode = generateRoomCode()
        const { data: created, error: roomError } = await supabase
          .from('rooms')
          .insert({ code: roomCode, status: 'waiting', created_by: challengeInfo.creator_id, host_team: 'WHITE' })
          .select('*')
          .single()

        if (roomError || !created) throw new Error('Failed to create room')
        room = created
      }

      await Promise.all([
        RoomService.insertRoomPlayer({
          room_id: room.id,
          player_id: challengeInfo.creator_id,
          team: 'WHITE',
          slot: 0,
        }),
        RoomService.insertRoomPlayer({
          room_id: room.id,
          player_id: playerId,
          team: 'BLACK',
          slot: 0,
        }),
      ])

      await deactivateChallenge(challengeCode)

      // A pre-created room means this was a duel challenge → join the 1v1 duel.
      // Otherwise it is a 2v2 online challenge.
      if (challengeInfo.room_id) {
        router.replace(
          `/duel?room=${room.id}&code=${room.code}&team=BLACK&playerId=${playerId}&time=${challengeInfo.time_seconds}`
        )
      } else {
        router.replace(
          `/game?mode=online&room=${room.id}&code=${room.code}&team=BLACK&playerId=${playerId}&time=${challengeInfo.time_seconds}&challengeId=${challengeInfo.id}`
        )
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to join challenge')
    }
  }, [challengeInfo, challengeCode, playerId, router])

  useEffect(() => {
    if (!playerId || !challengeInfo) return
    if (playerId === challengeInfo.creator_id) {
      setStatus('error')
      setErrorMsg('You cannot accept your own challenge')
      return
    }
    joinChallenge()
  }, [playerId, challengeInfo, joinChallenge])

  const handleAuthComplete = (userId: string) => {
    setPlayerId(userId)
  }

  const handleNeedUsername = (userId: string, suggestedName: string, avatarUrl?: string | null) => {
    setNeedsUsername({ userId, suggestedName, avatarUrl })
  }

  const handleUsernameChosen = (userId: string) => {
    setNeedsUsername(null)
    setPlayerId(userId)
  }

  if (needsUsername) {
    return (
      <>
        <InstallBanner />
        <ErrorBoundary>
          <ChooseUsername
            userId={needsUsername.userId}
            suggestedName={needsUsername.suggestedName}
            avatarUrl={needsUsername.avatarUrl}
            onAuthComplete={handleUsernameChosen}
          />
        </ErrorBoundary>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <InstallBanner />
        <PageLoading label="Loading challenge..." />
      </>
    )
  }

  if (status === 'need_auth' || (!playerId && !loading && status === 'loading')) {
    return (
      <>
        <InstallBanner />
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg-alt)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
            <div className="max-w-sm w-full text-center space-y-6">
              <div className="text-5xl mb-2">⚡</div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Challenge Match</h1>
              <p className="text-gray-500 dark:text-gray-400">Sign in to accept this challenge</p>

              <Auth onAuthComplete={handleAuthComplete} onNeedUsername={handleNeedUsername} />
            </div>
          </div>
        </ErrorBoundary>
      </>
    )
  }

  return (
    <>
      <InstallBanner />
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg-alt)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 pb-20">
        <div className="max-w-sm w-full text-center space-y-4">
          {status === 'invalid' && (
            <>
              <div className="text-5xl mb-2">🔗</div>
              <h1 className="text-xl font-bold text-red-400">Invalid Challenge</h1>
              <p className="text-gray-500 dark:text-gray-400">This challenge link is invalid or has already been used</p>
              <BackButton label="Go Home" />
            </>
          )}

          {status === 'expired' && (
            <>
              <div className="text-5xl mb-2">⏰</div>
              <h1 className="text-xl font-bold text-red-400">Challenge Expired</h1>
              <p className="text-gray-500 dark:text-gray-400">This challenge link has expired (24h limit)</p>
              <BackButton label="Go Home" />
            </>
          )}

          {status === 'joining' && (
            <>
              <div className="animate-spin text-4xl mb-2">⚡</div>
              <h1 className="text-xl font-bold text-yellow-600 dark:text-yellow-400">Joining Challenge...</h1>
              <p className="text-gray-500 dark:text-gray-400">Setting up the game room</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-5xl mb-2">⚠️</div>
              <h1 className="text-xl font-bold text-red-400">Error</h1>
              <p className="text-gray-500 dark:text-gray-400">{errorMsg}</p>
              <BackButton label="Go Home" />
            </>
          )}
        </div>
      </div>
      </ErrorBoundary>
    </>
  )
}
