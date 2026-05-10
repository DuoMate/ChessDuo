'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { Auth } from '@/components/Auth'
import { RoomManager } from '@/components/Room'
import { Room } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type GameMode = 'offline' | 'online' | null

function SetupPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const joinCode = searchParams.get('join')
  const [gameMode, setGameMode] = useState<GameMode>(joinCode ? 'online' : null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<number>(4)
  const skillLevels = getAvailableSkillLevels()

  useEffect(() => {
    console.log('[PAGE] Home mounted, checking session...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.email?.split('@')[0] || 'Player'
        console.log(`[PAGE] Existing session found: userId=${session.user.id.substring(0,8)}... name=${name}`)
        setPlayerId(session.user.id)
        setUsername(name)
        if (joinCode) {
          setGameMode('online')
        }
      } else if (joinCode) {
        console.log('[PAGE] No session but join code present — auto guest sign-in')
        supabase.auth.signInAnonymously().then(({ data, error }) => {
          if (error || !data.user) {
            const randomId = Math.random().toString(36).substring(2, 15)
            setPlayerId(`anon_${randomId}`)
            setUsername(`Player${randomId}`)
          } else {
            setPlayerId(data.user.id)
            setUsername(`Player${data.user.id.substring(0, 8)}`)
          }
          setGameMode('online')
        })
      } else {
        console.log('[PAGE] No existing session')
      }
    })
  }, [joinCode])

  const handleAuthComplete = (userId: string, name: string) => {
    console.log(`[PAGE] Auth complete: userId=${userId.substring(0,8)}... name=${name} → entering online lobby`)
    setPlayerId(userId)
    setUsername(name)
    setGameMode('online')
  }

  const handleRoomJoined = (room: Room, team: 'WHITE' | 'BLACK', playerId: string) => {
    const url = `/game?mode=online&room=${room.id}&code=${room.code}&team=${team}&playerId=${playerId}`
    console.log(`[PAGE] Room joined: code=${room.code} team=${team} → navigating to game`)
    router.push(url)
  }

  const handleStartOffline = () => {
    console.log(`[PAGE] Starting offline game: level=${selectedLevel}`)
    router.push(`/game?level=${selectedLevel}`)
  }

  if (!gameMode) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-x-hidden">
        <header className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/30 h-14 flex items-center px-4">
          <span className="text-xl font-extrabold italic uppercase tracking-tighter text-yellow-400">ChessDuo</span>
        </header>

        <main className="flex-1 pt-28 pb-24 px-4 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden">
            <span className="material-symbols-outlined absolute -top-10 -left-10 text-[300px] text-yellow-400 rotate-12">chess</span>
            <span className="material-symbols-outlined absolute bottom-0 -right-20 text-[350px] text-yellow-400 -rotate-45">swords</span>
          </div>
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(rgb(234 179 8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          <div className="w-full max-w-4xl relative z-10">
            <h1 className="text-4xl md:text-6xl text-white text-center font-extrabold tracking-tight uppercase mb-12">
              SELECT <span className="text-yellow-400 italic">MODE</span>
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card rounded-[2rem] p-8 md:p-10 flex flex-col items-center group cursor-pointer hover:border-yellow-400/50 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_30px_rgba(234,179,8,0.15)] transition-all duration-500">
                <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6 bg-yellow-500/10 group-hover:scale-110 transition-transform duration-500">
                  <span className="material-symbols-outlined text-6xl text-yellow-400">groups</span>
                </div>
                <h2 className="text-2xl font-extrabold text-yellow-400 mb-1 uppercase tracking-tight">War Room</h2>
                <p className="text-gray-400 font-bold text-sm mb-8 uppercase tracking-widest">2v2 Matchmaking</p>
                <button
                  onClick={() => { console.log('[PAGE] Mode selected: ONLINE → War Room'); setGameMode('online') }}
                  className="w-full bg-yellow-500 text-gray-900 font-extrabold text-lg py-4 rounded-2xl uppercase tracking-tighter hover:bg-yellow-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  BATTLE
                  <span className="material-symbols-outlined font-bold">arrow_forward</span>
                </button>
                <div className="mt-5 flex items-center gap-3 text-gray-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest">You + Friend vs Rivals</span>
                </div>
              </div>

              <div className="glass-card rounded-[2rem] p-8 md:p-10 flex flex-col items-center group cursor-pointer hover:border-gray-400/50 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500">
                <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6 bg-gray-700/30 group-hover:scale-110 transition-transform duration-500">
                  <span className="material-symbols-outlined text-6xl text-gray-300">smart_toy</span>
                </div>
                <h2 className="text-2xl font-extrabold text-white mb-1 uppercase tracking-tight">Training</h2>
                <p className="text-gray-400 font-bold text-sm mb-8 uppercase tracking-widest">Play vs Bots</p>
                <button
                  onClick={() => { console.log('[PAGE] Mode selected: OFFLINE → Training'); setGameMode('offline') }}
                  className="w-full border-2 border-gray-600 text-gray-300 font-extrabold text-lg py-4 rounded-2xl uppercase tracking-tighter hover:bg-gray-700/50 hover:border-gray-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  PRACTICE
                  <span className="material-symbols-outlined font-bold">fitness_center</span>
                </button>
                <div className="mt-5 flex items-center gap-3 text-gray-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Team up with AI Teammate</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full py-4 bg-gray-950 border-t border-gray-800/30 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center px-4 gap-2 max-w-4xl mx-auto">
            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">ChessDuo</span>
            <div className="flex gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <Link href="/terms" className="hover:text-yellow-400 transition-colors">Terms</Link>
              <Link href="/support" className="hover:text-yellow-400 transition-colors">Support</Link>
            </div>
            <span className="text-[10px] text-gray-600 uppercase tracking-widest">© 2026</span>
          </div>
        </footer>
      </div>
    )
  }

  if (gameMode === 'offline') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <h1 className="text-4xl font-bold text-center mb-2">ChessDuo</h1>
          <p className="text-gray-400 text-center mb-8">Select your opponent&apos;s skill level</p>

          <div className="glass-panel rounded-xl p-6 mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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

            <div className="text-center mt-6">
              <button
                onClick={handleStartOffline}
                className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg text-lg transition-colors"
              >
                Start Game
              </button>
            </div>
          </div>

          <div className="text-center">
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
          difficulty={selectedLevel}
          initialJoinCode={joinCode}
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

export default function SetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    }>
      <SetupPageContent />
    </Suspense>
  )
}
