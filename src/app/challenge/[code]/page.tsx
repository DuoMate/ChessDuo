'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getChallengeByCode, deactivateChallenge } from '@/lib/challenges'
import { Auth } from '@/components/Auth'

export default function ChallengePage() {
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
  } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPlayerId(session?.user?.id || null)
      setLoading(false)
    })

    getChallengeByCode(challengeCode).then((challenge) => {
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
      })
    })
  }, [challengeCode])

  const joinChallenge = useCallback(async () => {
    if (!challengeInfo || !playerId) return
    setStatus('joining')

    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({ code: roomCode, status: 'waiting', created_by: challengeInfo.creator_id })
        .select('*')
        .single()

      if (roomError) throw new Error('Failed to create room')

      await Promise.all([
        supabase.from('room_players').insert({
          room_id: room.id,
          player_id: challengeInfo.creator_id,
          team: 'WHITE',
          slot: 0,
        }),
        supabase.from('room_players').insert({
          room_id: room.id,
          player_id: playerId,
          team: 'BLACK',
          slot: 0,
        }),
      ])

      await deactivateChallenge(challengeCode)

      router.replace(
        `/game?mode=online&room=${room.id}&code=${room.code}&team=BLACK&playerId=${playerId}&time=${challengeInfo.time_seconds}&challengeId=${challengeInfo.id}`
      )
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading challenge...</p>
      </div>
    )
  }

  if (status === 'need_auth' || (!playerId && !loading && status === 'loading')) {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="text-5xl mb-2">⚡</div>
          <h1 className="text-2xl font-bold text-white">Challenge Match</h1>
          <p className="text-gray-400">Sign in to accept this challenge</p>

          <Auth onAuthComplete={handleAuthComplete} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1119] text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === 'invalid' && (
          <>
            <div className="text-5xl mb-2">🔗</div>
            <h1 className="text-xl font-bold text-red-400">Invalid Challenge</h1>
            <p className="text-gray-400">This challenge link is invalid or has already been used</p>
            <button onClick={() => router.push('/')} className="mt-4 px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400">
              Go Home
            </button>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="text-5xl mb-2">⏰</div>
            <h1 className="text-xl font-bold text-red-400">Challenge Expired</h1>
            <p className="text-gray-400">This challenge link has expired (24h limit)</p>
            <button onClick={() => router.push('/')} className="mt-4 px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400">
              Go Home
            </button>
          </>
        )}

        {status === 'joining' && (
          <>
            <div className="animate-spin text-4xl mb-2">⚡</div>
            <h1 className="text-xl font-bold text-yellow-400">Joining Challenge...</h1>
            <p className="text-gray-400">Setting up the game room</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-2">⚠️</div>
            <h1 className="text-xl font-bold text-red-400">Error</h1>
            <p className="text-gray-400">{errorMsg}</p>
            <button onClick={() => router.push('/')} className="mt-4 px-6 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600">
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  )
}
