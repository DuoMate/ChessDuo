'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Crown, Copy, Share2, CheckCircle2, User, Loader2, Sparkles } from 'lucide-react'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { Spinner } from '@/components/Spinner'
import { supabase } from '@/lib/supabase'
import { getAppBaseUrl } from '@/lib/appUrl'
import { shareLink } from '@/lib/share'
import {
  getLobbyPlayers,
  joinLobby,
  assignPlayer,
  unassignPlayer,
  leaveFourPlayerRoom,
  areTeamsReady,
  LobbyPlayer,
} from '@/lib/fourPlayerActions'

interface FourPlayerLobbyProps {
  roomId: string
  roomCode: string
  playerId: string
  timeSeconds: number
  username?: string
}

type LobbyView = 'loading' | 'lobby' | 'starting' | 'error'

export function FourPlayerLobby({
  roomId,
  roomCode,
  playerId,
  timeSeconds,
  username,
}: FourPlayerLobbyProps) {
  const router = useRouter()
  const [view, setView] = useState<LobbyView>('loading')
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [isCreator, setIsCreator] = useState(false)
  const [dragOverTeam, setDragOverTeam] = useState<'WHITE' | 'BLACK' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useCapacitorBackButton(
    () => {
      handleLeave()
      return true
    },
    view === 'lobby' || view === 'loading' || view === 'starting'
  )

  const inviteUrl = typeof window !== 'undefined'
    ? `${getAppBaseUrl()}/?code=${roomCode}`
    : null

  const fetchPlayers = useCallback(async () => {
    try {
      const result = await getLobbyPlayers(roomId)
      setPlayers(result)
      return result
    } catch {
      return null
    }
  }, [roomId])

  useEffect(() => {
    const init = async () => {
      const { data: room } = await supabase
        .from('rooms')
        .select('created_by, status')
        .eq('id', roomId)
        .single()

      if (!room) {
        setView('error')
        setError('Room not found')
        return
      }

      if (room.status === 'playing') {
        const currentPlayers = await fetchPlayers()
        const me = currentPlayers?.find(p => p.playerId === playerId)
        if (me?.team) {
          router.replace(`/game?mode=online&room=${roomId}&code=${roomCode}&team=${me.team}&playerId=${playerId}&time=${timeSeconds}`)
        }
        return
      }

      setIsCreator(room.created_by === playerId)

      const currentPlayers = await fetchPlayers()
      const alreadyJoined = currentPlayers?.some(p => p.playerId === playerId)
      if (!alreadyJoined) {
        await joinLobby({ roomId, playerId })
        await fetchPlayers()
      }

      setView('lobby')
    }

    init()
  }, [roomId, playerId, roomCode, timeSeconds, router, fetchPlayers])

  useEffect(() => {
    if (view !== 'lobby') return

    const interval = setInterval(async () => {
      const currentPlayers = await fetchPlayers()
      if (!currentPlayers) return

      const { data: room } = await supabase
        .from('rooms')
        .select('status')
        .eq('id', roomId)
        .single()

      if (room?.status === 'playing') {
        clearInterval(interval)
        const me = currentPlayers.find(p => p.playerId === playerId)
        if (me?.team) {
    router.replace(`/game?mode=online&room=${roomId}&code=${roomCode}&team=${me.team}&playerId=${playerId}&time=${timeSeconds}&fourplayer=1`)
        }
        return
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [view, roomId, roomCode, playerId, timeSeconds, router, fetchPlayers])

  useEffect(() => {
    return () => {
      clearTimeout(copiedTimerRef.current)
      clearTimeout(linkCopiedTimerRef.current)
    }
  }, [])

  const findFreeSlot = (team: 'WHITE' | 'BLACK'): number | null => {
    const occupied = players.filter(p => p.team === team).length
    if (occupied >= 2) return null
    return occupied === 0 ? 0 : 1
  }

  const handleDrop = async (droppedPlayerId: string, targetTeam: 'WHITE' | 'BLACK') => {
    if (!isCreator) return
    setDragOverTeam(null)
    setError(null)

    const targetPlayer = players.find(p => p.playerId === droppedPlayerId)
    if (!targetPlayer) return

    if (targetPlayer.team === targetTeam) return

    const freeSlot = findFreeSlot(targetTeam)
    if (freeSlot === null) {
      setError('Team is full')
      return
    }

    try {
      await assignPlayer({ roomId, playerId: droppedPlayerId, team: targetTeam, slot: freeSlot })
      await fetchPlayers()
    } catch {
      setError('Failed to assign player')
    }
  }

  const handleUnassign = async (droppedPlayerId: string) => {
    if (!isCreator) return
    setDragOverTeam(null)
    setError(null)

    try {
      await unassignPlayer({ roomId, playerId: droppedPlayerId })
      await fetchPlayers()
    } catch {
      setError('Failed to unassign player')
    }
  }

  const handleStart = async () => {
    const me = players.find(p => p.playerId === playerId)
    if (!me?.team) return

    await supabase
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', roomId)

    router.replace(`/game?mode=online&room=${roomId}&code=${roomCode}&team=${me.team}&playerId=${playerId}&time=${timeSeconds}`)
  }

  const handleLeave = async () => {
    sessionStorage.setItem(`chessduo_left_${roomCode}`, 'true')
    await leaveFourPlayerRoom({ roomId, playerId })
    router.replace('/')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setLinkCopied(true)
    clearTimeout(linkCopiedTimerRef.current)
    linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleShare = () => {
    if (!inviteUrl || !roomCode) return
    shareLink({
      title: 'ChessDuo — Join our 2v2 game!',
      text: `Join our 4-player ChessDuo game! Room code: ${roomCode}`,
      url: inviteUrl,
    })
  }

  const handleClickCard = async (targetPlayer: LobbyPlayer) => {
    if (!isCreator || targetPlayer.playerId === playerId) return

    setError(null)

    if (targetPlayer.team) {
      const freeSlot = findFreeSlot(targetPlayer.team === 'WHITE' ? 'BLACK' : 'WHITE')
      if (freeSlot !== null) {
        await assignPlayer({
          roomId,
          playerId: targetPlayer.playerId,
          team: targetPlayer.team === 'WHITE' ? 'BLACK' : 'WHITE',
          slot: freeSlot,
        })
        await fetchPlayers()
      }
    } else {
      const freeWhite = findFreeSlot('WHITE')
      if (freeWhite !== null) {
        await assignPlayer({ roomId, playerId: targetPlayer.playerId, team: 'WHITE', slot: freeWhite })
        await fetchPlayers()
        return
      }
      const freeBlack = findFreeSlot('BLACK')
      if (freeBlack !== null) {
        await assignPlayer({ roomId, playerId: targetPlayer.playerId, team: 'BLACK', slot: freeBlack })
        await fetchPlayers()
      }
    }
  }

  const myPlayer = players.find(p => p.playerId === playerId)
  const joinedCount = players.length
  const teamsReady = areTeamsReady(players)

  const whitePlayers = players.filter(p => p.team === 'WHITE')
  const blackPlayers = players.filter(p => p.team === 'BLACK')
  const unassignedPlayers = players.filter(p => p.team === null)

  const renderDropZone = (team: 'WHITE' | 'BLACK') => (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverTeam(team) }}
      onDragLeave={() => setDragOverTeam(null)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOverTeam(null)
        const id = e.dataTransfer.getData('text/plain')
        if (id) handleDrop(id, team)
      }}
      className={`flex-1 min-h-[140px] rounded-2xl border-2 border-dashed p-3 transition-colors ${
        dragOverTeam === team
          ? 'border-indigo-400 bg-indigo-50/80 dark:bg-indigo-500/10'
          : 'border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/70'
      }`}
    >
      <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-2">
        {team}
      </p>
      {(team === 'WHITE' ? whitePlayers : blackPlayers).map(p => (
        <div
          key={p.playerId}
          draggable={isCreator}
          onDragStart={(e) => {
            if (!isCreator) return
            e.dataTransfer.setData('text/plain', p.playerId)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onClick={() => isCreator && handleUnassign(p.playerId)}
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl mb-1.5 text-sm transition-colors cursor-default ${
            p.playerId === playerId
              ? 'bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/30'
              : 'bg-white/80 border border-slate-200/80 dark:bg-slate-800/70 dark:border-slate-700/70'
          } ${isCreator ? 'cursor-grab active:cursor-grabbing' : ''}`}
          title={isCreator ? 'Drag to other team or click to unassign' : ''}
        >
          <span className="min-w-0 flex-1 font-medium text-slate-900 dark:text-white truncate">
            {p.playerId === playerId ? (username || 'You') : (p.username || 'Player')}
          </span>
          {isCreator && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">⠿</span>
          )}
        </div>
      ))}
      {(team === 'WHITE' && whitePlayers.length === 0) && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Drop players here</p>
      )}
      {(team === 'BLACK' && blackPlayers.length === 0) && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Drop players here</p>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.16),_transparent_24%)] p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="my-auto w-full max-w-lg overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-[0_20px_80px_rgba(2,6,23,0.36)] sm:p-8"
      >
        {view === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner size="md" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading lobby...</p>
          </div>
        )}

        {view === 'error' && (
          <div className="mb-4 w-full rounded-[22px] border border-rose-200 bg-rose-50/80 px-5 py-4 text-center dark:border-rose-500/20 dark:bg-rose-500/10">
            <p className="mb-3 text-sm font-medium text-rose-700 dark:text-rose-400">{error || 'Failed to load lobby'}</p>
            <button
              onClick={() => router.replace('/')}
              className="min-h-[44px] rounded-2xl bg-rose-100 px-6 py-2 font-medium text-rose-700 transition-colors hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/30"
            >
              Back to Home
            </button>
          </div>
        )}

        {view === 'starting' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner size="md" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Starting game...</p>
          </div>
        )}

        {view === 'lobby' && (
          <div className="flex flex-col items-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-3 inline-block"
            >
              <Crown size={36} className="text-amber-400 drop-shadow-lg" strokeWidth={1.5} />
            </motion.div>

            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 shadow-sm dark:text-amber-300">
              <Sparkles size={12} />
              2v2 Lobby
            </div>

            <h1 className="mt-2 text-2xl font-black tracking-wider text-amber-600 dark:text-amber-400">
              Four Player Lobby
            </h1>
            <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              2 Friends vs 2 Friends
            </p>

            <div className="mt-5 mb-4 w-full text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                Room Code
              </p>
              <p className="mt-1 select-all font-mono text-xl font-bold tracking-[0.2em] text-amber-600 dark:text-amber-400">
                {roomCode}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-amber-400"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy code
                    </>
                  )}
                </button>
                {inviteUrl && (
                  <button
                    onClick={handleShare}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                  >
                    <Share2 size={14} /> Share link
                  </button>
                )}
              </div>
            </div>

            {isCreator && (
              <p className="mb-3 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                You are the captain — drag players to teams
              </p>
            )}

            <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row">
              {renderDropZone('WHITE')}
              {renderDropZone('BLACK')}
            </div>

            {unassignedPlayers.length > 0 && (
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain')
                  if (id) handleUnassign(id)
                }}
                className="mb-4 w-full rounded-2xl border-2 border-dashed border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-700/70 dark:bg-slate-800/70"
              >
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Unassigned
                </p>
                {unassignedPlayers.map(p => (
                  <div
                    key={p.playerId}
                    draggable={isCreator}
                    onDragStart={(e) => {
                      if (!isCreator) return
                      e.dataTransfer.setData('text/plain', p.playerId)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => handleClickCard(p)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl mb-1.5 text-sm transition-colors ${
                      p.playerId === playerId
                        ? 'bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/30'
                        : 'bg-white/80 border border-slate-200/80 dark:bg-slate-800/70 dark:border-slate-700/70'
                    } ${isCreator ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span className="min-w-0 flex-1 font-medium text-slate-900 dark:text-white truncate">
                      {p.playerId === playerId ? (username || 'You') : (p.username || 'Player')}
                    </span>
                    {isCreator && p.playerId !== playerId && (
                      <span className="ml-auto shrink-0 text-[11px] text-indigo-600 dark:text-indigo-400">
                        Click to assign
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mb-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              {joinedCount < 4
                ? `${joinedCount} of 4 joined — waiting for others...`
                : teamsReady
                ? 'All players assigned! Ready to start.'
                : `${joinedCount} of 4 joined — captain needs to assign teams`}
            </p>

            {error && (
              <p className="mb-3 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={handleLeave}
                className="min-h-[44px] rounded-2xl px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                ← Leave lobby
              </button>

              {teamsReady && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStart}
                  className="min-h-[44px] rounded-2xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-500"
                >
                  ▶ Start Match
                </motion.button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
