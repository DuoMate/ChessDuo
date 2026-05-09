'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { AuthModal } from '@/components/AuthModal'
import { LandingHero } from '@/components/LandingHero'
import { RoomManager } from '@/components/Room'
import { Room } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type PageMode = 'landing' | 'offline' | 'online'

export default function SetupPage() {
  const router = useRouter()
  const [pageMode, setPageMode] = useState<PageMode>('landing')
  const [authModalOpen, setAuthModalOpen] = useState(false)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername(session.user.email?.split('@')[0] || 'Player')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuthComplete = (userId: string, name: string) => {
    setPlayerId(userId)
    setUsername(name)
    setPageMode('online')
  }

  const handleRoomJoined = (room: Room, team: 'WHITE' | 'BLACK', playerId: string) => {
    router.push(`/game?mode=online&room=${room.id}&code=${room.code}&team=${team}&playerId=${playerId}`)
  }

  const handleStartOffline = () => {
    router.push(`/game?level=${selectedLevel}`)
  }

  const handlePlayOnline = () => {
    if (playerId) {
      setPageMode('online')
    } else {
      setAuthModalOpen(true)
    }
  }

  const handleGuestPlay = () => {
    setPageMode('online')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-yellow-400">♟️ ChessDuo</h1>
          <div className="flex items-center gap-3">
            {playerId ? (
              <>
                <span className="text-gray-400 text-xs hidden sm:inline">{username}</span>
                <button
                  onClick={() => setPageMode('online')}
                  className="text-xs text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  Play
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="text-xs text-gray-400 hover:text-yellow-400 transition-colors"
              >
                Sign In
              </button>
            )}
            <button
              onClick={() => router.push('/history')}
              className="text-xs text-gray-500 hover:text-yellow-400 transition-colors"
            >
              History
            </button>
          </div>
        </div>
      </header>

      {/* Landing */}
      {pageMode === 'landing' && (
        <main>
          <LandingHero
            onPlayOnline={handlePlayOnline}
            onPlayOffline={() => setPageMode('offline')}
            onGuestPlay={handleGuestPlay}
          />

          <div className="max-w-2xl mx-auto px-4 pb-12">
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">🤖</div>
                <p className="text-xs font-medium text-white">6 Bot Levels</p>
                <p className="text-[10px] text-gray-500">1000–2600 ELO</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">⚡</div>
                <p className="text-xs font-medium text-white">Simul Turns</p>
                <p className="text-[10px] text-gray-500">Blind evaluation</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">🔍</div>
                <p className="text-xs font-medium text-white">Move Insights</p>
                <p className="text-[10px] text-gray-500">3 free/account</p>
              </div>
            </div>

            <div className="flex justify-center gap-6 text-xs">
              <button
                onClick={() => router.push('/premium')}
                className="text-gray-500 hover:text-yellow-400 transition-colors"
              >
                ✨ Premium
              </button>
              <button
                onClick={() => router.push('/profile')}
                className="text-gray-500 hover:text-yellow-400 transition-colors"
              >
                👤 Profile
              </button>
              {playerId && (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut()
                    setPlayerId(null)
                    setUsername('')
                    setPageMode('landing')
                  }}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  🚪 Sign Out
                </button>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Offline Level Selector */}
      {pageMode === 'offline' && (
        <main className="flex flex-col items-center justify-center p-4 pt-12">
          <div className="max-w-3xl w-full">
            <h2 className="text-2xl font-bold text-center mb-2">vs Computer</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Select opponent skill level</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {skillLevels.map((level: SkillLevel) => (
                <button
                  key={level.level}
                  onClick={() => setSelectedLevel(level.level)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-center ${
                    selectedLevel === level.level
                      ? 'border-yellow-500 bg-yellow-500/20 shadow-lg shadow-yellow-500/30'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <div className="text-lg font-bold mb-1">{level.label}</div>
                  <div className="text-xs text-gray-300">{level.description}</div>
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
                onClick={() => setPageMode('landing')}
                className="text-gray-500 hover:text-gray-400 text-sm"
              >
                ← Back
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Online — Room Manager */}
      {pageMode === 'online' && (
        <main>
          <RoomManager
            playerId={playerId || ''}
            username={username}
            onRoomJoined={handleRoomJoined}
          />
          <div className="text-center pb-8">
            <button
              onClick={() => setPageMode('landing')}
              className="text-gray-500 hover:text-gray-400 text-sm"
            >
              ← Home
            </button>
          </div>
        </main>
      )}

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthComplete={handleAuthComplete}
      />
    </div>
  )
}
