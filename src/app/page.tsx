'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { Auth } from '@/components/Auth'
import { RoomManager } from '@/components/Room'
import { MatchmakingQueue } from '@/components/MatchmakingQueue'
import { SlideOver } from '@/components/SlideOver'
import { ProfilePanel } from '@/components/ProfilePanel'
import { FriendsPanel } from '@/components/FriendsPanel'
import { Room } from '@/lib/supabase'
import { getUnreadCounts } from '@/lib/messages'

export const dynamic = 'force-dynamic'

type GameMode = 'offline' | 'online' | 'quickmatch' | null

interface TimeOption {
  seconds: number
  label: string
  icon: string
  description: string
}

const TIME_OPTIONS: TimeOption[] = [
  { seconds: 300, label: '5 min', icon: '⚡', description: 'Blitz' },
  { seconds: 600, label: '10 min', icon: '⏱', description: 'Rapid' },
  { seconds: 900, label: '15 min', icon: '🕐', description: 'Rapid' },
  { seconds: 1800, label: '30 min', icon: '🕒', description: 'Classical' },
]

export default function SetupPage() {
  const router = useRouter()
  const [gameMode, setGameMode] = useState<GameMode>(null)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<number>(4)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const skillLevels = getAvailableSkillLevels()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername(session.user.email?.split('@')[0] || 'Player')
      }
      setSessionChecked(true)
    }).catch(() => {
      setSessionChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername(session.user.email?.split('@')[0] || 'Player')
      } else {
        setPlayerId(null)
        setUsername('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (playerId) {
      getUnreadCounts(playerId).then(({ total }) => setUnreadMessages(total))
      const interval = setInterval(() => {
        getUnreadCounts(playerId).then(({ total }) => setUnreadMessages(total))
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [playerId])

  const handleAuthComplete = (userId: string, name: string) => {
    setPlayerId(userId)
    setUsername(name)
  }

  const handleRoomJoined = (room: Room, team: 'WHITE' | 'BLACK', playerId: string) => {
    const time = selectedTime || 600
    router.push(`/game?mode=online&room=${room.id}&code=${room.code}&team=${team}&playerId=${playerId}&time=${time}`)
  }

  const handleStartOffline = () => {
    const time = selectedTime || 600
    router.push(`/game?level=${selectedLevel}&time=${time}`)
  }

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinLoading(true)
    setJoinError(null)

    try {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .single()

      if (roomError || !room) {
        setJoinError('Room not found — check the code')
        return
      }

      if (room.status !== 'waiting') {
        setJoinError('Room is no longer available')
        return
      }

      if (!playerId) {
        setJoinError('Sign in required — please sign in below')
        return
      }

      const { data: existingPlayers } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)

      const whiteSlots = (existingPlayers || []).filter(p => p.team === 'WHITE')
      const blackSlots = (existingPlayers || []).filter(p => p.team === 'BLACK')

      let team: 'WHITE' | 'BLACK' = 'WHITE'
      if (whiteSlots.length < 2) {
        team = 'WHITE'
      } else if (blackSlots.length < 2) {
        team = 'BLACK'
      } else {
        setJoinError('Room is full')
        return
      }

      await supabase.from('room_players').upsert({
        room_id: room.id,
        player_id: playerId,
        team,
        status: 'ready'
      }, { onConflict: 'room_id,player_id' })

      setJoinLoading(false)
      handleRoomJoined(room, team, playerId)
    } catch (e) {
      setJoinError('Something went wrong — try again')
    } finally {
      setJoinLoading(false)
    }
  }

  if (!sessionChecked) return null

  const showTopBar = !gameMode || (gameMode && selectedTime === null)

  // ============================================
  // Time selection screen
  // ============================================
  if (gameMode && selectedTime === null) {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col">
        {showTopBar && <TopBar playerId={playerId} unreadMessages={unreadMessages} onProfile={() => setProfileOpen(true)} onFriends={() => setFriendsOpen(true)} />}

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-[36px] mb-1 drop-shadow-[0_0_16px_rgba(250,204,21,0.15)]">
                {gameMode === 'offline' ? '\u265E' : gameMode === 'online' ? '\u265B' : '\u26A1'}
              </div>
              <h1 className="text-2xl font-black text-yellow-400 tracking-wider">
                {gameMode === 'offline' ? 'OFFLINE' : gameMode === 'online' ? 'ONLINE' : 'QUICK MATCH'}
              </h1>
              <p className="text-[10px] text-gray-500 tracking-[0.15em] uppercase mt-0.5">Select game duration</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {TIME_OPTIONS.map((option: TimeOption) => (
                <button
                  key={option.seconds}
                  onClick={() => setSelectedTime(option.seconds)}
                  className={`
                    p-5 rounded-xl border transition-all duration-200 text-center
                    ${selectedTime === option.seconds
                      ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                      : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
                    }
                  `}
                >
                  <div className="text-[28px] mb-1.5">{option.icon}</div>
                  <div className="text-lg font-bold mb-0.5">{option.label}</div>
                  <div className="text-[11px] text-gray-400">{option.description}</div>
                </button>
              ))}
            </div>

            <div className="text-center mb-4">
              <p className="text-[10px] text-gray-600">Game ends when time runs out. Winner decided by board advantage.</p>
            </div>

          <div className="text-center">
            <button
              onClick={() => setGameMode(null)}
              className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
            >
              {'\u2190'} Back to game mode
            </button>
          </div>

          {gameMode === 'online' && (
            <>
              <div className="flex items-center gap-3 mb-4 mt-6">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              <div className="mb-4">
                <p className="text-[10px] text-gray-500 tracking-[0.15em] uppercase mb-2">
                  Have a room code?
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null) }}
                    placeholder="ABC123"
                    maxLength={6}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    disabled={joinLoading}
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.05] 
                               text-white text-base placeholder:text-gray-600 
                               focus:border-yellow-500/40 focus:outline-none focus:bg-white/[0.08]
                               disabled:opacity-40 transition-all"
                    style={{ minHeight: '44px' }}
                  />
                  <button
                    onClick={handleJoinByCode}
                    disabled={joinLoading || !joinCode.trim()}
                    className="px-5 py-3 rounded-xl bg-yellow-500/15 border border-yellow-500/25 
                               text-yellow-400 font-semibold text-sm
                               hover:bg-yellow-500/25 active:bg-yellow-500/35
                               disabled:opacity-30 disabled:cursor-not-allowed
                               transition-all whitespace-nowrap"
                    style={{ minHeight: '44px' }}
                  >
                    {joinLoading ? 'Joining...' : 'Join'}
                  </button>
                </div>
                {joinError && (
                  <p className="text-red-400 text-[11px] mt-1.5">{joinError}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {playerId && (
        <>
          <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
            <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); router.push('/history') }} />
          </SlideOver>

          <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); getUnreadCounts(playerId).then(({ total }) => setUnreadMessages(total)) }} title="Friends">
            <FriendsPanel playerId={playerId} />
          </SlideOver>
        </>
      )}
    </div>
  )
  }

  // ============================================
  // Home screen — game mode selection
  // ============================================
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col relative overflow-hidden">
        <TopBar playerId={playerId} unreadMessages={unreadMessages} onProfile={() => setProfileOpen(true)} onFriends={() => setFriendsOpen(true)} />

        {/* Giant knight background */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-[340px] leading-none opacity-[0.025] text-yellow-400 select-none pointer-events-none">
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

        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full relative z-10 px-4">
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
              {!playerId && (
                <button onClick={() => setGameMode('online')} className="text-gray-500 hover:text-red-400 transition-colors">
                  {"\uD83D\uDEAA"} Sign In
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Slide-over panels for authenticated users */}
        {playerId && (
          <>
            <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
              <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); router.push('/history') }} />
            </SlideOver>

            <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); getUnreadCounts(playerId!).then(({ total }) => setUnreadMessages(total)) }} title="Friends">
              <FriendsPanel playerId={playerId} />
            </SlideOver>
          </>
        )}
      </div>
    )
  }

  // ============================================
  // Offline mode — skill level selection
  // ============================================
  if (gameMode === 'offline') {
    return (
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col">
        {showTopBar && <TopBar playerId={playerId} unreadMessages={unreadMessages} onProfile={() => setProfileOpen(true)} onFriends={() => setFriendsOpen(true)} />}

        <div className="flex-1 flex flex-col items-center justify-center p-4">
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
                onClick={() => setSelectedTime(null)}
                className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
              >
                {"\u2190"} Back to time
              </button>
            </div>
          </div>
        </div>

        {playerId && (
          <>
            <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
              <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); router.push('/history') }} />
            </SlideOver>

            <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); getUnreadCounts(playerId!).then(({ total }) => setUnreadMessages(total)) }} title="Friends">
              <FriendsPanel playerId={playerId} />
            </SlideOver>
          </>
        )}
      </div>
    )
  }

  // ============================================
  // Online mode
  // ============================================
  if (gameMode === 'online') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-[#0f1119] text-white">
          <TopBar playerId={playerId} unreadMessages={unreadMessages} onProfile={() => setProfileOpen(true)} onFriends={() => setFriendsOpen(true)} />
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={() => setSelectedTime(null)}
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
      <div className="min-h-screen bg-[#0f1119] text-white flex flex-col">
        <TopBar playerId={playerId} unreadMessages={unreadMessages} onProfile={() => setProfileOpen(true)} onFriends={() => setFriendsOpen(true)} />
        <RoomManager
          playerId={playerId}
          username={username}
          onRoomJoined={handleRoomJoined}
        />
        <div className="mt-8 text-center pb-8">
          <button
            onClick={() => setSelectedTime(null)}
            className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
          >
            {"\u2190"} Back to time
          </button>
        </div>

        {playerId && (
          <>
            <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
              <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); router.push('/history') }} />
            </SlideOver>

            <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); getUnreadCounts(playerId!).then(({ total }) => setUnreadMessages(total)) }} title="Friends">
              <FriendsPanel playerId={playerId} />
            </SlideOver>
          </>
        )}
      </div>
    )
  }

  // ============================================
  // Quick Match mode
  // ============================================
  if (gameMode === 'quickmatch') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-[#0f1119] text-white">
          <TopBar playerId={playerId} unreadMessages={unreadMessages} onProfile={() => setProfileOpen(true)} onFriends={() => setFriendsOpen(true)} />
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={() => setSelectedTime(null)}
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

// ============================================
// Top Bar Component
// ============================================
function TopBar({
  playerId,
  unreadMessages,
  onProfile,
  onFriends,
}: {
  playerId: string | null
  unreadMessages: number
  onProfile: () => void
  onFriends: () => void
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-2 bg-[#0f1119]/80 backdrop-blur-md border-b border-white/5">
      {/* Left: Profile */}
      <button
        onClick={() => playerId ? onProfile() : onFriends()}
        className="min-h-[44px] min-w-[44px] flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition-colors rounded-lg hover:bg-white/[0.05] px-2"
      >
        <span className="text-xl">{playerId ? '👤' : '🚪'}</span>
        <span className="text-sm hidden sm:inline">{playerId ? 'Profile' : 'Sign In'}</span>
      </button>

      {/* Center: Brand (small) */}
      <div className="flex items-center gap-1 text-yellow-400/60 text-sm font-bold">
        <span>♔</span>
        <span className="hidden sm:inline">ChessDuo</span>
      </div>

      {/* Right: Friends */}
      <button
        onClick={() => {
          if (playerId) {
            onFriends()
          } else {
            onProfile()
          }
        }}
        className="relative min-h-[44px] min-w-[44px] flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition-colors rounded-lg hover:bg-white/[0.05] px-2"
      >
        <span className="text-xl">{playerId ? '👥' : '🚪'}</span>
        <span className="text-sm hidden sm:inline">{playerId ? 'Friends' : 'Sign In'}</span>
        {unreadMessages > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </button>
    </div>
  )
}
