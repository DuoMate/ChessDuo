'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { joinFourPlayerByCode } from '@/lib/fourPlayerActions'
import { DEFAULT_TEAM_TIMER_SECONDS } from '@/features/shared/gameConstants'

const FourPlayerLobbyComponent = dynamic(() => import('@/components/FourPlayerLobby').then(mod => ({ default: mod.FourPlayerLobby })), {
  loading: () => (
    <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Loading lobby...</p>
      </div>
    </div>
  ),
  ssr: false,
})

function FourPlayerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [resolved, setResolved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roomId = searchParams.get('room')
  const roomCode = searchParams.get('code')
  const urlPlayerId = searchParams.get('playerId')
  const joinCode = searchParams.get('join')
  const time = searchParams.get('time') ? parseInt(searchParams.get('time')!, 10) : DEFAULT_TEAM_TIMER_SECONDS

  useEffect(() => {
    if (resolved) return

    const resolve = async () => {
      if (roomId && roomCode && urlPlayerId) {
        setResolved(true)
        return
      }

      if (joinCode) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          const redirect = encodeURIComponent(`/four-player?join=${joinCode}`)
          router.replace(`/?signup=1&redirect=${redirect}`)
          return
        }

        const result = await joinFourPlayerByCode({ code: joinCode, playerId: session.user.id })
        if (!result) {
          setError('Room not found or already started')
          return
        }

        router.replace(`/four-player?room=${result.roomId}&code=${result.roomCode}&playerId=${session.user.id}&time=${result.timeSeconds}`)
        return
      }

      setError('Missing required parameters')
    }

    resolve()
    setResolved(true)
  }, [roomId, roomCode, urlPlayerId, joinCode, resolved, router])

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Error</h1>
          <p className="text-gray-700 dark:text-gray-400 font-medium">{error}</p>
          <button onClick={() => router.push('/')} className="px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 transition-colors min-h-[44px]">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!roomId || !roomCode || !urlPlayerId) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <FourPlayerLobbyComponent
      roomId={roomId}
      roomCode={roomCode}
      playerId={urlPlayerId}
      timeSeconds={time}
    />
  )
}

export default function FourPlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Loading...</p>
        </div>
      </div>
    }>
      <FourPlayerContent />
    </Suspense>
  )
}
