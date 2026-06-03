'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { Auth } from '@/components/Auth'
import { MatchmakingQueue } from '@/components/MatchmakingQueue'
import { SlideOver } from '@/components/SlideOver'
import { ProfilePanel } from '@/components/ProfilePanel'
import { FriendsPanel } from '@/components/FriendsPanel'
import { Room } from '@/lib/supabase'
import { getUnreadCounts, subscribeToMessages } from '@/lib/messages'
import { createOnlineRoom } from '@/lib/roomActions'
import { WelcomeDisclaimer } from '@/components/WelcomeDisclaimer'
import { GameTour } from '@/components/GameTour'
import { useSettings } from '@/lib/settings'

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
  const searchParams = useSearchParams()
  const [gameMode, setGameMode] = useState<GameMode>(null)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<number>(4)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [creatingTime, setCreatingTime] = useState<number | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [friendsOpen, setFriendsOpen] = useState(false)
  const [showAuthOverlay, setShowAuthOverlay] = useState(false)
  const [showOfflineDisclaimer, setShowOfflineDisclaimer] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chessduo_offline_disclaimer_dismissed') !== 'true'
    }
    return false
  })
  const [showOnlineDisclaimer, setShowOnlineDisclaimer] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chessduo_welcome_dismissed') !== 'true'
    }
    return false
  })
  const tourCompleted = typeof window !== 'undefined'
    && localStorage.getItem('chessduo_tour_completed') === 'true'
  const [showGameTour, setShowGameTour] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})
  const skillLevels = getAvailableSkillLevels()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        fetchUsername(session.user.id).then(setUsername)
      }
      setSessionChecked(true)
    }).catch(() => {
      setSessionChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername('')
        fetchUsername(session.user.id).then(setUsername)
      } else {
        setPlayerId(null)
        setUsername('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Push browser history entry when entering game mode selection screen
  // so mobile browser back button returns to home screen instead of exiting
  useEffect(() => {
    if (gameMode !== null) {
      window.history.pushState({ gameMode }, '', window.location.href)
    }

    const handlePopState = () => {
      if (gameMode !== null) {
        setSelectedTime(null)
        setGameMode(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [gameMode])

  useEffect(() => {
    const signupParam = searchParams.get('signup')
    const codeParam = searchParams.get('code')

    if (signupParam === '1' && sessionChecked) {
      setShowAuthOverlay(true)
    }

    if (codeParam && sessionChecked && playerId) {
      setJoinCode(codeParam)
      const doAutoJoin = async () => {
        setJoinLoading(true)
        const { data: room } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', codeParam)
          .eq('status', 'waiting')
          .single()

        if (room) {
          router.push(`/game?mode=online&room=${room.id}&code=${room.code}&team=WHITE&playerId=${playerId}&time=600`)
        } else {
          setJoinError('Room not found or already started')
        }
        setJoinLoading(false)
      }
      doAutoJoin()
    }
  }, [searchParams, sessionChecked, playerId, router])

  useEffect(() => {
    if (playerId) {
      const update = () => getUnreadCounts(playerId).then(({ total, bySender }) => {
        setUnreadMessages(total)
        setUnreadBySender(bySender)
      })
      update()
      const interval = setInterval(update, 10000)
      const unsub = subscribeToMessages(playerId, () => {
        getUnreadCounts(playerId).then(({ total, bySender }) => {
          setUnreadMessages(total)
          setUnreadBySender(bySender)
        })
      })
      return () => { clearInterval(interval); unsub() }
    }
  }, [playerId])

  const fetchUsername = async (userId: string): Promise<string> => {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()
    const { data: { session } } = await supabase.auth.getSession()
    if (data?.username) return data.username

    const name = session?.user?.email?.split('@')[0] || 'Player'
    try {
      await supabase.from('profiles').upsert({ id: userId, username: name }, { onConflict: 'id' })
    } catch {}
    return name
  }

  const handleAuthComplete = (userId: string, name: string) => {
    setPlayerId(userId)
    setUsername(name)
    setShowAuthOverlay(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setPlayerId(null)
    setUsername('')
    setProfileOpen(false)
    setFriendsOpen(false)
  }

  const handleJoinByCode = async () => {
    if (!playerId) { setShowAuthOverlay(true); return }
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
        setJoinLoading(false)
        return
      }

      if (room.status !== 'waiting') {
        setJoinError('Room is no longer available')
        setJoinLoading(false)
        return
      }

      const pid = playerId as string

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
        setJoinLoading(false)
        return
      }

      await supabase.from('room_players').upsert({
        room_id: room.id,
        player_id: pid,
        team,
        slot: 0,
        status: 'ready'
      }, { onConflict: 'room_id,player_id' })

      setJoinLoading(false)
      handleRoomJoined(room, team, pid)
    } catch {
      setJoinError('Something went wrong — try again')
      setJoinLoading(false)
    }
  }

  const handleRoomJoined = (room: Room, team: 'WHITE' | 'BLACK', playerId: string) => {
    const time = selectedTime || 600
    router.push(`/game?mode=online&room=${room.id}&code=${room.code}&team=${team}&playerId=${playerId}&time=${time}`)
  }

  const handleStartOnline = async (timeSeconds: number) => {
    if (!playerId) { setShowAuthOverlay(true); return }
    setCreatingTime(timeSeconds)
    setJoinError(null)
    try {
      const pid = playerId as string
      const result = await createOnlineRoom({ playerId: pid, timeSeconds })
      router.push(`/game?mode=online&room=${result.roomId}&code=${result.roomCode}&team=${result.team}&playerId=${result.playerId}&time=${result.time}`)
    } catch (err) {
      setCreatingTime(null)
      setJoinError(err instanceof Error ? err.message : 'Failed to create room')
    }
  }

  const handleStartOffline = () => {
    const time = selectedTime || 600
    router.push(`/game?level=${selectedLevel}&time=${time}`)
  }

  if (!sessionChecked) return null

  const showTopBar = !gameMode || (gameMode && selectedTime === null)

  const topBar = showTopBar && (
    <TopBar
      playerId={playerId}
      unreadMessages={unreadMessages}
      onProfile={() => setProfileOpen(true)}
      onFriends={() => setFriendsOpen(true)}
      onSignIn={() => setShowAuthOverlay(true)}
    />
  )

  const slideOvers = playerId && (
    <>
      <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
        <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); router.push('/history') }} onSignOut={handleSignOut} />
      </SlideOver>
      <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); getUnreadCounts(playerId!).then(({ total, bySender }) => { setUnreadMessages(total); setUnreadBySender(bySender) }) }} title="Friends">
        <FriendsPanel playerId={playerId} unreadBySender={unreadBySender} />
      </SlideOver>
    </>
  )

  const authOverlay = showAuthOverlay && (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => setShowAuthOverlay(false)}
          className="text-gray-600 dark:text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white text-sm transition-colors min-h-[44px] px-3"
        >
          {'\u2190'} Back
        </button>
      </div>
      <Auth onAuthComplete={handleAuthComplete} defaultSignup={searchParams.get('signup') === '1'} />
    </div>
  )

  // ============================================
  // Time selection screen
  // ============================================
  if (gameMode && selectedTime === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col">
        {topBar}
        
        {gameMode === 'online' && showOnlineDisclaimer && !showGameTour && (
          <WelcomeDisclaimer
            open={showOnlineDisclaimer}
            onDismiss={() => {
              setShowOnlineDisclaimer(false)
              if (!tourCompleted) {
                setShowGameTour(true)
              }
            }}
            mode="online"
          />
        )}
        {gameMode === 'online' && showGameTour && (
          <GameTour
            open={showGameTour}
            onComplete={() => {
              setShowGameTour(false)
              localStorage.setItem('chessduo_tour_completed', 'true')
            }}
            onSkip={() => {
              setShowGameTour(false)
              localStorage.setItem('chessduo_tour_completed', 'true')
            }}
          />
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-3">
              <div className="text-[36px] mb-1 drop-shadow-[0_0_16px_rgba(250,204,21,0.15)]">
                {gameMode === 'offline' ? '\u265E' : gameMode === 'online' ? '\u265B' : '\u26A1'}
              </div>
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">
                {gameMode === 'offline' ? 'OFFLINE' : gameMode === 'online' ? 'ONLINE' : 'QUICK MATCH'}
              </h1>
              <p className="text-[10px] text-gray-600 dark:text-gray-500 tracking-[0.15em] uppercase mt-0.5">Select game duration</p>
            </div>

            {gameMode === 'online' && (
              <div className="mb-4">
                <p className="text-[10px] text-gray-600 dark:text-gray-500 tracking-[0.15em] uppercase mb-2">Have a room code?</p>
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
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/8 bg-gray-100 dark:bg-white/[0.05] text-gray-900 dark:text-white text-base placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-yellow-500/40 focus:outline-none focus:bg-gray-200 dark:focus:bg-white/[0.08] disabled:opacity-40 transition-all"
                    style={{ minHeight: '44px' }}
                  />
                  <button
                    onClick={handleJoinByCode}
                    disabled={joinLoading || !joinCode.trim()}
                    className="px-5 py-3 rounded-xl bg-yellow-500/15 border border-yellow-500/25 text-yellow-600 dark:text-yellow-400 font-semibold text-sm hover:bg-yellow-500/25 active:bg-yellow-500/35 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    style={{ minHeight: '44px' }}
                  >
                    {joinLoading ? 'Joining...' : 'Join'}
                  </button>
                </div>
                {joinError && <p className="text-red-400 text-[11px] mt-1.5">{joinError}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {TIME_OPTIONS.map((option: TimeOption) => (
                <button
                  key={option.seconds}
                  onClick={() => {
                    if (gameMode === 'online') {
                      handleStartOnline(option.seconds)
                    } else {
                      setSelectedTime(option.seconds)
                    }
                  }}
                  disabled={creatingTime !== null}
                  className={`p-5 rounded-xl border transition-all duration-200 text-center ${
                    selectedTime === option.seconds
                      ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                      : 'border-gray-200 dark:border-white/8 bg-gray-100 dark:bg-white/[0.03] hover:border-gray-300 dark:hover:border-white/15 hover:bg-gray-200 dark:hover:bg-white/[0.05]'
                  } ${creatingTime !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {creatingTime === option.seconds ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-amber-600/80 dark:text-amber-400/80">Creating...</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-[28px] mb-1.5">{option.icon}</div>
                      <div className="text-lg font-bold mb-0.5">{option.label}</div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-500 dark:text-gray-400">{option.description}</div>
                    </>
                  )}
                </button>
              ))}
            </div>

            <div className="text-center mb-4">
              <p className="text-[10px] text-gray-600">Game ends when time runs out. Winner decided by board advantage.</p>
            </div>

            <div className="text-center mt-4">
              <button onClick={() => setGameMode(null)} className="text-gray-600 dark:text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white text-sm transition-colors min-h-[44px] px-4 py-2">
                {'\u2190'} Back to game mode
              </button>
            </div>
          </div>
        </div>
        {slideOvers}
        {authOverlay}
      </div>
    )
  }

  // ============================================
  // Home screen — game mode selection
  // ============================================
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col relative overflow-hidden">
        {topBar}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-[340px] leading-none opacity-[0.025] text-yellow-600 dark:text-yellow-400 select-none pointer-events-none">
          {"\u265E"}
        </div>
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 44px, rgba(255,255,255,0.4) 44px, rgba(255,255,255,0.4) 45px),
                              repeating-linear-gradient(90deg, transparent, transparent 44px, rgba(255,255,255,0.4) 44px, rgba(255,255,255,0.4) 45px)`
          }}
        />
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.05) 0%, transparent 70%)' }}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full relative z-10 px-4">
            <div className="text-center mb-6">
              <div className="text-[42px] mb-1 drop-shadow-[0_0_20px_rgba(250,204,21,0.2)]">{"\u2654"}</div>
              <h1 className="text-[30px] font-black text-yellow-600 dark:text-yellow-400 tracking-wider">ChessDuo</h1>
              <p className="text-[9px] text-gray-600 dark:text-gray-500 tracking-[0.2em] uppercase mt-0.5">Play Smarter, Together</p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-500 dark:text-gray-400 text-center font-medium mb-4">Choose your game mode</p>
            <div className="flex flex-col gap-3 mb-5">
              <ModeButton icon={'\u265B'} title="Play Together" desc="with a friend" onClick={() => setGameMode('online')} highlight />
              <ModeButton icon={'\u265E'} title="Play Offline" desc="vs Bot teammate" onClick={() => setGameMode('offline')} />
              <ModeButton icon={'\u26A1'} title="Quick Match" desc="auto-find teammate" onClick={() => setGameMode('quickmatch')} />
            </div>
            <div className="text-center mb-5">
              <div className="flex items-center justify-center gap-2 text-2xl opacity-[0.12] text-yellow-600 dark:text-yellow-400">
                <span>{"\u2654"}</span>
                <span className="text-[10px] text-gray-600">vs</span>
                <span className="text-gray-600 dark:text-gray-500">{"\u265A"}</span>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">White team — You + Teammate (2v2 vs Black bots)</p>
            </div>
            <div className="flex justify-center gap-5 text-[11px]">
              <button onClick={() => router.push('/history')} className="text-gray-600 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors">
                {"\uD83D\uDCCB"} History
              </button>
              <button onClick={() => router.push('/premium')} className="text-yellow-600 dark:text-yellow-400 hover:brightness-110 transition-all">
                {"\u2728"} Premium
              </button>
              {!playerId && (
                <button onClick={() => setShowAuthOverlay(true)} className="text-gray-600 dark:text-gray-500 hover:text-red-400 transition-colors">
                  {"\uD83D\uDEAA"} Sign In
                </button>
              )}
            </div>
          </div>
        </div>
        {slideOvers}
        {authOverlay}
      </div>
    )
  }

  // ============================================
  // Offline mode — skill level selection
  // ============================================
  if (gameMode === 'offline') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col">
        {topBar}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-[36px] mb-1 drop-shadow-[0_0_16px_rgba(250,204,21,0.15)]">{"\u265E"}</div>
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">OFFLINE</h1>
              <p className="text-[10px] text-gray-600 dark:text-gray-500 tracking-[0.15em] uppercase mt-0.5">Select opponent skill level</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {skillLevels.map((level: SkillLevel) => (
                <button
                  key={level.level}
                  onClick={() => setSelectedLevel(level.level)}
                  className={`p-5 rounded-xl border transition-all duration-200 text-center ${
                    selectedLevel === level.level
                      ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                      : 'border-gray-200 dark:border-white/8 bg-gray-100 dark:bg-white/[0.03] hover:border-gray-300 dark:hover:border-white/15 hover:bg-gray-200 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-base font-bold mb-1">{level.label}</div>
                  <div className="text-[11px] text-gray-600 dark:text-gray-500 dark:text-gray-400">{level.description}</div>
                </button>
              ))}
            </div>
            <div className="text-center mb-4">
              <button type="button" onClick={() => setShowOfflineDisclaimer(true)} className="text-[10px] text-gray-600 dark:text-gray-500 hover:text-gray-600 dark:text-gray-500 dark:text-gray-400 transition-colors underline">
                How to play?
              </button>
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
              <button onClick={() => setSelectedTime(null)} className="text-gray-600 dark:text-gray-500 hover:text-gray-600 dark:text-gray-500 dark:text-gray-400 text-sm transition-colors">
                {"\u2190"} Back to time
              </button>
            </div>
          </div>
        </div>
        {slideOvers}
        {authOverlay}
        {showOfflineDisclaimer && (
          <WelcomeDisclaimer
            open={showOfflineDisclaimer}
            onDismiss={() => setShowOfflineDisclaimer(false)}
            storageKey="chessduo_offline_disclaimer_dismissed"
            mode="offline"
          />
        )}
      </div>
    )
  }

  // ============================================
  // Online mode — auto-creates room from time selection
  // This code path is a fallback if selectedTime is somehow set
  // ============================================
  if (gameMode === 'online') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white">
          {topBar}
          <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setSelectedTime(null)} className="text-gray-600 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 text-sm transition-colors">
              {"\u2190"} Back
            </button>
          </div>
          <Auth onAuthComplete={handleAuthComplete} />
        </div>
      )
    }

    // Auto-create room and navigate to game
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center">
        {topBar}
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-amber-600 dark:text-amber-400 text-sm">Creating room...</p>
        </div>
        {slideOvers}
        {authOverlay}
      </div>
    )
  }

  // ============================================
  // Quick Match mode
  // ============================================
  if (gameMode === 'quickmatch') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white">
          {topBar}
          <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setSelectedTime(null)} className="text-gray-600 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 text-sm transition-colors">
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
        timeSeconds={selectedTime || 600}
        onRoomJoined={handleRoomJoined}
        onCancel={() => setGameMode(null)}
      />
    )
  }

  return null
}

// ============================================
// Mode Button Component
// ============================================
function ModeButton({ icon, title, desc, onClick, highlight }: {
  icon: string; title: string; desc: string; onClick: () => void; highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3.5 p-[18px] rounded-2xl border transition-all duration-200 text-left group ${
        highlight
          ? 'border-yellow-500/15 bg-yellow-500/[0.03] hover:border-yellow-500/40 hover:bg-yellow-500/[0.06]'
          : 'border-gray-200 dark:border-white/8 bg-gray-100 dark:bg-white/[0.04] hover:border-yellow-500/30 hover:bg-yellow-500/[0.04]'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-[28px] ${
        highlight ? 'bg-yellow-500/10 border border-yellow-500/20 drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]' : 'bg-yellow-500/8 border border-yellow-500/12 drop-shadow-[0_0_8px_rgba(250,204,21,0.15)]'
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className={`font-bold text-[15px] ${highlight ? 'text-yellow-600 dark:text-yellow-400 group-hover:brightness-110' : 'text-gray-700 dark:text-gray-100 group-hover:text-yellow-600 dark:group-hover:text-yellow-400'} transition-all`}>
          {title}
        </div>
        <div className="text-[11px] text-gray-600 dark:text-gray-500 mt-0.5">{desc}</div>
      </div>
      <span className="text-base text-yellow-600 dark:text-yellow-400 opacity-30 group-hover:opacity-60 transition-opacity">{"\u25B8"}</span>
    </button>
  )
}

// ============================================
// Top Bar Component
// ============================================
function TopBar({
  playerId, unreadMessages, onProfile, onFriends, onSignIn,
}: {
  playerId: string | null
  unreadMessages: number
  onProfile: () => void
  onFriends: () => void
  onSignIn: () => void
}) {
  const { theme, setTheme } = useSettings()
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#0f1119]/80 backdrop-blur-md border-b border-white/5">
      <button
        onClick={() => playerId ? onProfile() : onSignIn()}
        className="min-h-[44px] min-w-[44px] flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors rounded-lg hover:bg-white/[0.05] px-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        <span className="text-sm">{playerId ? 'Profile' : 'Sign In'}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/10 rounded-full p-1 border border-gray-200 dark:border-white/[0.08] transition-colors"
          aria-label="Toggle theme"
        >
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full transition-all ${theme !== 'dark' ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500'}`}>
            Light
          </span>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full transition-all ${theme === 'dark' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400'}`}>
            Dark
          </span>
        </button>
        <div className="flex items-center gap-1 text-yellow-400/60 text-sm font-bold">
          <span>♔</span>
          <span className="hidden sm:inline">ChessDuo</span>
        </div>
      </div>

      {playerId ? (
        <button
          onClick={onFriends}
          className="relative min-h-[44px] min-w-[44px] flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-yellow-400 transition-colors rounded-lg hover:bg-white/[0.05] px-2"
        >
          <span className="text-xl">👥</span>
          <span className="text-sm hidden sm:inline">Friends</span>
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-gray-900 dark:text-white text-[10px] font-bold rounded-full px-1">
              {unreadMessages > 99 ? '99+' : unreadMessages}
            </span>
          )}
        </button>
      ) : (
        <div className="min-w-[44px]" />
      )}
    </div>
  )
}
