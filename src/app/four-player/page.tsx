'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
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
  const roomId = searchParams.get('room')
  const roomCode = searchParams.get('code')
  const playerId = searchParams.get('playerId')
  const time = searchParams.get('time') ? parseInt(searchParams.get('time')!, 10) : DEFAULT_TEAM_TIMER_SECONDS

  if (!roomId || !roomCode || !playerId) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Invalid Lobby Link</h1>
          <p className="text-gray-700 dark:text-gray-400 font-medium">Missing required parameters</p>
          <button onClick={() => router.push('/')} className="px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 transition-colors min-h-[44px]">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <FourPlayerLobbyComponent
      roomId={roomId}
      roomCode={roomCode}
      playerId={playerId}
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
