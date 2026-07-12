'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { getFriendsList, FriendWithProfile } from '@/lib/friends'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { SlideOver } from '@/components/SlideOver'
import { ProfilePanel } from '@/components/ProfilePanel'
import { FriendsPanel } from '@/components/FriendsPanel'
import { Room } from '@/lib/supabase'
import { getUnreadCounts, subscribeToMessages, sendMessage } from '@/lib/messages'
import { createOnlineRoom } from '@/lib/roomActions'
import { createFourPlayerRoom, joinFourPlayerByCode } from '@/lib/fourPlayerActions'
import { createChallenge, getChallengeUrl } from '@/lib/challenges'
import { WelcomeDisclaimer } from '@/components/WelcomeDisclaimer'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Swords, Crown, ChevronRight, Play, History, Users, User, Home as HomeIcon } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { DEFAULT_TEAM_TIMER_SECONDS } from '@/features/shared/gameConstants'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

export const dynamic = 'force-dynamic'

type GameMode = 'offline' | 'online' | 'fourplayer' | 'duel' | null
type SelectedGameMode = 'quick' | 'duo' | 'four' | null

interface TimeOption {
  seconds: number
  label: string
}

const TIME_OPTIONS: TimeOption[] = [
  { seconds: 180, label: '3 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
  { seconds: 900, label: '15 min' },
  { seconds: 1800, label: '30 min' },
]

const DIFFICULTY_LEVELS = [
  { level: 1, label: 'Beginner', icon: '♟' },
  { level: 2, label: 'Novice', icon: '♞' },
  { level: 3, label: 'Intermediate', icon: '♝' },
  { level: 4, label: 'Advanced', icon: '♜' },
  { level: 5, label: 'Expert', icon: '♛' },
  { level: 6, label: 'Master', icon: '♚' },
]

type HumanAvatar = 'ace' | 'nova' | 'rex' | 'zee' | 'blaze' | 'pixel' | 'kai'
type TeamIcon = { type: 'human'; avatar: HumanAvatar; size?: 'normal' | 'small' } | { type: 'bot'; size?: 'normal' | 'small' }

const HUMAN_AVATARS: Record<HumanAvatar, string> = {
  ace: '/avatars/human-ace.webp',
  nova: '/avatars/human-nova.webp',
  rex: '/avatars/human-rex.webp',
  zee: '/avatars/human-zee.webp',
  blaze: '/avatars/human-blaze.webp',
  pixel: '/avatars/human-pixel.webp',
  kai: '/avatars/human-kai.webp',
}
const BOT_AVATAR = '/avatars/bot.webp'

export default function SetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [gameMode, setGameMode] = useState<GameMode>(null)
  const [selectedTime, setSelectedTime] = useState<number>(DEFAULT_TEAM_TIMER_SECONDS)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<number>(3)
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
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})
  const skillLevels = getAvailableSkillLevels()
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string } | null>(null)
  const redirectUrlRef = useRef<string | null>(null)
  const autoJoinAttemptedRef = useRef<string | null>(null)
  const [duelFriends, setDuelFriends] = useState<FriendWithProfile[]>([])
  const [duelFriendsLoading, setDuelFriendsLoading] = useState(false)
  const [duelFriend, setDuelFriend] = useState<{ id: string; name: string } | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const mountedRef = useRef(true)
  const [selectedGameMode, setSelectedGameMode] = useState<SelectedGameMode>('duo')

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } }) => {
      if (!mountedRef.current) return
      const session = result.data.session
      if (session?.user) {
        setPlayerId(session.user.id)
        fetchUsername(session.user.id).then(name => {
          if (!mountedRef.current) return
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
      if (!mountedRef.current) return
      setSessionChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (!mountedRef.current) return
      if (session?.user) {
        setPlayerId(session.user.id)
        setUsername('')
        setJoinError(null)
        setJoinCode('')
        if (_event === 'SIGNED_IN') {
          localStorage.removeItem('chessduo_history')
        }
        fetchUsername(session.user.id).then(name => {
          if (!mountedRef.current) return
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
        setJoinError(null)
        setJoinCode('')
        localStorage.removeItem('chessduo_history')
        clearInsightsKeys()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (gameMode !== null) {
      window.history.pushState({ gameMode }, '', window.location.href)
    }

    const handlePopState = () => {
      if (gameMode !== null) {
        setGameMode(null)
        setJoinCode('')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [gameMode])

  useCapacitorBackButton(
    () => {
      if (gameMode !== null) {
        setGameMode(null)
        setJoinCode('')
        return true
      }
      if (duelFriend) {
        setDuelFriend(null)
        return true
      }
      return false
    },
    gameMode !== null || !!duelFriend
  )

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

    if (redirectParam && sessionChecked) {
      setShowAuthOverlay(true)
      return
    }

    if (codeParam && sessionChecked && !playerId) {
      setShowAuthOverlay(true)
      return
    }

    if (codeParam && sessionChecked && playerId && autoJoinAttemptedRef.current !== codeParam && !sessionStorage.getItem(`chessduo_left_${codeParam}`)) {
      const isValidRoomCode = /^[A-Z0-9]{6}$/.test(codeParam)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeParam)
      if (!isValidRoomCode && !isValidUUID) {
        autoJoinAttemptedRef.current = codeParam
        return
      }
      autoJoinAttemptedRef.current = codeParam
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
          setJoinCode('')
        }
        setJoinLoading(false)

        const url = new URL(window.location.href)
        url.searchParams.delete('code')
        window.history.replaceState(null, '', url.toString())
      }
      doAutoJoin()
    }
  }, [searchParams, sessionChecked, playerId, router])

  useEffect(() => {
    if (playerId) {
      const update = () => getUnreadCounts(playerId).then(({ total, bySender }) => {
        if (!mountedRef.current) return
        setUnreadMessages(total)
        setUnreadBySender(bySender)
      }).catch(() => {
        // Message counts unavailable
      })
      update()
      const interval = setInterval(update, 10000)
      const unsub = subscribeToMessages(playerId, () => {
        getUnreadCounts(playerId).then(({ total, bySender }) => {
          if (!mountedRef.current) return
          setUnreadMessages(total)
          setUnreadBySender(bySender)
        }).catch(() => {
          // Message counts unavailable
        })
      })
      return () => { clearInterval(interval); unsub() }
    }
  }, [playerId])

  useEffect(() => {
    if (gameMode === 'duel' && playerId && !duelFriend) {
      setDuelFriendsLoading(true)
      getFriendsList(playerId).then((friends) => {
        if (!mountedRef.current) return
        setDuelFriends(friends)
        setDuelFriendsLoading(false)
      }).catch(() => {
        if (!mountedRef.current) return
        setDuelFriendsLoading(false)
      })
    }
  }, [gameMode, playerId, duelFriend])

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
      if (url.startsWith('/')) {
        router.replace(url)
      } else {
        router.push('/')
      }
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
      if (url.startsWith('/')) {
        router.replace(url)
      } else {
        router.push('/')
      }
    }
  }

  function clearInsightsKeys() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('chessduo_insights_')) {
        localStorage.removeItem(key)
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('chessduo_history')
    localStorage.removeItem('chessduo_settings')
    clearInsightsKeys()
    setPlayerId(null)
    setUsername('')
    setProfileOpen(false)
    setFriendsOpen(false)
    setJoinError(null)
    setJoinCode('')
    autoJoinAttemptedRef.current = null
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

      if (room.mode === 'fourplayer') {
        setJoinLoading(false)
        router.push(`/four-player?room=${room.id}&code=${room.code}&playerId=${pid}&time=${room.time_seconds || 600}`)
        return
      }

      const { data: existingPlayers } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', room.id)

      if (existingPlayers?.some(p => p.player_id === pid)) {
        setJoinError('You are already in this room from another session')
        setJoinLoading(false)
        return
      }

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

  const handleTwoPlayerClick = () => {
    if (!playerId) { setShowAuthOverlay(true); return }
    if (showOnlineDisclaimer) {
      setShowOnboarding(true)
    } else {
      handleStartOnline(selectedTime)
    }
  }

  const handleOnboardingDismiss = () => {
    setShowOnlineDisclaimer(false)
    setShowOnboarding(false)
    handleStartOnline(selectedTime)
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
    if (!duelFriend) { setJoinError('Please select a friend to challenge'); return }
    setCreatingTime(timeSeconds)
    setJoinError(null)
    try {
      const pid = playerId as string
      const { data, roomId, roomCode, error } = await createChallenge(pid, 'online', timeSeconds, duelFriend.id)
      if (error) throw new Error(error)
      if (roomId && roomCode) {
        await sendMessage(pid, duelFriend.id, JSON.stringify({ type: 'challenge', roomId, roomCode, time: timeSeconds }), 'challenge')
        router.push(`/duel?room=${roomId}&code=${roomCode}&team=WHITE&playerId=${pid}&time=${timeSeconds}`)
      } else {
        throw new Error('Failed to create challenge')
      }
    } catch (err) {
      setCreatingTime(null)
      setJoinError(err instanceof Error ? err.message : 'Failed to create challenge')
    }
  }

  const handlePlay = () => {
    if (!playerId) { setShowAuthOverlay(true); return }

    switch (selectedGameMode) {
      case 'quick':
        handleStartOffline()
        break
      case 'duo':
        handleTwoPlayerClick()
        break
      case 'four':
        handleStartFourPlayer(selectedTime)
        break
    }
  }

  if (!sessionChecked) return <ErrorBoundary>{null}</ErrorBoundary>

  const showTopBar = !gameMode

  const slideOvers = playerId && (
    <>
      <SlideOver open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
        <ProfilePanel playerId={playerId} onViewHistory={() => { setProfileOpen(false); router.push('/history') }} onSignOut={handleSignOut} />
      </SlideOver>
      <SlideOver open={friendsOpen} onClose={() => { setFriendsOpen(false); getUnreadCounts(playerId!).then(({ total, bySender }) => { if (mountedRef.current) { setUnreadMessages(total); setUnreadBySender(bySender) } }).catch(() => {}) }} title="Friends">
        <FriendsPanel playerId={playerId} unreadBySender={unreadBySender} />
      </SlideOver>
    </>
  )

  const authOverlay = showAuthOverlay && (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm">
      <Auth
        onAuthComplete={handleAuthComplete}
        defaultSignup={searchParams.get('signup') === '1'}
        redirectUrl={redirectUrlRef.current || undefined}
        onNeedUsername={handleNeedUsername}
        onClose={() => setShowAuthOverlay(false)}
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

  if (chooseUsernameScreen) return <ErrorBoundary>{chooseUsernameScreen}</ErrorBoundary>

  // ============================================
  // Duel — Friend Selection Screen
  // ============================================
  if (gameMode === 'duel' && !duelFriend) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0e1a] dark:text-white flex flex-col">
          <HeaderBar />
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full">
              <div className="text-center mb-6">
                <div className="text-[42px] mb-2">⚔️</div>
                <h1 className="text-2xl font-black text-amber-600 dark:text-amber-500 tracking-wider">1v1 Duel</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Choose a friend to challenge</p>
              </div>

              {duelFriendsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : duelFriends.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-[32px] mb-3">👥</div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">No friends yet</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Add friends from the Friends panel to challenge them</p>
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {duelFriends.map((friend) => (
                    <button
                      key={friend.friend_id}
                      onClick={() => setDuelFriend({ id: friend.friend_id, name: friend.friend_username })}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 hover:border-amber-500/40 dark:hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/5 transition-all text-left group"
                      style={{ minHeight: '60px' }}
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-lg font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">
                        {friend.friend_username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{friend.friend_username}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-500">Challenge to a 1v1 duel</div>
                      </div>
                      <span className="text-amber-500 text-lg opacity-0 group-hover:opacity-100 transition-opacity">⚔️</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="text-center">
                <button onClick={() => { setGameMode(null); setDuelFriend(null); setDuelFriends([]) }} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors min-h-[44px] px-4 py-2 font-medium">
                  ← Back to home
                </button>
              </div>
            </div>
          </div>
          {slideOvers}
          {authOverlay}
        </div>
      </ErrorBoundary>
    )
  }

  // ============================================
  // Offline mode — skill level selection
  // ============================================
  if (gameMode === 'offline') {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0e1a] dark:text-white flex flex-col">
          <HeaderBar />
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full">
              <div className="text-center mb-6">
                <div className="mb-2 flex items-center justify-center">
                  <PlayerIcons left={['human','bot']} right={['bot','bot']} />
                </div>
                <h1 className="text-2xl font-black tracking-wider text-amber-600 dark:text-amber-500">QUICK PLAY</h1>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Select opponent skill level</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {skillLevels.map((level: SkillLevel) => (
                  <button
                    key={level.level}
                    onClick={() => setSelectedLevel(level.level)}
                    className={`p-5 rounded-2xl border-2 transition-all duration-200 text-center ${
                      selectedLevel === level.level
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 shadow-md'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="text-base font-bold mb-1 text-slate-900 dark:text-white">{level.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{level.description}</div>
                  </button>
                ))}
              </div>
              <div className="text-center mb-4">
                <button type="button" onClick={() => setShowOfflineDisclaimer(true)} className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors underline font-medium">
                  How to play?
                </button>
              </div>
              <div className="text-center">
                <button
                  onClick={handleStartOffline}
                  className="px-10 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-2xl text-base transition-colors shadow-md"
                >
                  Start Game
                </button>
              </div>
              <div className="mt-8 text-center">
                <button onClick={() => setGameMode(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors font-medium min-h-[44px] px-4 py-2">
                  ← Back to home
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
      </ErrorBoundary>
    )
  }

// ============================================
// Home screen — New mockup-based layout
// ============================================
if (!gameMode) {
  return (
    <ErrorBoundary>
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-white text-slate-900 dark:bg-[#0a0e1a] dark:text-white">
        <HeaderBar />

        <div className="flex flex-1 flex-col px-4 pb-20 pt-6 max-w-lg mx-auto w-full">
          {/* Time Control */}
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Time Control</p>
            <TimePills selectedTime={selectedTime} onSelect={setSelectedTime} />
          </div>

          {/* Game Mode */}
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Game Mode</p>
              <div className="space-y-2">
                <GameModeCard
                  mode="quick"
                  selected={selectedGameMode === 'quick'}
                  onClick={() => setSelectedGameMode('quick')}
                  leftIcons={[{ type: 'human', avatar: 'ace' as const }, { type: 'bot' as const, size: 'small' as const }]}
                  rightIcons={[{ type: 'bot' as const, size: 'small' as const }, { type: 'bot' as const, size: 'small' as const }]}
                  title="Quick Play"
                  subtitle="You + Bot vs Bot + Bot"
                />
                <GameModeCard
                  mode="duo"
                  selected={selectedGameMode === 'duo'}
                  onClick={() => setSelectedGameMode('duo')}
                  leftIcons={[{ type: 'human', avatar: 'ace' as const }, { type: 'human', avatar: 'nova' as const }]}
                  rightIcons={[{ type: 'bot' as const, size: 'small' as const }, { type: 'bot' as const, size: 'small' as const }]}
                  title="Duo"
                  subtitle="You + Friend vs Bot + Bot"
                  showStar
                />
                <GameModeCard
                  mode="four"
                  selected={selectedGameMode === 'four'}
                  onClick={() => setSelectedGameMode('four')}
                  leftIcons={[{ type: 'human', avatar: 'ace' as const }, { type: 'human', avatar: 'nova' as const }]}
                  rightIcons={[{ type: 'human', avatar: 'rex' as const }, { type: 'human', avatar: 'zee' as const }]}
                  title="Four Players"
                  subtitle="Friends vs Friends"
                />
              </div>
            </div>

          {/* Bot Difficulty */}
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Bot Difficulty</p>
              <BotDifficultySelector
                selectedLevel={selectedLevel}
                onSelect={setSelectedLevel}
              />
            </div>

            {/* Play Button */}
            <PlayButton onClick={handlePlay} />

            {/* Error message */}
            {joinError && (
              <p className="mt-3 text-center text-xs font-medium text-red-400">{joinError}</p>
            )}
          </div>

          {/* Bottom Navigation */}
          <HomeBottomNav
            onProfile={() => setProfileOpen(true)}
            onHistory={() => router.push('/history')}
            onFriends={() => setFriendsOpen(true)}
            unreadMessages={unreadMessages}
          />

          {slideOvers}
          {authOverlay}
          {showOnboarding && (
            <WelcomeDisclaimer
              open={showOnboarding}
              onDismiss={handleOnboardingDismiss}
              mode="online"
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }

  return <ErrorBoundary>{null}</ErrorBoundary>
}

// ============================================
// Header Bar Component
// ============================================
function HeaderBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center px-4 py-3 bg-white/90 border-b border-slate-200 dark:bg-[#0a0e1a]/90 dark:border-0 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Crown size={28} strokeWidth={1.5} className="text-blue-500 dark:text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]" />
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-slate-900 dark:text-white">Chess</span>
          <span className="text-blue-600 dark:text-blue-500">Duo</span>
        </h1>
      </div>
    </div>
  )
}

// ============================================
// Time Pills Component
// ============================================
function TimePills({ selectedTime, onSelect }: {
  selectedTime: number; onSelect: (seconds: number) => void
}) {
  return (
    <div className="flex gap-2">
      {TIME_OPTIONS.map((opt) => (
        <button
          key={opt.seconds}
          onClick={() => onSelect(opt.seconds)}
          className={`flex-1 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap ${
            selectedTime === opt.seconds
              ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
              : 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
          }`}
          style={{ minHeight: '48px', minWidth: '48px' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ============================================
// Game Mode Card Component
// ============================================
function GameModeCard({
  mode,
  selected,
  onClick,
  leftIcons,
  rightIcons,
  title,
  subtitle,
  showStar = false,
}: {
  mode: string
  selected: boolean
  onClick: () => void
  leftIcons: TeamIcon[]
  rightIcons: TeamIcon[]
  title: string
  subtitle: string
  showStar?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left ${
        selected
          ? 'border-blue-500/60 bg-blue-50 dark:bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60'
      }`}
      style={{ minHeight: '72px' }}
    >
      {/* Team icons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {leftIcons.map((icon, i) => {
            const isSmall = icon.size === 'small'
            return (
              <div key={i} className={`${isSmall ? 'w-6 h-6' : 'w-12 h-12'} rounded-xl overflow-hidden`}>
                <img
                  src={icon.type === 'human' ? HUMAN_AVATARS[icon.avatar] : BOT_AVATAR}
                  alt={icon.type === 'human' ? `Player avatar (${icon.avatar})` : 'Bot avatar'}
                  width={168}
                  height={168}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            )
          })}
        </div>
        <span className="text-xs font-bold text-blue-500/60 dark:text-blue-400/60 mx-1">VS</span>
        <div className="flex items-center gap-1.5">
          {rightIcons.map((icon, i) => {
            const isSmall = icon.size === 'small'
            return (
              <div key={i} className={`${isSmall ? 'w-6 h-6' : 'w-12 h-12'} rounded-xl overflow-hidden`}>
                <img
                  src={icon.type === 'human' ? HUMAN_AVATARS[icon.avatar] : BOT_AVATAR}
                  alt={icon.type === 'human' ? `Player avatar (${icon.avatar})` : 'Bot avatar'}
                  width={168}
                  height={168}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-base text-slate-900 dark:text-white">{title}</span>
          {showStar && <span className="text-amber-500 text-sm">★</span>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
      </div>

      {/* Chevron */}
      <ChevronRight size={18} className="text-slate-500 flex-shrink-0" />
    </button>
  )
}

// ============================================
// Bot Difficulty Selector Component
// ============================================
function BotDifficultySelector({
  selectedLevel,
  onSelect,
}: {
  selectedLevel: number
  onSelect: (level: number) => void
}) {
  const currentDifficulty = DIFFICULTY_LEVELS.find(d => d.level === selectedLevel) || DIFFICULTY_LEVELS[2]
  const totalDots = 6
  const filledDots = selectedLevel

  const goPrev = () => {
    const idx = DIFFICULTY_LEVELS.findIndex(d => d.level === selectedLevel)
    const prev = idx > 0 ? DIFFICULTY_LEVELS[idx - 1].level : DIFFICULTY_LEVELS[DIFFICULTY_LEVELS.length - 1].level
    onSelect(prev)
  }

  const goNext = () => {
    const idx = DIFFICULTY_LEVELS.findIndex(d => d.level === selectedLevel)
    const next = idx < DIFFICULTY_LEVELS.length - 1 ? DIFFICULTY_LEVELS[idx + 1].level : DIFFICULTY_LEVELS[0].level
    onSelect(next)
  }

  return (
    <div className="p-3 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 space-y-2.5">
      {/* Difficulty picker row */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={goPrev}
          className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="Previous difficulty"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <span className="text-xl">{currentDifficulty.icon}</span>
          <span className="font-bold text-base">{currentDifficulty.label}</span>
        </div>

        <button
          onClick={goNext}
          className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label="Next difficulty"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-xs text-slate-400 dark:text-slate-500">Easy</span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalDots }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i < filledDots ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]' : 'bg-slate-200 border border-slate-300 dark:bg-slate-700 dark:border-slate-600'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">Hard</span>
      </div>
    </div>
  )
}

// ============================================
// Play Button Component
// ============================================
function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-black text-xl tracking-wider transition-all duration-200 shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:shadow-[0_0_32px_rgba(16,185,129,0.4)] active:scale-[0.98]"
      style={{ minHeight: '56px' }}
    >
      <Play size={24} fill="currentColor" />
      PLAY
    </button>
  )
}

// ============================================
// Home Bottom Navigation Component
// ============================================
function HomeBottomNav({
  onProfile,
  onHistory,
  onFriends,
  unreadMessages,
}: {
  onProfile: () => void
  onHistory: () => void
  onFriends: () => void
  unreadMessages: number
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-[#0a0e1a]/95 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        <NavButton label="Home" icon={HomeIcon} active onClick={() => {}} />
        <NavButton label="History" icon={History} onClick={onHistory} />
        <NavButton label="Friends" icon={Users} onClick={onFriends} badge={unreadMessages} />
        <NavButton label="Profile" icon={User} onClick={onProfile} />
      </div>
    </nav>
  )
}

function NavButton({
  label,
  icon: Icon,
  active = false,
  onClick,
  badge = 0,
}: {
  label: string
  icon: typeof HomeIcon
  active?: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all min-h-[44px] min-w-[44px] ${
        active
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      <div className="relative">
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-blue-500 text-white text-[9px] font-bold rounded-full px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  )
}

// ============================================
// Player Icons Component (offline mode)
// ============================================
function PlayerIcons({ left, right }: {
  left: ('human' | 'bot')[]
  right: ('human' | 'bot')[]
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        {left.map((type, i) => (
          <div
            key={i}
            className="w-9 h-9 rounded-xl overflow-hidden"
          >
            <img
              src={type === 'human' ? HUMAN_AVATARS.ace : BOT_AVATAR}
              alt={type === 'human' ? 'Player avatar' : 'Bot avatar'}
              width={168}
              height={168}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <Swords size={18} strokeWidth={2} className="text-amber-500/60 dark:text-amber-400/50" />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">VS</span>
      </div>
      <div className="flex items-center gap-1.5">
        {right.map((type, i) => (
          <div
            key={i}
            className="w-9 h-9 rounded-xl overflow-hidden"
          >
            <img
              src={type === 'human' ? HUMAN_AVATARS.ace : BOT_AVATAR}
              alt={type === 'human' ? 'Player avatar' : 'Bot avatar'}
              width={168}
              height={168}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
