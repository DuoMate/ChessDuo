'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?code=${roomCode}`
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
    router.push(`/game?mode=online&room=${roomId}&code=${roomCode}&team=${me.team}&playerId=${playerId}&time=${timeSeconds}&fourplayer=1`)
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

    router.push(`/game?mode=online&room=${roomId}&code=${roomCode}&team=${me.team}&playerId=${playerId}&time=${timeSeconds}`)
  }

  const handleLeave = async () => {
    await leaveFourPlayerRoom({ roomId, playerId })
    router.push('/')
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
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'ChessDuo — Join our 2v2 game!',
        text: `Join our 4-player ChessDuo game! Room code: ${roomCode}`,
        url: inviteUrl,
      }).catch(() => {})
    } else {
      handleCopyLink()
    }
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
      className={`flex-1 min-h-[140px] rounded-xl border-2 border-dashed p-3 transition-colors ${
        dragOverTeam === team
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10'
          : 'border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]'
      }`}
    >
      <p className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-2">
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
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg mb-1.5 text-sm transition-colors cursor-default ${
            p.playerId === playerId
              ? 'bg-blue-100 dark:bg-blue-500/15 border border-blue-300 dark:border-blue-500/30'
              : 'bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10'
          } ${isCreator ? 'cursor-grab active:cursor-grabbing' : ''}`}
          title={isCreator ? 'Drag to other team or click to unassign' : ''}
        >
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {p.playerId === playerId ? (username || 'You') : (p.username || 'Player')}
          </span>
          {isCreator && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">⠿</span>
          )}
        </div>
      ))}
      {team === 'WHITE' && whitePlayers.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Drop players here</p>
      )}
      {team === 'BLACK' && blackPlayers.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Drop players here</p>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1119] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {view === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Loading lobby...</p>
          </div>
        )}

        {view === 'error' && (
          <div className="w-full px-5 py-4 bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 rounded-2xl text-center mb-4">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium mb-3">{error || 'Failed to load lobby'}</p>
            <button
              onClick={() => router.push('/')}
              className="min-h-[44px] px-6 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 font-medium rounded-xl transition-colors"
            >
              Back to Home
            </button>
          </div>
        )}

        {view === 'starting' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Starting game...</p>
          </div>
        )}

        {view === 'lobby' && (
          <div className="flex flex-col items-center">
            <div className="text-center mb-4">
              <div className="text-[42px] mb-2">♖♜</div>
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">
                Four Player Lobby
              </h1>
              <p className="text-[12px] text-gray-700 dark:text-gray-400 mt-1 font-medium">
                2 Friends vs 2 Friends
              </p>
            </div>

            <div className="w-full mb-3 text-center">
              <p className="text-xs text-gray-800 dark:text-gray-300 tracking-[0.15em] uppercase font-semibold">
                Room Code
              </p>
              <p className="font-mono font-bold text-amber-500 dark:text-amber-400 tracking-[0.2em] select-all text-xl mt-1">
                {roomCode}
              </p>
              <div className="flex justify-center gap-2 mt-2">
                <button onClick={handleCopyCode} className="min-h-[44px] px-5 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all">
                  {copied ? '✓ Copied' : 'Copy code'}
                </button>
                {inviteUrl && (
                  <button onClick={handleShare} className="min-h-[44px] px-5 py-2 text-xs font-semibold rounded-xl bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 transition-all">
                    Share link
                  </button>
                )}
              </div>
            </div>

            {isCreator && (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-3">
                You are the captain — drag players to teams
              </p>
            )}

            <div className="w-full flex gap-3 mb-4">
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
                className="w-full mb-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] p-3"
              >
                <p className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-2">
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1.5 text-sm transition-colors ${
                      p.playerId === playerId
                        ? 'bg-blue-100 dark:bg-blue-500/15 border border-blue-300 dark:border-blue-500/30'
                        : 'bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10'
                    } ${isCreator ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {p.playerId === playerId ? (username || 'You') : (p.username || 'Player')}
                    </span>
                    {isCreator && p.playerId !== playerId && (
                      <span className="text-[10px] text-blue-500 ml-auto shrink-0">
                        Click to assign
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-4">
              {joinedCount < 4
                ? `${joinedCount} of 4 joined — waiting for others...`
                : teamsReady
                ? 'All players assigned! Ready to start.'
                : `${joinedCount} of 4 joined — captain needs to assign teams`}
            </p>

            {error && (
              <p className="text-red-600 dark:text-red-400 text-xs font-medium mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleLeave}
                className="min-h-[44px] px-5 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-white/5"
              >
                ← Leave lobby
              </button>

              {teamsReady && (
                <button
                  onClick={handleStart}
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  ▶ Start Match
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
