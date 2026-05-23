'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { DuelGame } from '@/components/DuelGame'

function DuelContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('room')
  const roomCode = searchParams.get('code')
  const playerId = searchParams.get('playerId')
  const team = searchParams.get('team') as 'WHITE' | 'BLACK' | null
  const time = searchParams.get('time') ? parseInt(searchParams.get('time')!, 10) : 600

  if (!roomId || !roomCode || !playerId || !team) {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-red-400">Invalid Duel Link</h1>
          <p className="text-gray-400">Missing required parameters</p>
          <button onClick={() => router.push('/')} className="px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <DuelGame
      roomId={roomId}
      roomCode={roomCode}
      playerId={playerId}
      team={team}
      timeLimit={time}
      onLeave={() => router.push('/')}
    />
  )
}

export default function DuelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f1119] text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <DuelContent />
    </Suspense>
  )
}
