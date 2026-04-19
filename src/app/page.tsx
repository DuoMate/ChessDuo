'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/lib/botConfig'
import { supabase } from '@/lib/supabase'
import { Auth } from '@/components/Auth'
import { RoomManager } from '@/components/Room'
import { Room } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type GameMode = 'offline' | 'online' | null

export default function SetupPage() {
  const router = useRouter()
  const [gameMode, setGameMode] = useState<GameMode>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<number>(4)
  const skillLevels = getAvailableSkillLevels()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername(session.user.email?.split('@')[0] || 'Player')
      }
    })
  }, [])

  const handleAuthComplete = (userId: string, name: string) => {
    setPlayerId(userId)
    setUsername(name)
    setGameMode('online')
  }

  const handleRoomJoined = (room: Room, team: 'WHITE' | 'BLACK') => {
    router.push(`/game?mode=online&room=${room.id}&team=${team}`)
  }

  const handleStartOffline = () => {
    router.push(`/game?level=${selectedLevel}`)
  }

  if (!gameMode) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <h1 className="text-4xl font-bold text-center mb-2 text-yellow-400">♟️ ChessDuo</h1>
          <p className="text-gray-400 text-center mb-8">Choose your game mode</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setGameMode('offline')}
              className="p-8 rounded-lg border-2 border-gray-600 bg-gray-800 hover:border-yellow-500 hover:bg-gray-700 transition-all text-center"
            >
              <div className="text-3xl mb-2">🤖</div>
              <div className="text-xl font-bold mb-2">Play Offline</div>
              <div className="text-gray-400 text-sm">vs Bot teammate</div>
            </button>

            <button
              onClick={() => setGameMode('online')}
              className="p-8 rounded-lg border-2 border-gray-600 bg-gray-800 hover:border-yellow-500 hover:bg-gray-700 transition-all text-center"
            >
              <div className="text-3xl mb-2">👥</div>
              <div className="text-xl font-bold mb-2">Play Online</div>
              <div className="text-gray-400 text-sm">with a friend</div>
            </button>
          </div>

          {gameMode === null && (
            <div className="text-center text-gray-500 text-sm">
              <p>White team: You + Teammate (2v2 vs Black bots)</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (gameMode === 'offline') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <h1 className="text-4xl font-bold text-center mb-2">ChessDuo - Offline</h1>
          <p className="text-gray-400 text-center mb-8">Select your opponent&apos;s skill level</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {skillLevels.map((level: SkillLevel) => (
              <button
                key={level.level}
                onClick={() => setSelectedLevel(level.level)}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200 text-center
                  ${selectedLevel === level.level
                    ? 'border-yellow-500 bg-yellow-500/20 shadow-lg shadow-yellow-500/30'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-400 hover:bg-gray-700'
                  }
                `}
              >
                <div className="text-lg font-bold mb-1">{level.label}</div>
                <div className="text-sm text-gray-300">{level.description}</div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={handleStartOffline}
              className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg text-lg transition-colors"
            >
              Start Game
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => setGameMode(null)}
              className="text-gray-500 hover:text-gray-400 text-sm"
            >
              ← Back to game mode
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameMode === 'online') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-gray-900 text-white">
          <Auth onAuthComplete={handleAuthComplete} />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <RoomManager
          playerId={playerId}
          username={username}
          onRoomJoined={handleRoomJoined}
        />
        <div className="mt-8 text-center">
          <button
            onClick={() => setGameMode(null)}
            className="text-gray-500 hover:text-gray-400 text-sm"
          >
            ← Back to game mode
          </button>
        </div>
      </div>
    )
  }

  return null
}
