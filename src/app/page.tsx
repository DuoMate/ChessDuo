'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { Auth } from '@/components/Auth'
import { RoomManager } from '@/components/Room'
import { MatchmakingQueue } from '@/components/MatchmakingQueue'
import { Room } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type GameMode = 'offline' | 'online' | 'quickmatch' | null

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
        setGameMode('online')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername(session.user.email?.split('@')[0] || 'Player')
        setGameMode('online')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuthComplete = (userId: string, name: string) => {
    setPlayerId(userId)
    setUsername(name)
    setGameMode('online')
  }

  const handleRoomJoined = (room: Room, team: 'WHITE' | 'BLACK', playerId: string) => {
    router.push(`/game?mode=online&room=${room.id}&code=${room.code}&team=${team}&playerId=${playerId}`)
  }

  const handleStartOffline = () => {
    router.push(`/game?level=${selectedLevel}`)
  }

  if (!gameMode) {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Giant knight background */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 text-[340px] leading-none opacity-[0.025] text-yellow-400 select-none pointer-events-none">
          {"\u265E"}
        </div>

        {/* Board pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 44px, rgba(255,255,255,0.4) 44px, rgba(255,255,255,0.4) 45px),
                              repeating-linear-gradient(90deg, transparent, transparent 44px, rgba(255,255,255,0.4) 44px, rgba(255,255,255,0.4) 45px)`
          }}
        />

        {/* Radial glow */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.05) 0%, transparent 70%)' }}
        />

        <div className="max-w-md w-full relative z-10">
          {/* Brand */}
          <div className="text-center mb-6">
            <div className="text-[42px] mb-1 drop-shadow-[0_0_20px_rgba(250,204,21,0.2)]">
{"\u2654"}
            </div>
            <h1 className="text-[30px] font-black text-yellow-400 tracking-wider">ChessDuo</h1>
            <p className="text-[9px] text-gray-500 tracking-[0.2em] uppercase mt-0.5">Play Smarter, Together</p>
          </div>

          {/* Prompt */}
          <p className="text-sm text-gray-400 text-center font-medium mb-4">Choose your game mode</p>

          {/* Mode cards */}
          <div className="flex flex-col gap-3 mb-5">
            <button
              onClick={() => setGameMode('offline')}
              className="flex items-center gap-3.5 p-[18px] rounded-2xl border border-white/8 bg-white/[0.04] hover:border-yellow-500/30 hover:bg-yellow-500/[0.04] transition-all duration-200 text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-500/8 border border-yellow-500/12 flex items-center justify-center flex-shrink-0 text-[28px] drop-shadow-[0_0_8px_rgba(250,204,21,0.15)]">
                {"\u265E"}
              </div>
              <div className="flex-1">
                <div className="font-bold text-[15px] text-gray-100 group-hover:text-yellow-400 transition-colors">Play Offline</div>
                <div className="text-[11px] text-gray-500 mt-0.5">vs Bot teammate</div>
              </div>
              <span className="text-base text-yellow-400 opacity-30 group-hover:opacity-60 transition-opacity">{"\u25B8"}</span>
            </button>

            <button
              onClick={() => setGameMode('online')}
              className="flex items-center gap-3.5 p-[18px] rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.03] hover:border-yellow-500/40 hover:bg-yellow-500/[0.06] transition-all duration-200 text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0 text-[28px] drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]">
                {"\u265B"}
              </div>
              <div className="flex-1">
                <div className="font-bold text-[15px] text-yellow-400 group-hover:brightness-110 transition-all">Play Online</div>
                <div className="text-[11px] text-gray-500 mt-0.5">with a friend</div>
              </div>
              <span className="text-base text-yellow-400 group-hover:opacity-100 transition-opacity">{"\u25B8"}</span>
            </button>

            <button
              onClick={() => setGameMode('quickmatch')}
              className="flex items-center gap-3.5 p-[18px] rounded-2xl border border-white/8 bg-white/[0.04] hover:border-yellow-500/30 hover:bg-yellow-500/[0.04] transition-all duration-200 text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-500/8 border border-yellow-500/12 flex items-center justify-center flex-shrink-0 text-[28px] drop-shadow-[0_0_8px_rgba(250,204,21,0.15)]">
                {"\u26A1"}
              </div>
              <div className="flex-1">
                <div className="font-bold text-[15px] text-gray-100 group-hover:text-yellow-400 transition-colors">Quick Match</div>
                <div className="text-[11px] text-gray-500 mt-0.5">auto-find teammate</div>
              </div>
              <span className="text-base text-yellow-400 opacity-30 group-hover:opacity-60 transition-opacity">{"\u25B8"}</span>
            </button>
          </div>

          {/* King vs King divider */}
          <div className="text-center mb-5">
            <div className="flex items-center justify-center gap-2 text-2xl opacity-[0.12] text-yellow-400">
              <span>{"\u2654"}</span>
              <span className="text-[10px] text-gray-600">vs</span>
              <span className="text-gray-500">{"\u265A"}</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">White team — You + Teammate (2v2 vs Black bots)</p>
          </div>

          {/* Footer links */}
          <div className="flex justify-center gap-5 text-[11px]">
            <button onClick={() => router.push('/history')} className="text-gray-500 hover:text-yellow-400 transition-colors">
              {"\uD83D\uDCCB"} History
            </button>
            <button onClick={() => router.push('/premium')} className="text-yellow-400 hover:brightness-110 transition-all">
              {"\u2728"} Premium
            </button>
            <button onClick={() => router.push('/profile')} className="text-gray-500 hover:text-yellow-400 transition-colors">
              {"\uD83D\uDC64"} Profile
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
              className="text-gray-500 hover:text-red-400 transition-colors"
            >
              {"\uD83D\uDEAA"} Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameMode === 'offline') {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-[36px] mb-1 drop-shadow-[0_0_16px_rgba(250,204,21,0.15)]">
              {"\u265E"}
            </div>
            <h1 className="text-2xl font-black text-yellow-400 tracking-wider">OFFLINE</h1>
            <p className="text-[10px] text-gray-500 tracking-[0.15em] uppercase mt-0.5">Select opponent skill level</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {skillLevels.map((level: SkillLevel) => (
              <button
                key={level.level}
                onClick={() => setSelectedLevel(level.level)}
                className={`
                  p-5 rounded-xl border transition-all duration-200 text-center
                  ${selectedLevel === level.level
                    ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                    : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
                  }
                `}
              >
                <div className="text-base font-bold mb-1">{level.label}</div>
                <div className="text-[11px] text-gray-400">{level.description}</div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={handleStartOffline}
              className="px-10 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-xl text-base transition-colors shadow-[0_0_20px_rgba(250,204,21,0.15)]"
            >
              Start Game
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => setGameMode(null)}
              className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
            >
              {"\u2190"} Back to game mode
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameMode === 'online') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-[#0f1119] text-white">
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={() => setGameMode(null)}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              {"\u2190"} Back
            </button>
          </div>
          <Auth onAuthComplete={handleAuthComplete} />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-[#0f1119] text-white">
        <RoomManager
          playerId={playerId}
          username={username}
          onRoomJoined={handleRoomJoined}
        />
        <div className="mt-8 text-center pb-8">
          <button
            onClick={() => setGameMode(null)}
            className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
          >
            {"\u2190"} Back to game mode
          </button>
        </div>
      </div>
    )
  }

  if (gameMode === 'quickmatch') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-[#0f1119] text-white">
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={() => setGameMode(null)}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              {"\u2190"} Back
            </button>
          </div>
          <Auth onAuthComplete={handleAuthComplete} />
        </div>
      )
    }

    return (
      <MatchmakingQueue
        playerId={playerId}
        username={username}
        onRoomJoined={handleRoomJoined}
        onCancel={() => setGameMode(null)}
      />
    )
  }

  return null
}
