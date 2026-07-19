'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { getFriendsList, FriendWithProfile } from '@/lib/friends'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { HomeBottomNav } from '@/components/HomeBottomNav'
import { Room } from '@/lib/supabase'
import { sendMessage } from '@/lib/messages'
import { createOnlineRoom } from '@/lib/roomActions'
import { createFourPlayerRoom, joinFourPlayerByCode } from '@/lib/fourPlayerActions'
import { createChallenge, getChallengeUrl } from '@/lib/challenges'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Swords, ChevronRight, Play, ChessPawn, ChessKnight, ChessBishop, ChessRook, Crown } from 'lucide-react'
import ChessDuoLogo from '@/components/ChessDuoLogo'
import { useSettings } from '@/lib/settings'
import { DEFAULT_TEAM_TIMER_SECONDS, PlayerColor, SELECTED_COLOR_KEY, DEFAULT_PLAYER_COLOR } from '@/features/shared/gameConstants'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useBadgeCount } from '@/hooks/useBadgeCount'
import { useIsMobile } from '@/hooks/useIsMobile'
import { InitialsAvatar } from '@/components/InitialsAvatar'
import { Spinner } from '@/components/Spinner'
import { ColorPicker } from '@/components/ColorPicker'
import { DesktopSidebar } from '@/components/DesktopSidebar'
import { ConfigurationPanel } from '@/components/ConfigurationPanel'
import { motion, AnimatePresence } from 'framer-motion'

export const dynamic = 'force-dynamic'

type GameMode = 'offline' | 'online' | 'fourplayer' | 'duel' | null

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
  { level: 1, label: 'Easy',   Icon: ChessPawn, description: 'Great for learning. Bots make occasional mistakes and miss tactical opportunities.' },
  { level: 2, label: 'Medium', Icon: ChessKnight, description: 'Balanced play that does not punish mistakes too harshly. Good for casual games.' },
  { level: 3, label: 'Hard',   Icon: ChessBishop, description: 'Bots play solid chess and capitalize on obvious errors. Expect a challenge.' },
  { level: 4, label: 'Expert', Icon: ChessRook, description: 'Strong positional moves and punishing tactics. Recommended for experienced players.' },
  { level: 5, label: 'Master', Icon: Crown, description: 'Near-perfect play with deep calculation. Only for the most skilled players.' },
]

type HumanAvatar = 'ace' | 'nova' | 'rex' | 'zee' | 'blaze' | 'pixel' | 'kai'
type TeamIcon = { type: 'human'; avatar: HumanAvatar } | { type: 'bot' }

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

const SELECTED_TIME_KEY = 'chessduo_selected_time'
const SELECTED_LEVEL_KEY = 'chessduo_selected_level'

function getInitialTime(): number {
  try {
    const saved = localStorage.getItem(SELECTED_TIME_KEY)
    if (saved) {
      const val = parseInt(saved, 10)
      if (TIME_OPTIONS.some(o => o.seconds === val)) return val
    }
  } catch {}
  return DEFAULT_TEAM_TIMER_SECONDS
}

function getInitialLevel(): number {
  try {
    const saved = localStorage.getItem(SELECTED_LEVEL_KEY)
    if (saved) {
      const val = parseInt(saved, 10)
      if (DIFFICULTY_LEVELS.some(d => d.level === val)) return val
    }
  } catch {}
  return 3
}

function getInitialColor(): PlayerColor {
  try {
    const saved = localStorage.getItem(SELECTED_COLOR_KEY)
    if (saved === 'white' || saved === 'black' || saved === 'random') {
      return saved
    }
  } catch {}
  return DEFAULT_PLAYER_COLOR
}

export default function SetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [gameMode, setGameMode] = useState<GameMode>(null)
  const [selectedGameMode, setSelectedGameMode] = useState<'quick' | 'duo' | 'four' | null>(null)
  const [selectedTime, setSelectedTime] = useState<number>(getInitialTime)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<number>(getInitialLevel)
  const [selectedColor, setSelectedColor] = useState<PlayerColor>(getInitialColor)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [creatingTime, setCreatingTime] = useState<number | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [showAuthOverlay, setShowAuthOverlay] = useState(false)
  const hasSeenOfflineDisclaimer = typeof window !== 'undefined' && localStorage.getItem('chessduo_offline_disclaimer_dismissed') === 'true'
  const [showOnlineDisclaimer, setShowOnlineDisclaimer] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chessduo_welcome_dismissed') !== 'true'
    }
    return false
  })
  const { total: unreadMessages, unreadBySender } = useBadgeCount(playerId)
  const skillLevels = getAvailableSkillLevels()
  const isMobile = useIsMobile()
  const [needsUsername, setNeedsUsername] = useState<{ userId: string; suggestedName: string } | null>(null)
  const redirectUrlRef = useRef<string | null>(null)
  const autoJoinAttemptedRef = useRef<string | null>(null)
  const [duelFriends, setDuelFriends] = useState<FriendWithProfile[]>([])
  const [duelFriendsLoading, setDuelFriendsLoading] = useState(false)
  const [duelFriend, setDuelFriend] = useState<{ id: string; name: string } | null>(null)
  const mountedRef = useRef(true)

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
        // Dismiss auth overlay immediately on sign-in
        if (_event === 'SIGNED_IN' && showAuthOverlay) {
          setShowAuthOverlay(false)
        }
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
    try { localStorage.setItem(SELECTED_TIME_KEY, String(selectedTime)) } catch {}
  }, [selectedTime])

  useEffect(() => {
    try { localStorage.setItem(SELECTED_LEVEL_KEY, String(selectedLevel)) } catch {}
  }, [selectedLevel])

  useEffect(() => {
    try { localStorage.setItem(SELECTED_COLOR_KEY, selectedColor) } catch {}
  }, [selectedColor])

  // Auto-start offline game after returning from Welcome page
  // Runs on mount (no deps on session/player) so guest users aren't blocked.
  // BUG FIX: previously combined with the online auto-start behind `!playerId` guard,
  // which short-circuited the offline path for guest users and dropped them on home.
  useEffect(() => {
    const pendingOffline = localStorage.getItem('chessduo_pending_offline_game')
    if (!pendingOffline) return
    localStorage.removeItem('chessduo_pending_offline_game')
    try {
      const { level, time, color } = JSON.parse(pendingOffline)
      const colorParam = color ? `&color=${color}` : ''
      router.replace(`/game?level=${level || selectedLevel}&time=${time || DEFAULT_TEAM_TIMER_SECONDS}${colorParam}`)
    } catch {
      router.replace(`/game?level=${selectedLevel}&time=${selectedTime || DEFAULT_TEAM_TIMER_SECONDS}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-start online game after returning from Welcome page.
  // Needs an authenticated session because online games hit Supabase.
  useEffect(() => {
    if (!sessionChecked || !playerId) return

    const pendingOnline = localStorage.getItem('chessduo_pending_online_game')
    if (!pendingOnline) return
    localStorage.removeItem('chessduo_pending_online_game')
    handleStartOnline(selectedTime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, playerId, selectedTime, router])

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
            // Determine the joiner's team: opposite of host's team so the
            // joiner auto-receives the opposite color. Fall back to WHITE
            // if the host's team cannot be determined.
            let joinerTeam: 'WHITE' | 'BLACK' = 'WHITE'
            try {
              const { data: existingPlayers } = await supabase
                .from('room_players')
                .select('team')
                .eq('room_id', room.id)
              const hostTeam = existingPlayers?.[0]?.team
              joinerTeam = hostTeam === 'WHITE' ? 'BLACK' : 'WHITE'
            } catch {
              /* keep WHITE default */
            }
            router.push(`/game?mode=online&room=${room.id}&code=${room.code}&team=${joinerTeam}&playerId=${playerId}&time=${roomTime}`)
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

      // Prefer the team with open slots. If both have space, prefer the
      // opposite of the host's team (the host already occupies a slot).
      const hostTeam = (existingPlayers || [])[0]?.team as 'WHITE' | 'BLACK' | undefined
      const preferredTeam: 'WHITE' | 'BLACK' = hostTeam === 'WHITE' ? 'BLACK' : 'WHITE'

      let team: 'WHITE' | 'BLACK' = preferredTeam
      if (whiteSlots.length < 2 && blackSlots.length < 2) {
        team = preferredTeam
      } else if (whiteSlots.length < 2) {
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
      const result = await createOnlineRoom({ playerId: pid, timeSeconds, hostColor: selectedColor })
      router.push(`/game?mode=online&room=${result.roomId}&code=${result.roomCode}&team=${result.team}&playerId=${result.playerId}&time=${result.time}&color=${selectedColor}`)
    } catch (err) {
      setCreatingTime(null)
      setJoinError(err instanceof Error ? err.message : 'Failed to create room')
    }
  }

  const handleStartOffline = () => {
    if (!hasSeenOfflineDisclaimer) {
      const time = selectedTime || DEFAULT_TEAM_TIMER_SECONDS
      localStorage.setItem('chessduo_pending_offline_game', JSON.stringify({ level: selectedLevel, time, color: selectedColor }))
      router.push('/welcome?mode=offline')
      return
    }
    const time = selectedTime || DEFAULT_TEAM_TIMER_SECONDS
    router.push(`/game?level=${selectedLevel}&time=${time}&color=${selectedColor}`)
  }

  const handleTwoPlayerClick = () => {
    if (!playerId) {
      setShowAuthOverlay(true)
      return
    }
    if (showOnlineDisclaimer) {
      const time = selectedTime || DEFAULT_TEAM_TIMER_SECONDS
      localStorage.setItem('chessduo_pending_online_game', JSON.stringify({ time }))
      router.push('/welcome?mode=online')
    } else {
      handleStartOnline(selectedTime)
    }
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
      setJoinError(err instanceof Error ? err.message : 'Failed to create room')
    }
  }

  const handleGameModeClick = (mode: 'quick' | 'duo' | 'four') => {
    if (selectedGameMode === mode) {
      // Already selected: for Four Player, start immediately
      if (mode === 'four') {
        handleStartFourPlayer(selectedTime)
      }
      // For quick/duo, do nothing (user clicks Start Game in inline config)
    } else {
      setSelectedGameMode(mode)
    }
  }

  const handlePlay = () => {
    if (!selectedGameMode) return
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

  if (!sessionChecked) return (
    <ErrorBoundary>
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    </ErrorBoundary>
  )

  const showTopBar = !gameMode

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
                  <Spinner size="sm" />
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
                      className="w-full min-h-[60px] flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 hover:border-amber-500/40 dark:hover:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/5 transition-all text-left group"
                    >
                      <InitialsAvatar
                        username={friend.friend_username}
                        size="md"
                        src={friend.friend_avatar_url || null}
                      />
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
                <button type="button" onClick={() => router.push('/welcome?mode=offline')} className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors underline font-medium">
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



          {authOverlay}
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
      <div className="relative flex h-screen flex-col bg-white text-slate-900 dark:bg-[#0a0e1a] dark:text-white overflow-hidden md:pl-[220px] lg:pl-[240px]">
        <HeaderBar />

        {isMobile ? (
          // Mobile: Single column layout
          <div className="md:hidden flex-1 flex flex-col px-4 pb-24 pt-2 max-w-lg mx-auto w-full min-h-0 overflow-hidden">
            {/* Time Control */}
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Time Control</p>
              <TimePills selectedTime={selectedTime} onSelect={setSelectedTime} />
            </div>

            {/* Game Mode + Configuration — animated vertical expand on mobile */}
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Game Mode</p>
              <motion.div
                layout
                className={`${selectedGameMode && selectedGameMode !== 'four' ? 'md:grid md:grid-cols-2 md:gap-3' : ''}`}
              >
                {/* Game Mode cards */}
                <div className="space-y-1.5">
                  <GameModeCard
                    onClick={() => handleGameModeClick('quick')}
                    selected={selectedGameMode === 'quick'}
                    leftIcons={[{ type: 'human', avatar: 'ace' }, { type: 'bot' }]}
                    rightIcons={[{ type: 'bot' }, { type: 'bot' }]}
                    title="Quick Play"
                    subtitle="You + Bot vs Bots"
                    showStar
                  />
                  <GameModeCard
                    onClick={() => handleGameModeClick('duo')}
                    selected={selectedGameMode === 'duo'}
                    leftIcons={[{ type: 'human', avatar: 'ace' }, { type: 'human', avatar: 'nova' }]}
                    rightIcons={[{ type: 'bot' }, { type: 'bot' }]}
                    title="Duo"
                    subtitle="You + Friend vs Bots"
                  />
                  <GameModeCard
                    onClick={() => handleGameModeClick('four')}
                    selected={selectedGameMode === 'four'}
                    leftIcons={[{ type: 'human', avatar: 'ace' }, { type: 'human', avatar: 'nova' }]}
                    rightIcons={[{ type: 'human', avatar: 'rex' }, { type: 'human', avatar: 'zee' }]}
                    title="4 Player"
                    subtitle="Friends Battle"
                  />
                </div>

                {/* Configuration — slides in on Quick Play / Duo */}
                <AnimatePresence>
                  {selectedGameMode && selectedGameMode !== 'four' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Configuration</p>
                      <div className="rounded-[28px] border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#0a0e1a] p-5 shadow-2xl">
                        {/* Bot Difficulty */}
                        <section className="mb-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">Bot Difficulty</p>
                          <BotDifficultySelector
                            selectedLevel={selectedLevel}
                            onSelect={setSelectedLevel}
                          />
                          {(() => {
                            const selected = DIFFICULTY_LEVELS.find(d => d.level === selectedLevel)
                            if (!selected) return null
                            return (
                              <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-gray-50 dark:bg-slate-800/30 p-3">
                                {selected.description}
                              </p>
                            )
                          })()}
                        </section>

                        {/* Choose Your Color */}
                        <section className="mb-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                            Choose Your <span className="text-blue-500 dark:text-blue-400">Color</span>
                          </p>
                          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
                        </section>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Join by Code */}
            <div className="mt-1 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Join by Code</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  maxLength={36}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  onClick={handleJoinByCode}
                  disabled={joinLoading || !joinCode.trim()}
                  className="min-h-[44px] min-w-[80px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-sm transition-colors disabled:cursor-not-allowed"
                >
                  {joinLoading ? (
                    <Spinner size="sm" className="border-white/30 border-t-white mx-auto" />
                  ) : (
                    'Join'
                  )}
                </button>
              </div>
            </div>

            {joinError && (
              <p className="text-center text-xs font-medium text-red-400">{joinError}</p>
            )}

            {authOverlay}
          </div>
        ) : (
          // Desktop: Two-panel layout
          <div className="hidden md:flex flex-1 min-h-0">
            {/* Left Panel — Main Content */}
            <div className="flex-1 flex flex-col px-4 pb-24 pt-2 max-w-lg mx-auto w-full min-h-0 overflow-hidden">
              {/* Time Control */}
              <div className="mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Time Control</p>
                <TimePills selectedTime={selectedTime} onSelect={setSelectedTime} />
              </div>

              {/* Game Mode */}
              <div className="mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Game Mode</p>
                <div className="space-y-1.5">
                  <GameModeCard
                    onClick={() => handleGameModeClick('quick')}
                    selected={selectedGameMode === 'quick'}
                    leftIcons={[{ type: 'human', avatar: 'ace' }, { type: 'bot' }]}
                    rightIcons={[{ type: 'bot' }, { type: 'bot' }]}
                    title="Quick Play"
                    subtitle="You + Bot vs Bots"
                    showStar
                  />
                  <GameModeCard
                    onClick={() => handleGameModeClick('duo')}
                    selected={selectedGameMode === 'duo'}
                    leftIcons={[{ type: 'human', avatar: 'ace' }, { type: 'human', avatar: 'nova' }]}
                    rightIcons={[{ type: 'bot' }, { type: 'bot' }]}
                    title="Duo"
                    subtitle="You + Friend vs Bots"
                  />
                  <GameModeCard
                    onClick={() => handleGameModeClick('four')}
                    selected={selectedGameMode === 'four'}
                    leftIcons={[{ type: 'human', avatar: 'ace' }, { type: 'human', avatar: 'nova' }]}
                    rightIcons={[{ type: 'human', avatar: 'rex' }, { type: 'human', avatar: 'zee' }]}
                    title="4 Player"
                    subtitle="Friends Battle"
                  />
                </div>
              </div>

              {/* Play / Start Game Button — inside Game Mode section, aligned with cards */}
              {(selectedGameMode === 'four' || selectedGameMode === 'quick' || selectedGameMode === 'duo') && (
                <div className="mt-3">
                  <button
                    onClick={handlePlay}
                    className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-sm transition-all duration-200 active:scale-[0.97] ${
                      selectedGameMode === 'four'
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-500 shadow-[0_4px_24px_rgba(16,185,129,0.35)]'
                        : 'bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300 shadow-[0_4px_24px_rgba(59,130,246,0.35)]'
                    }`}
                  >
                    <Play size={20} strokeWidth={2.5} fill="currentColor" />
                    {selectedGameMode === 'four' ? 'Play' : 'Start Game'}
                  </button>
                </div>
              )}

              {/* Join by Code */}
              <div className="mt-1 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Join by Code</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    maxLength={36}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    onClick={handleJoinByCode}
                    disabled={joinLoading || !joinCode.trim()}
                    className="min-h-[44px] min-w-[80px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-sm transition-colors disabled:cursor-not-allowed"
                  >
                    {joinLoading ? (
                      <Spinner size="sm" className="border-white/30 border-t-white mx-auto" />
                    ) : (
                      'Join'
                    )}
                  </button>
                </div>
              </div>

              {joinError && (
                <p className="text-center text-xs font-medium text-red-400">{joinError}</p>
              )}

              {authOverlay}
            </div>

            {/* Right Panel — Configuration (desktop only) */}
            <AnimatePresence>
              {selectedGameMode && selectedGameMode !== 'four' && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 360, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden border-l border-slate-200/60 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-900/50"
                >
                  <div className="w-[360px] h-full overflow-y-auto">
                    <div className="sticky top-0 px-5 pt-4 pb-2 bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/50">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400">Configuration</h2>
                    </div>
                    <ConfigurationPanel
                      selectedLevel={selectedLevel}
                      onSelectLevel={setSelectedLevel}
                      selectedColor={selectedColor}
                      onSelectColor={setSelectedColor}
                      difficultyLevels={DIFFICULTY_LEVELS}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Navigation — sidebar on browser, bottom nav on mobile */}
        {isMobile ? (
          <HomeBottomNav unreadMessages={unreadMessages} />
        ) : (
          <DesktopSidebar unreadMessages={unreadMessages} />
        )}
      </div>
    </ErrorBoundary>
  )
}

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a]">
      <Spinner size="lg" />
    </div>
  )
}

// ============================================
// Header Bar Component
// ============================================
function HeaderBar() {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center px-4 py-3 bg-white/90 border-b border-slate-200 dark:bg-[#0a0e1a]/90 dark:border-0 backdrop-blur-xl">
      <ChessDuoLogo size="md" />
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
          className={`flex-1 min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap ${
            selectedTime === opt.seconds
              ? 'bg-blue-600 text-white shadow-[var(--shadow-glow-blue-strong)]'
              : 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
          }`}
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
  onClick,
  leftIcons,
  rightIcons,
  title,
  subtitle,
  showStar = false,
  selected = false,
}: {
  onClick: () => void
  leftIcons: TeamIcon[]
  rightIcons: TeamIcon[]
  title: string
  subtitle: string
  showStar?: boolean
  selected?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[56px] flex items-center gap-2 p-2 rounded-xl border-2 transition-all duration-200 text-left ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60'
      }`}
    >
      {/* Team icons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-1">
          {leftIcons.map((icon, i) => (
            <div key={i} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden">
              <img
                src={icon.type === 'human' ? HUMAN_AVATARS[icon.avatar] : BOT_AVATAR}
                alt={icon.type === 'human' ? `Player avatar (${icon.avatar})` : 'Bot avatar'}
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
          ))}
        </div>
        <span className="text-xs font-bold text-blue-500/60 dark:text-blue-400/60">VS</span>
        <div className="flex items-center gap-1">
          {rightIcons.map((icon, i) => (
            <div key={i} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden">
              <img
                src={icon.type === 'human' ? HUMAN_AVATARS[icon.avatar] : BOT_AVATAR}
                alt={icon.type === 'human' ? `Player avatar (${icon.avatar})` : 'Bot avatar'}
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-bold text-sm text-slate-900 dark:text-white">{title}</span>
          {showStar && <span className="text-amber-500 text-xs shrink-0">★</span>}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      {/* Chevron */}
      <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
    </button>
  )
}

// ============================================
// Bot Difficulty Selector Component
// 5-card grid with Lucide chess-piece icons (Easy/Medium/Hard/Expert/Master).
// See spec § 5.4 for the canonical pattern.
// ============================================
function BotDifficultySelector({
  selectedLevel,
  onSelect,
}: {
  selectedLevel: number
  onSelect: (level: number) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Bot difficulty">
      {DIFFICULTY_LEVELS.map(({ level, label, Icon }) => {
        const selected = level === selectedLevel
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} difficulty`}
            onClick={() => onSelect(level)}
            className={[
              'min-h-[64px] min-w-[44px] flex flex-col items-center justify-center gap-1',
              'rounded-xl border-2 px-1 py-2 transition-all duration-200',
              selected
                ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10 shadow-[var(--shadow-glow-blue-strong)]'
                : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60',
            ].join(' ')}
          >
            <Icon
              size={22}
              strokeWidth={1.8}
              className={selected
                ? 'text-blue-600 dark:text-blue-300'
                : 'text-slate-700 dark:text-slate-300'}
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================
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
            className="w-10 h-10 rounded-full overflow-hidden"
          >
            <img
              src={type === 'human' ? HUMAN_AVATARS.ace : BOT_AVATAR}
              alt={type === 'human' ? 'Player avatar' : 'Bot avatar'}
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <Swords size={18} strokeWidth={2} className="text-amber-500/60 dark:text-amber-400/50" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">VS</span>
      </div>
      <div className="flex items-center gap-1.5">
        {right.map((type, i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-full overflow-hidden"
          >
            <img
              src={type === 'human' ? HUMAN_AVATARS.ace : BOT_AVATAR}
              alt={type === 'human' ? 'Player avatar' : 'Bot avatar'}
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
