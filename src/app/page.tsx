'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { SlideOver } from '@/components/SlideOver'
import { ProfilePanel } from '@/components/ProfilePanel'
import { FriendsPanel } from '@/components/FriendsPanel'
import { Room } from '@/lib/supabase'
import { getUnreadCounts, subscribeToMessages } from '@/lib/messages'
import { createOnlineRoom } from '@/lib/roomActions'
import { createFourPlayerRoom, joinFourPlayerByCode } from '@/lib/fourPlayerActions'
import { createChallenge, getChallengeUrl } from '@/lib/challenges'
import { WelcomeDisclaimer } from '@/components/WelcomeDisclaimer'
import { GameTour } from '@/components/GameTour'
import { useSettings } from '@/lib/settings'
import { DEFAULT_TEAM_TIMER_SECONDS } from '@/features/shared/gameConstants'

export const dynamic = 'force-dynamic'

type GameMode = 'offline' | 'online' | 'fourplayer' | 'duel' | null

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
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string } | null>(null)
  const redirectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } }) => {
      const session = result.data.session
      if (session?.user) {
        setPlayerId(session.user.id)
        fetchUsername(session.user.id).then(name => {
          if (name) {
            setUsername(name)
          } else {
            const suggested = session.user.email?.split('@')[0] || 'player'
            setNeedsUsername({ userId: session.user.id, suggestedName: suggested })
          }
        })
      }
      setSessionChecked(true)
    }).catch(() => {
      setSessionChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername('')
        fetchUsername(session.user.id).then(name => {
          if (name) {
            setUsername(name)
          } else {
            const suggested = session.user.email?.split('@')[0] || 'player'
            setNeedsUsername({ userId: session.user.id, suggestedName: suggested })
          }
        })
      } else {
        setPlayerId(null)
        setUsername('')
        setNeedsUsername(null)
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
        setJoinCode('')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [gameMode])

  useEffect(() => {
    const signupParam = searchParams.get('signup')
    const codeParam = searchParams.get('code')
    const redirectParam = searchParams.get('redirect')

    if (redirectParam) {
      redirectUrlRef.current = redirectParam
    }

    if (signupParam === '1' && sessionChecked) {
      setShowAuthOverlay(true)
    }

    if (codeParam && sessionChecked && playerId) {
      setJoinCode(codeParam)
      const doAutoJoin = async () => {
        setJoinLoading(true)

        let room = null
        const { data: byCode } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', codeParam)
          .eq('status', 'waiting')
          .maybeSingle()
        if (byCode) {
          room = byCode
        } else {
          const { data: byId } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', codeParam)
            .eq('status', 'waiting')
            .maybeSingle()
          if (byId) {
            room = byId
          }
        }

        if (room) {
          const roomTime = room.time_seconds || 600
          if (room.mode === 'fourplayer') {
            router.push(`/four-player?room=${room.id}&code=${room.code}&playerId=${playerId}&time=${roomTime}`)
          } else {
            router.push(`/game?mode=online&room=${room.id}&code=${room.code}&team=WHITE&playerId=${playerId}&time=${roomTime}`)
          }
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
    if (data?.username) return data.username
    return ''
  }

  const handleAuthComplete = (userId: string, name: string) => {
    setPlayerId(userId)
    setUsername(name)
    setShowAuthOverlay(false)
    if (redirectUrlRef.current) {
      const url = redirectUrlRef.current
      redirectUrlRef.current = null
      router.replace(url)
    }
  }

  const handleNeedUsername = (userId: string, suggestedName: string) => {
    setNeedsUsername({ userId, suggestedName })
    setShowAuthOverlay(false)
  }

  const handleUsernameChosen = (userId: string, name: string) => {
    setNeedsUsername(null)
    setPlayerId(userId)
    setUsername(name)
    if (redirectUrlRef.current) {
      const url = redirectUrlRef.current
      redirectUrlRef.current = null
      router.replace(url)
    }
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
      let room = null
      const { data: byCode } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .maybeSingle()
      if (byCode) {
        room = byCode
      } else {
        const { data: byId } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', code)
          .maybeSingle()
        if (byId) {
          room = byId
        }
      }

      if (!room) {
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
    setJoinCode('')
    const time = selectedTime || DEFAULT_TEAM_TIMER_SECONDS
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
    const time = selectedTime || DEFAULT_TEAM_TIMER_SECONDS
    router.push(`/game?level=${selectedLevel}&time=${time}`)
  }

  const handleStartFourPlayer = async (timeSeconds: number) => {
    if (!playerId) { setShowAuthOverlay(true); return }
    setCreatingTime(timeSeconds)
    setJoinError(null)
    try {
      const pid = playerId as string
      const result = await createFourPlayerRoom({ playerId: pid, timeSeconds })
      router.push(`/four-player?room=${result.roomId}&code=${result.roomCode}&playerId=${pid}&time=${result.timeSeconds}`)
    } catch (err) {
      setCreatingTime(null)
      setJoinError(err instanceof Error ? err.message : 'Failed to create room')
    }
  }

  const handleJoinFourPlayerByCode = async () => {
    if (!playerId) { setShowAuthOverlay(true); return }
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinLoading(true)
    setJoinError(null)
    try {
      const result = await joinFourPlayerByCode({ code, playerId })
      if (!result) {
        setJoinError('Room not found — check the code')
        setJoinLoading(false)
        return
      }
      setJoinCode('')
      router.push(`/four-player?room=${result.roomId}&code=${result.roomCode}&playerId=${playerId}&time=${result.timeSeconds}`)
    } catch {
      setJoinError('Something went wrong — try again')
      setJoinLoading(false)
    }
  }

  const handleStartDuel = async (timeSeconds: number) => {
    if (!playerId) { setShowAuthOverlay(true); return }
    setCreatingTime(timeSeconds)
    setJoinError(null)
    try {
      const pid = playerId as string
      const { data, roomId, roomCode, error } = await createChallenge(pid, 'online', timeSeconds)
      if (error) throw new Error(error)
      if (roomId && roomCode) {
        router.push(`/duel?room=${roomId}&code=${roomCode}&team=WHITE&playerId=${pid}&time=${timeSeconds}`)
      } else {
        throw new Error('Failed to create challenge')
      }
    } catch (err) {
      setCreatingTime(null)
      setJoinError(err instanceof Error ? err.message : 'Failed to create challenge')
    }
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
      <Auth
        onAuthComplete={handleAuthComplete}
        defaultSignup={searchParams.get('signup') === '1'}
        redirectUrl={redirectUrlRef.current || undefined}
        onNeedUsername={handleNeedUsername}
      />
    </div>
  )

  const chooseUsernameScreen = needsUsername && (
    <ChooseUsername
      userId={needsUsername.userId}
      suggestedName={needsUsername.suggestedName}
      onAuthComplete={handleUsernameChosen}
    />
  )

  if (chooseUsernameScreen) return chooseUsernameScreen

  // ============================================
  // Time selection screen
  // ============================================
  if (gameMode && selectedTime === null) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col">
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
                {gameMode === 'offline' ? '\u265E' : gameMode === 'online' ? '\u265B\u265B' : gameMode === 'fourplayer' ? '\u265B\u265C' : '\u2694'}
              </div>
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">
                {gameMode === 'offline' ? 'OFFLINE' : gameMode === 'online' ? 'TWO PLAYER' : gameMode === 'fourplayer' ? 'FOUR PLAYER' : '1v1 DUEL'}
              </h1>
              <p className="text-[11px] text-gray-700 dark:text-gray-400 tracking-[0.15em] uppercase mt-0.5 font-medium">Select game duration</p>
            </div>

            {gameMode === 'online' && (
              <div className="mb-4">
                <p className="text-[11px] text-gray-800 dark:text-gray-400 tracking-[0.15em] uppercase mb-2 font-semibold">Have a room code?</p>
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
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-white/8 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-base placeholder:text-gray-500 dark:placeholder:text-gray-600 focus:border-yellow-500 focus:outline-none focus:bg-white dark:focus:bg-white/[0.08] disabled:opacity-40 transition-all"
                    style={{ minHeight: '44px' }}
                  />
                  <button
                    onClick={handleJoinByCode}
                    disabled={joinLoading || !joinCode.trim()}
                    className="px-5 py-3 rounded-xl bg-yellow-100 dark:bg-yellow-500/15 border-2 border-yellow-400 dark:border-yellow-500/25 text-yellow-800 dark:text-yellow-400 font-semibold text-sm hover:bg-yellow-200 dark:hover:bg-yellow-500/25 active:bg-yellow-300 dark:active:bg-yellow-500/35 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    style={{ minHeight: '44px' }}
                  >
                    {joinLoading ? 'Joining...' : 'Join'}
                  </button>
                </div>
                {joinError && <p className="text-red-600 dark:text-red-400 text-[11px] mt-1.5 font-medium">{joinError}</p>}
              </div>
            )}

            {gameMode === 'fourplayer' && (
              <div className="mb-4">
                <p className="text-[11px] text-gray-800 dark:text-gray-400 tracking-[0.15em] uppercase mb-2 font-semibold">Have a room code?</p>
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
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-white/8 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-base placeholder:text-gray-500 dark:placeholder:text-gray-600 focus:border-blue-500 focus:outline-none focus:bg-white dark:focus:bg-white/[0.08] disabled:opacity-40 transition-all"
                    style={{ minHeight: '44px' }}
                  />
                  <button
                    onClick={handleJoinFourPlayerByCode}
                    disabled={joinLoading || !joinCode.trim()}
                    className="px-5 py-3 rounded-xl bg-blue-100 dark:bg-blue-500/15 border-2 border-blue-400 dark:border-blue-500/25 text-blue-800 dark:text-blue-400 font-semibold text-sm hover:bg-blue-200 dark:hover:bg-blue-500/25 active:bg-blue-300 dark:active:bg-blue-500/35 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    style={{ minHeight: '44px' }}
                  >
                    {joinLoading ? 'Joining...' : 'Join'}
                  </button>
                </div>
                {joinError && <p className="text-red-600 dark:text-red-400 text-[11px] mt-1.5 font-medium">{joinError}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {TIME_OPTIONS.map((option: TimeOption) => (
                <button
                  key={option.seconds}
                  onClick={() => {
                    if (gameMode === 'online') {
                      handleStartOnline(option.seconds)
                    } else if (gameMode === 'fourplayer') {
                      handleStartFourPlayer(option.seconds)
                    } else if (gameMode === 'duel') {
                      handleStartDuel(option.seconds)
                    } else {
                      setSelectedTime(option.seconds)
                    }
                  }}
                  disabled={creatingTime !== null}
                  className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                    selectedTime === option.seconds
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                      : 'border-gray-300 dark:border-white/8 bg-gray-50 dark:bg-white/[0.03] hover:border-gray-400 dark:hover:border-white/15 hover:bg-gray-100 dark:hover:bg-white/[0.05]'
                  } ${creatingTime !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {creatingTime === option.seconds ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Creating...</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-[28px] mb-1.5">{option.icon}</div>
                      <div className="text-lg font-bold mb-0.5 text-gray-900 dark:text-white">{option.label}</div>
                      <div className="text-[11px] text-gray-700 dark:text-gray-400 font-medium">{option.description}</div>
                    </>
                  )}
                </button>
              ))}
            </div>

            <div className="text-center mb-4">
              <p className="text-[11px] text-gray-700 dark:text-gray-400 font-medium">Game ends when time runs out. Winner decided by board advantage.</p>
            </div>

            <div className="text-center mt-4">
              <button onClick={() => setGameMode(null)} className="text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:text-white text-sm transition-colors min-h-[44px] px-4 py-2 font-medium">
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
  // Home screen — Hero + Play Together + More Modes
  // ============================================
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col relative overflow-hidden">
        {topBar}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 text-[340px] leading-none opacity-[0.03] dark:opacity-[0.025] text-yellow-600 dark:text-yellow-400 select-none pointer-events-none">
          {"\u265E"}
        </div>
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 44px, rgba(0,0,0,0.08) 44px, rgba(0,0,0,0.08) 45px),
                              repeating-linear-gradient(90deg, transparent, transparent 44px, rgba(0,0,0,0.08) 44px, rgba(0,0,0,0.08) 45px)`
          }}
        />
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.08) 0%, transparent 70%)' }}
        />
        <div className="flex-1 flex flex-col items-center justify-start pt-8 pb-8">
          <div className="max-w-md w-full relative z-10 px-4">
            <div className="text-center mb-8">
              <div className="text-[48px] mb-2 drop-shadow-[0_0_20px_rgba(250,204,21,0.3)] flex items-center justify-center gap-3">
                <span className="text-yellow-600 dark:text-yellow-400">{"\u2654"}</span>
                <span className="text-[36px] opacity-70 dark:opacity-60 text-gray-800 dark:text-white">{"\u265A"}</span>
              </div>
              <h1 className="text-[34px] font-black text-yellow-600 dark:text-yellow-400 tracking-wider">ChessDuo</h1>
              <p className="text-[12px] text-gray-700 dark:text-gray-400 tracking-[0.25em] uppercase mt-1 font-semibold">Multiplayer Tag Team Chess</p>
            </div>

            <div className="mb-8">
              <div className="text-[11px] font-bold text-gray-800 dark:text-gray-400 tracking-[0.2em] uppercase mb-3 px-1">
                Play Together
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ModeCard
                  icon={"\u265B\u265B"}
                  title="Two Player"
                  desc="You + Friend vs Bots"
                  tag="Online"
                  tagColor="blue"
                  onClick={() => { if (!playerId) { setShowAuthOverlay(true); return } setGameMode('online') }}
                />
                <ModeCard
                  icon={"\u265B\u265C"}
                  title="Four Player"
                  desc="2 Friends vs 2 Friends"
                  tag="Online Lobby"
                  tagColor="blue"
                  onClick={() => { if (!playerId) { setShowAuthOverlay(true); return } setGameMode('fourplayer') }}
                />
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[11px] font-bold text-gray-800 dark:text-gray-400 tracking-[0.2em] uppercase mb-3 px-1">
                More Modes
              </div>
              <div className="flex flex-col gap-3">
                <ModeButton icon={"\u265E"} title="Offline Tag Team" desc="You + Bot vs Bots" onClick={() => { if (!playerId) { setShowAuthOverlay(true); return } setGameMode('offline') }} />
                <ModeButton icon={"\u2694"} title="1v1 Duel" desc="Challenge a Friend" onClick={() => { if (!playerId) { setShowAuthOverlay(true); return } setGameMode('duel') }} />
              </div>
            </div>

            <div className="flex justify-center gap-6 text-[11px] pt-4 border-t border-gray-300 dark:border-white/10">
              <button onClick={() => router.push('/history')} className="text-gray-700 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors min-h-[44px] flex items-center gap-1 font-medium">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                History
              </button>
              <button onClick={() => router.push('/premium')} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 transition-all min-h-[44px] flex items-center gap-1 font-semibold">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Premium
              </button>
              {!playerId && (
                <button onClick={() => setShowAuthOverlay(true)} className="text-gray-700 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-h-[44px] flex items-center gap-1 font-medium">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  Sign In
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
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col">
        {topBar}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-[36px] mb-1 drop-shadow-[0_0_16px_rgba(250,204,21,0.15)]">{"\u265E"}</div>
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">OFFLINE</h1>
              <p className="text-[11px] text-gray-700 dark:text-gray-400 tracking-[0.15em] uppercase mt-0.5 font-medium">Select opponent skill level</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {skillLevels.map((level: SkillLevel) => (
                <button
                  key={level.level}
                  onClick={() => setSelectedLevel(level.level)}
                  className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                    selectedLevel === level.level
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.1)]'
                      : 'border-gray-300 dark:border-white/8 bg-gray-50 dark:bg-white/[0.03] hover:border-gray-400 dark:hover:border-white/15 hover:bg-gray-100 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="text-base font-bold mb-1 text-gray-900 dark:text-white">{level.label}</div>
                  <div className="text-[11px] text-gray-700 dark:text-gray-400 font-medium">{level.description}</div>
                </button>
              ))}
            </div>
            <div className="text-center mb-4">
              <button type="button" onClick={() => setShowOfflineDisclaimer(true)} className="text-[11px] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors underline font-medium">
                How to play?
              </button>
            </div>
            <div className="text-center">
              <button
                onClick={handleStartOffline}
                className="px-10 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-xl text-base transition-colors shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.15)]"
              >
                Start Game
              </button>
            </div>
            <div className="mt-8 text-center">
              <button onClick={() => setSelectedTime(null)} className="text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors font-medium min-h-[44px] px-4 py-2">
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
  // Four Player mode — create lobby for 2v2 humans
  // ============================================
  if (gameMode === 'fourplayer') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white">
          {topBar}
          <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setGameMode(null)} className="text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors font-medium min-h-[44px] px-3">
              {"\u2190"} Back
            </button>
          </div>
          <Auth onAuthComplete={handleAuthComplete} />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col">
        {topBar}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-[42px] mb-2">{"\u265B\u265C"}</div>
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">Four Player</h1>
              <p className="text-[12px] text-gray-700 dark:text-gray-400 mt-1 font-medium">2 Friends vs 2 Friends</p>
            </div>

            <div className="bg-blue-50 dark:bg-white/[0.04] border-2 border-blue-200 dark:border-white/10 rounded-2xl p-6 mb-6">
              <div className="text-center mb-4">
                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-400 tracking-[0.15em] uppercase">How it works</div>
              </div>
              <div className="space-y-3 text-sm text-gray-800 dark:text-gray-300 font-medium">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Create a room and get a shareable code</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Share the code with 3 friends</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>All 4 players join and pick teams</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                  <span>Game starts when all seats are filled</span>
                </div>
              </div>
            </div>

            <div className="text-center mb-4">
              <p className="text-[11px] text-gray-800 dark:text-gray-400 tracking-[0.15em] uppercase mb-2 font-semibold">Select game duration</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.seconds}
                  onClick={() => handleStartFourPlayer(option.seconds)}
                  disabled={creatingTime !== null}
                  className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                    'border-gray-300 dark:border-white/8 bg-gray-50 dark:bg-white/[0.03] hover:border-blue-400 dark:hover:border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-500/[0.05] hover:shadow-md'
                  } ${creatingTime !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {creatingTime === option.seconds ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Creating...</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-[28px] mb-1.5">{option.icon}</div>
                      <div className="text-lg font-bold mb-0.5 text-gray-900 dark:text-white">{option.label}</div>
                      <div className="text-[11px] text-gray-700 dark:text-gray-400 font-medium">{option.description}</div>
                    </>
                  )}
                </button>
              ))}
            </div>

            {joinError && (
              <div className="mb-4 p-3 rounded-xl bg-red-100 dark:bg-red-500/10 border-2 border-red-300 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm text-center font-medium">
                {joinError}
              </div>
            )}

            <div className="text-center">
              <button onClick={() => setGameMode(null)} className="text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors min-h-[44px] px-4 py-2 font-medium">
                {"\u2190"} Back to home
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
  // Duel mode — 1v1 challenge a friend
  // ============================================
  if (gameMode === 'duel') {
    if (!playerId) {
      return (
        <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white">
          {topBar}
          <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setGameMode(null)} className="text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors font-medium min-h-[44px] px-3">
              {"\u2190"} Back
            </button>
          </div>
          <Auth onAuthComplete={handleAuthComplete} />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col">
        {topBar}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-[42px] mb-2">{"\u2694"}</div>
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">1v1 Duel</h1>
              <p className="text-[12px] text-gray-700 dark:text-gray-400 mt-1 font-medium">Challenge a Friend</p>
            </div>

            <div className="bg-pink-50 dark:bg-white/[0.04] border-2 border-pink-200 dark:border-white/10 rounded-2xl p-6 mb-6">
              <div className="text-center mb-4">
                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-400 tracking-[0.15em] uppercase">How it works</div>
              </div>
              <div className="space-y-3 text-sm text-gray-800 dark:text-gray-300 font-medium">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-pink-200 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Pick a time limit and create a challenge</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-pink-200 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Share the challenge link with your friend</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-pink-200 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Game starts when they accept</span>
                </div>
              </div>
            </div>

            <div className="text-center mb-4">
              <p className="text-[11px] text-gray-800 dark:text-gray-400 tracking-[0.15em] uppercase mb-2 font-semibold">Select game duration</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.seconds}
                  onClick={() => handleStartDuel(option.seconds)}
                  disabled={creatingTime !== null}
                  className={`p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                    'border-gray-300 dark:border-white/8 bg-gray-50 dark:bg-white/[0.03] hover:border-pink-400 dark:hover:border-pink-500/40 hover:bg-pink-50 dark:hover:bg-pink-500/[0.05] hover:shadow-md'
                  } ${creatingTime !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {creatingTime === option.seconds ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-pink-600 dark:text-pink-400 font-medium">Creating...</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-[28px] mb-1.5">{option.icon}</div>
                      <div className="text-lg font-bold mb-0.5 text-gray-900 dark:text-white">{option.label}</div>
                      <div className="text-[11px] text-gray-700 dark:text-gray-400 font-medium">{option.description}</div>
                    </>
                  )}
                </button>
              ))}
            </div>

            {joinError && (
              <div className="mb-4 p-3 rounded-xl bg-red-100 dark:bg-red-500/10 border-2 border-red-300 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm text-center font-medium">
                {joinError}
              </div>
            )}

            <div className="text-center">
              <button onClick={() => setGameMode(null)} className="text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors min-h-[44px] px-4 py-2 font-medium">
                {"\u2190"} Back to home
              </button>
            </div>
          </div>
        </div>
        {slideOvers}
        {authOverlay}
      </div>
    )
  }

  return null
}

// ============================================
// Mode Card Component (for Play Together section)
// ============================================
function ModeCard({ icon, title, desc, tag, tagColor, onClick }: {
  icon: string; title: string; desc: string; tag: string; tagColor: 'blue' | 'green' | 'pink'; onClick: () => void
}) {
  const tagStyles = {
    blue: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    green: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
    pink: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-500/20',
  }
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-blue-200 dark:border-blue-500/20 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900/20 hover:border-blue-400 dark:hover:border-blue-500/40 hover:shadow-md dark:hover:shadow-blue-500/10 transition-all duration-200 group"
    >
      <div className="text-[28px] mb-1 drop-shadow-[0_0_8px_rgba(59,130,246,0.2)] dark:drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]">
        {icon}
      </div>
      <div className="text-center">
        <div className="font-bold text-[14px] text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </div>
        <div className="text-[11px] text-gray-700 dark:text-gray-400 mt-0.5 font-medium">{desc}</div>
      </div>
      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${tagStyles[tagColor]}`}>
        {tag}
      </span>
    </button>
  )
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
      className={`flex items-center gap-3.5 p-[18px] rounded-2xl border-2 transition-all duration-200 text-left group ${
        highlight
          ? 'border-yellow-300 dark:border-yellow-500/15 bg-yellow-50 dark:bg-yellow-500/[0.03] hover:border-yellow-400 dark:hover:border-yellow-500/40 hover:bg-yellow-100 dark:hover:bg-yellow-500/[0.06] hover:shadow-md'
          : 'border-gray-200 dark:border-white/8 bg-white dark:bg-white/[0.04] hover:border-yellow-400 dark:hover:border-yellow-500/30 hover:bg-yellow-50 dark:hover:bg-yellow-500/[0.04] hover:shadow-md dark:hover:shadow-yellow-500/5'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-[28px] ${
        highlight ? 'bg-yellow-200 dark:bg-yellow-500/10 border-2 border-yellow-300 dark:border-yellow-500/20 drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]' : 'bg-yellow-100 dark:bg-yellow-500/8 border-2 border-yellow-200 dark:border-yellow-500/12 drop-shadow-[0_0_8px_rgba(250,204,21,0.15)]'
      }`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className={`font-bold text-[15px] ${highlight ? 'text-yellow-700 dark:text-yellow-400 group-hover:text-yellow-800 dark:group-hover:brightness-110' : 'text-gray-900 dark:text-gray-100 group-hover:text-yellow-700 dark:group-hover:text-yellow-400'} transition-all`}>
          {title}
        </div>
        <div className="text-[11px] text-gray-700 dark:text-gray-400 mt-0.5 font-medium">{desc}</div>
      </div>
      <span className="text-base text-yellow-600 dark:text-yellow-400 opacity-40 dark:opacity-30 group-hover:opacity-70 dark:group-hover:opacity-60 transition-opacity">{"\u25B8"}</span>
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
    <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-2 bg-white/95 dark:bg-[#0f1119]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
      <button
        onClick={() => playerId ? onProfile() : onSignIn()}
        className="min-h-[44px] min-w-[44px] flex items-center gap-2 text-gray-800 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.05] px-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        <span className="text-sm font-medium">{playerId ? 'Profile' : 'Sign In'}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/10 rounded-full p-1 border border-gray-300 dark:border-white/[0.08] transition-colors"
          aria-label="Toggle theme"
        >
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full transition-all ${theme !== 'dark' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-500'}`}>
            Light
          </span>
          <span className={`text-[11px] font-semibold px-2 py-1 rounded-full transition-all ${theme === 'dark' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500'}`}>
            Dark
          </span>
        </button>
        <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400/60 text-sm font-bold">
          <span>♔</span>
          <span className="hidden sm:inline">ChessDuo</span>
        </div>
      </div>

      {playerId ? (
        <button
          onClick={onFriends}
          className="relative min-h-[44px] min-w-[44px] flex items-center gap-2 text-gray-800 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.05] px-2"
        >
          <span className="text-xl">👥</span>
          <span className="text-sm hidden sm:inline font-medium">Friends</span>
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full px-1">
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
