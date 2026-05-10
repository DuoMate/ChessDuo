'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Room, RoomPlayer, Profile } from '@/lib/supabase'

interface RoomManagerProps {
  playerId: string
  username: string
  difficulty?: number
  initialJoinCode?: string | null
  onRoomJoined: (room: Room, team: 'WHITE' | 'BLACK', playerId: string) => void
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

const ELO_LABELS: Record<number, string> = {
  1: 'Beginner ~1000 ELO',
  2: 'Intermediate ~1200 ELO',
  3: 'Advanced Player ~1400 ELO',
  4: 'Advanced ~2000 ELO',
  5: 'Expert ~2200 ELO',
  6: 'Master ~2600 ELO',
}

type Tab = 'create' | 'join' | 'quick'

type PlayerSlot = 
  | { type: 'human'; label: string; ready: boolean }
  | { type: 'bot'; label: string; eloLabel: string }
  | { type: 'empty'; label: string }

export function RoomManager({ playerId, username, difficulty = 4, initialJoinCode, onRoomJoined }: RoomManagerProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('create')
  const [joinCode, setJoinCode] = useState('')
  const [myRoomCode, setMyRoomCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [supabaseRoomId, setSupabaseRoomId] = useState<string | null>(null)
  const supabaseRoomIdRef = useRef<string | null>(null)
  const [joinedRoom, setJoinedRoom] = useState(false)
  const [joinedRoomCode, setJoinedRoomCode] = useState('')
  const [friendRoomId, setFriendRoomId] = useState('')

  const eloLabel = ELO_LABELS[difficulty] || ELO_LABELS[4]

  // Auto-join when initialJoinCode is provided (from shared link)
  useEffect(() => {
    if (initialJoinCode && activeTab !== 'join') {
      setActiveTab('join')
    }
    if (initialJoinCode && !joinCode) {
      setJoinCode(initialJoinCode)
    }
    // Auto-trigger join after code is set
    if (initialJoinCode && joinCode === initialJoinCode && !loading && !joinedRoom) {
      const timer = setTimeout(() => {
        console.log(`[ROOM] Auto-joining with code: ${initialJoinCode}`)
        joinRoom()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [initialJoinCode, joinCode, activeTab, loading, joinedRoom])

  const [slots, setSlots] = useState<PlayerSlot[]>([
    { type: 'human', label: username, ready: true },
    { type: 'empty', label: 'Invite your friend' },
    { type: 'bot', label: 'Opponent Bot', eloLabel },
    { type: 'bot', label: 'Opponent Bot', eloLabel },
  ])

  const copyCode = async () => {
    if (myRoomCode) {
      await navigator.clipboard.writeText(myRoomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyShareLink = async () => {
    if (myRoomCode) {
      const link = `${window.location.origin}/join?code=${myRoomCode}`
      await navigator.clipboard.writeText(link)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const shareInvite = async () => {
    if (myRoomCode) {
      const link = `${window.location.origin}/join?code=${myRoomCode}`
      if (navigator.share) {
        await navigator.share({ title: 'Join my ChessDuo room', text: `Join my 2v2 chess match! Room code: ${myRoomCode}`, url: link })
      } else {
        await copyShareLink()
      }
    }
  }

  const createRoom = async () => {
    console.log('[ROOM] Creating room...')
    setLoading(true)
    setError(null)

    const code = generateRoomCode()

    // Show invite code immediately - don't wait for Supabase
    setMyRoomCode(code)
    console.log(`[ROOM] Room code generated: ${code} difficulty=${difficulty}`)
    setLoading(false)

    // Try Supabase in background
    try {
      console.log('[ROOM] Syncing to Supabase...')
      const { data: testData, error: testError } = await supabase
        .from('rooms')
        .select('id')
        .limit(1)

      if (testError) {
        console.warn('[ROOM] Supabase not available, playing offline:', testError.message)
        return
      }

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code,
          status: 'waiting',
          created_by: playerId
        })
        .select()
        .single()

      if (roomError) {
        console.warn('[ROOM] Supabase room insert failed:', roomError.message)
        return
      }

      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: room.id,
          player_id: playerId,
          team: 'WHITE',
          slot: 0,
          status: 'waiting'
        })

      if (playerError) {
        console.warn('[ROOM] Supabase player insert failed:', playerError.message)
        return
      }

      console.log(`[ROOM] Synced to Supabase: room_id=${room.id}`)
      setSupabaseRoomId(room.id)
      supabaseRoomIdRef.current = room.id
    } catch (err) {
      console.warn('[ROOM] Supabase sync failed (playing offline):', err)
    }
  }

  // Poll room_players every 3s to detect when friend joins
  useEffect(() => {
    if (!supabaseRoomId) return
    const poll = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_id', supabaseRoomId)
          .eq('team', 'WHITE')
          .eq('slot', 1)
          .maybeSingle()

        if (data) {
          console.log(`[ROOM] Friend detected via poll: player_id=${data.player_id?.substring(0, 8)}...`)
          setSlots(prev => prev.map((s, i) =>
            i === 1 && s.type === 'empty'
              ? { type: 'human', label: data.player_id?.substring(0, 8) ?? 'Friend', ready: true }
              : s
          ))
        }
      } catch {
        // Supabase unavailable — ignore
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [supabaseRoomId])

  // Poll room status — friend side: detect when host starts match
  useEffect(() => {
    if (!joinedRoom || !joinedRoomCode) return
    const poll = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('rooms')
          .select('status')
          .eq('code', joinedRoomCode.toUpperCase())
          .single()

        if (data?.status === 'playing') {
          console.log('[ROOM] Host started match — navigating to game')
          onRoomJoined({ id: friendRoomId, code: joinedRoomCode, status: 'playing', created_by: '' } as Room, 'WHITE', playerId)
        }
      } catch {
        // Supabase unavailable — ignore
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [joinedRoom, joinedRoomCode, friendRoomId, playerId, onRoomJoined])

  const startMatch = async () => {
    if (!myRoomCode) return
    const whiteCount = slots.filter((s, i) => i < 2 && s.type !== 'empty').length
    if (whiteCount < 2) return
    console.log('[ROOM] Starting match...')

    // Update room status so friend's poll picks it up
    if (supabaseRoomId) {
      try {
        await supabase.from('rooms').update({ status: 'playing' }).eq('id', supabaseRoomId)
        console.log('[ROOM] Room status updated to playing')
      } catch {
        console.warn('[ROOM] Failed to update room status — proceeding anyway')
      }
    }

    onRoomJoined(
      { id: supabaseRoomId ?? '', code: myRoomCode, status: 'playing', created_by: playerId } as Room,
      'WHITE',
      playerId
    )
  }

  const whiteCount = slots.filter((s, i) => i < 2 && s.type !== 'empty').length

  const joinRoom = async () => {
    if (!joinCode.trim()) return
    console.log(`[ROOM] Joining room: code=${joinCode.toUpperCase()}`)
    setLoading(true)
    setError(null)
    try {
      console.log('[Join] Looking for room:', joinCode.toUpperCase())

      let rooms = null
      let roomError = null

      const { data: byCode, error: codeError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .single()

      if (byCode) {
        rooms = byCode
      } else {
        const { data: byId, error: idError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', joinCode)
          .single()

        if (byId) {
          rooms = byId
        } else {
          roomError = codeError || idError
        }
      }

      console.log('[Join] Room query result:', { rooms, roomError })

      if (roomError || !rooms) {
        console.error('[Join] Room not found:', roomError)
        throw new Error('Room not found - check if code is correct')
      }

      console.log('[Join] Room found:', rooms)

      if (rooms.status !== 'waiting') {
        throw new Error('Room is no longer available (status: ' + rooms.status + ')')
      }

      const { data: existingPlayers, error: playersError } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', rooms.id)

      console.log('[Join] Existing players:', { existingPlayers, playersError })

      if (playersError) {
        console.error('[Join] Players query error:', playersError)
        throw new Error('Failed to check room players')
      }

      const whiteSlots = existingPlayers?.filter(p => p.team === 'WHITE') || []
      const blackSlots = existingPlayers?.filter(p => p.team === 'BLACK') || []

      console.log('[Join] Slots - White:', whiteSlots.length, 'Black:', blackSlots.length)

      let team: 'WHITE' | 'BLACK' = 'WHITE'
      let slot = 0

      if (whiteSlots.length < 2) {
        team = 'WHITE'
        slot = whiteSlots.length
      } else if (blackSlots.length < 2) {
        team = 'BLACK'
        slot = blackSlots.length
      } else {
        throw new Error('Room is full')
      }

      console.log('[Join] Joining as team:', team, 'slot:', slot)

      const { data: existingPlayer, error: checkError } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', rooms.id)
        .eq('player_id', playerId)
        .maybeSingle()

      if (checkError) {
        console.warn('[Join] Error checking existing player:', checkError)
      }

      if (existingPlayer) {
        console.log('[Join] Already in room, waiting for host')
        setJoinedRoomCode(rooms.code)
        setFriendRoomId(rooms.id)
        setJoinedRoom(true)
        return
      }

      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: rooms.id,
          player_id: playerId,
          team,
          slot,
          status: 'waiting'
        })

      if (playerError) {
        console.error('[Join] Insert player error:', playerError)
        if (playerError.code === '409' || playerError.message.includes('duplicate')) {
          setJoinedRoomCode(rooms.code)
          setFriendRoomId(rooms.id)
          setJoinedRoom(true)
          return
        }
        throw new Error(`Failed to join: ${playerError.message}`)
      }

      console.log(`[ROOM] Joined room: code=${rooms.code} team=${team} slot=${slot}`)
      setJoinedRoomCode(rooms.code)
      setFriendRoomId(rooms.id)
      setJoinedRoom(true)
    } catch (err) {
      console.error('[Join] Full error:', err)
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-x-hidden">
      <header className="fixed top-0 w-full z-40 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50 h-14 flex items-center justify-between px-4">
        <button
          onClick={() => router.push('/')}
          className="text-xs font-bold text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Home
        </button>
        <span className="text-xl font-extrabold italic uppercase tracking-tighter text-yellow-400">ChessDuo</span>
        <button
          onClick={async () => {
            if (signingOut) return
            setSigningOut(true)
            console.log('[ROOM] Signing out...')
            try {
              await supabase.auth.signOut()
              console.log('[ROOM] Sign out complete')
            } catch (e) {
              console.warn('[ROOM] Sign out error (navigating anyway):', e)
            }
            router.push('/')
          }}
          disabled={signingOut}
          className="text-xs font-bold text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          {signingOut ? '...' : 'Sign Out'}
          <span className="material-symbols-outlined text-sm">logout</span>
        </button>
      </header>

      <main className="flex-1 pt-16 pb-8 px-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-1 mb-6 border-b border-gray-700/30">
          {(['create', 'join', 'quick'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-[1px] ${
                activeTab === tab
                  ? 'text-yellow-400 border-yellow-400'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {tab === 'create' && 'Create Room'}
              {tab === 'join' && 'Join Room'}
              {tab === 'quick' && 'Quick Match'}
            </button>
          ))}
        </div>

        {activeTab === 'quick' && (
          <div className="glass-panel rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">🏗️</div>
            <h2 className="text-base font-bold text-gray-300 mb-2">Matchmaking Coming Soon</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Automated queue will match you with players of similar skill.
              For now, create a room and share the code with friends.
            </p>
          </div>
        )}

        {activeTab === 'join' && !joinedRoom && (
          <div className="glass-panel rounded-xl p-6 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Join a Room</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={36}
                className="flex-1 p-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-center text-lg tracking-widest font-mono focus:outline-none focus:border-yellow-400 transition-colors"
              />
              <button
                onClick={joinRoom}
                disabled={loading || joinCode.length < 6}
                className="px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? '...' : 'Join'}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
            <p className="text-[10px] text-gray-500 text-center mt-3">Room code is 6 characters, e.g. XJ92K3</p>
          </div>
        )}

        {activeTab === 'join' && joinedRoom && (
          <div className="glass-panel rounded-xl p-8 text-center max-w-md mx-auto">
            <div className="text-3xl mb-3">✅</div>
            <h2 className="text-base font-bold text-green-400 mb-2">Joined Room!</h2>
            <p className="text-sm text-gray-400 mb-1">Team: WHITE · Code: {joinedRoomCode}</p>
            <p className="text-sm text-gray-500 mb-4">Waiting for host to start the match...</p>
            <div className="flex gap-1.5 justify-center">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-4 space-y-4">
                <div className="glass-panel rounded-xl p-4">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Room Config</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Game Mode</label>
                      <div className="p-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg flex items-center justify-between text-xs font-bold text-yellow-400 cursor-pointer hover:border-yellow-400/30 transition-colors">
                        <span>Competitive 2v2</span>
                        <span className="material-symbols-outlined text-xs text-gray-500">expand_more</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Time per Move</label>
                      <div className="p-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg flex items-center justify-between text-xs font-bold cursor-pointer hover:border-yellow-400/30 transition-colors">
                        <span>10s</span>
                        <span className="material-symbols-outlined text-xs text-gray-500">timer</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-4">
                  <div className="flex items-center gap-2 text-yellow-400 mb-2">
                    <span className="material-symbols-outlined text-sm">info</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Rules</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    2v2 Cooperative Chess. Both teammates submit moves simultaneously.
                    The more accurate move gets played. Bots fill empty slots.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-4">
                {myRoomCode ? (
                  <div className="glass-panel rounded-xl p-4 border-yellow-500/20 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Invite Code</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-2xl font-extrabold text-yellow-400 tracking-widest font-mono">{myRoomCode}</span>
                          <button
                            onClick={copyCode}
                            className="p-2 bg-gray-700/50 border border-gray-600/50 rounded-lg hover:bg-gray-600/50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm text-gray-300">
                              {copied ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Difficulty</span>
                        <p className="text-xs font-bold text-yellow-400 mt-0.5">{eloLabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 bg-gray-800/40 border border-gray-700/30 rounded-lg px-3 py-2">
                        <span className="material-symbols-outlined text-sm text-gray-500">link</span>
                        <span className="text-[11px] text-gray-400 font-mono truncate">
                          {typeof window !== 'undefined' ? `${window.location.origin}/join?code=${myRoomCode}` : `join?code=${myRoomCode}`}
                        </span>
                      </div>
                      <button
                        onClick={copyShareLink}
                        className="p-2 bg-gray-700/50 border border-gray-600/50 rounded-lg hover:bg-gray-600/50 transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm text-gray-300">
                          {linkCopied ? 'check' : 'content_copy'}
                        </span>
                      </button>
                      <button
                        onClick={shareInvite}
                        className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm text-yellow-400">share</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500">Share this link with a friend to join your team</p>
                  </div>
                ) : (
                  <div className="glass-panel rounded-xl p-6 text-center">
                    <p className="text-gray-400 text-sm mb-3">Create your room to get started</p>
                    <button
                      onClick={createRoom}
                      disabled={loading}
                      className="px-8 py-2.5 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors text-sm"
                    >
                      {loading ? 'Creating...' : 'Create Room'}
                    </button>
                    {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-white" />
                        TEAM WHITE
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">
                        {slots.filter((s, i) => i < 2 && s.type !== 'empty').length}/2
                      </span>
                    </div>

                    {[0, 1].map(slotIndex => {
                      const slot = slots[slotIndex]
                      const isHuman = slot.type === 'human'
                      const isEmpty = slot.type === 'empty'
                      return (
                      <div
                        key={slotIndex}
                        className={`glass-panel rounded-xl p-3 flex items-center gap-3 ${
                          isHuman ? 'border-yellow-500/30' : isEmpty ? 'border-dashed border-gray-600/40 opacity-60' : 'border-gray-700/30'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isHuman ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-gray-700/50'
                        }`}>
                          <span className="text-lg">
                            {isHuman ? '👤' : isEmpty ? '👥' : '🤖'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isEmpty ? 'text-gray-400 italic' : 'text-white'}`}>
                            {isEmpty ? 'Waiting for friend...' : slot.label}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500">
                            {slot.type === 'bot' ? (slot as { type: 'bot'; eloLabel: string }).eloLabel : isEmpty ? 'Invite a friend to join' : 'Online'}
                          </p>
                        </div>
                        {isHuman && (
                          <span className="text-[10px] font-bold uppercase text-green-400">Ready</span>
                        )}
                      </div>
                    )})}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-700 border border-gray-500" />
                        TEAM BLACK
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">2/2</span>
                    </div>

                    {[2, 3].map(slotIndex => (
                      <div
                        key={slotIndex}
                        className="glass-panel rounded-xl p-3 flex items-center gap-3 border-gray-700/30"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center">
                          <span className="text-lg">🤖</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-300 truncate">{slots[slotIndex].label}</p>
                          <p className="text-[10px] font-bold text-gray-500">
                            {(slots[slotIndex] as { type: 'bot'; eloLabel: string }).eloLabel}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-green-400">Ready</span>
                      </div>
                    ))}
                  </div>
                </div>

                {myRoomCode && (
                  <div>
                    <button
                      onClick={startMatch}
                      disabled={whiteCount < 2}
                      className={`w-full py-3 rounded-xl font-extrabold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                        whiteCount < 2
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-yellow-500 text-gray-900 hover:bg-yellow-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      {whiteCount < 2 ? 'WAITING FOR FRIEND' : 'START MATCH'}
                    </button>
                    {whiteCount < 2 && (
                      <p className="text-center text-[10px] text-gray-500 mt-1">
                        Ask your friend to join via the invite link above
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
