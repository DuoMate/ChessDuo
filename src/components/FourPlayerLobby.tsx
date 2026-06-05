'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getFourPlayerSeats,
  joinFourPlayerRoom,
  leaveFourPlayerRoom,
  areAllSeatsFilled,
  FourPlayerSeat,
} from '@/lib/fourPlayerActions'

interface FourPlayerLobbyProps {
  roomId: string
  roomCode: string
  playerId: string
  timeSeconds: number
  username?: string
}

type LobbyPhase = 'loading' | 'team-select' | 'waiting' | 'starting' | 'error'

export function FourPlayerLobby({
  roomId,
  roomCode,
  playerId,
  timeSeconds,
  username,
}: FourPlayerLobbyProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<LobbyPhase>('loading')
  const [seats, setSeats] = useState<FourPlayerSeat[]>([])
  const [selectedTeam, setSelectedTeam] = useState<'WHITE' | 'BLACK' | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?code=${roomCode}`
    : null

  const fetchSeats = useCallback(async () => {
    try {
      const currentSeats = await getFourPlayerSeats(roomId)
      setSeats(currentSeats)
      return currentSeats
    } catch (err) {
      console.error('Failed to fetch seats:', err)
      return null
    }
  }, [roomId])

  useEffect(() => {
    const init = async () => {
      const currentSeats = await fetchSeats()
      if (!currentSeats) {
        setPhase('error')
        setError('Failed to load lobby')
        return
      }

      const mySeat = currentSeats.find(s => s.playerId === playerId)
      if (mySeat) {
        setSelectedTeam(mySeat.team)
        setSelectedSlot(mySeat.slot)
        setPhase('waiting')
      } else {
        setPhase('team-select')
      }
    }
    init()
  }, [roomId, playerId, fetchSeats])

  useEffect(() => {
    if (phase !== 'waiting') return

    const interval = setInterval(async () => {
      const currentSeats = await fetchSeats()
      if (!currentSeats) return

      if (areAllSeatsFilled(currentSeats)) {
        setPhase('starting')
        clearInterval(interval)
        setTimeout(() => {
          router.push(
            `/game?mode=online&room=${roomId}&code=${roomCode}&team=${selectedTeam}&playerId=${playerId}&time=${timeSeconds}`
          )
        }, 1500)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [phase, roomId, roomCode, selectedTeam, playerId, timeSeconds, router, fetchSeats])

  const handleJoinSeat = async (team: 'WHITE' | 'BLACK', slot: number) => {
    try {
      setError(null)
      await joinFourPlayerRoom({ roomId, playerId, team, slot })
      setSelectedTeam(team)
      setSelectedSlot(slot)
      setPhase('waiting')
      await fetchSeats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join seat')
    }
  }

  const handleLeave = async () => {
    try {
      await leaveFourPlayerRoom({ roomId, playerId })
      setSelectedTeam(null)
      setSelectedSlot(null)
      setPhase('team-select')
      await fetchSeats()
    } catch (err) {
      console.error('Failed to leave:', err)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
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

  const handleExit = async () => {
    if (selectedTeam !== null) {
      await leaveFourPlayerRoom({ roomId, playerId })
    }
    router.push('/')
  }

  const filledCount = seats.filter(s => s.playerId !== null).length

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1119] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center">
          <div className="text-center mb-6">
            <div className="text-[42px] mb-2">♖♜</div>
            <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">
              Four Player Lobby
            </h1>
            <p className="text-[12px] text-gray-700 dark:text-gray-400 mt-1 font-medium">
              2 Friends vs 2 Friends
            </p>
          </div>

          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Loading lobby...</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="w-full px-5 py-4 bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 rounded-2xl text-center mb-4">
              <p className="text-red-700 dark:text-red-400 text-sm font-medium mb-3">{error}</p>
              <button
                onClick={handleExit}
                className="min-h-[44px] px-6 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 font-medium rounded-xl transition-colors"
              >
                Back to Home
              </button>
            </div>
          )}

          {phase === 'team-select' && (
            <div className="w-full mb-6">
              <p className="text-xs text-gray-800 dark:text-gray-300 tracking-[0.15em] uppercase mb-3 font-semibold text-center">
                Pick your team and seat
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {seats.map((seat) => {
                  const isAvailable = seat.playerId === null
                  return (
                    <button
                      key={`${seat.team}-${seat.slot}`}
                      onClick={() => isAvailable && handleJoinSeat(seat.team, seat.slot)}
                      disabled={!isAvailable}
                      className={`p-4 rounded-xl border-2 text-center transition-all min-h-[88px] ${
                        isAvailable
                          ? 'border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] hover:border-blue-400 dark:hover:border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer'
                          : 'border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-white/[0.02] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className={`text-[11px] font-bold tracking-wider uppercase mb-1 ${
                        seat.team === 'WHITE' ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {seat.team}
                      </div>
                      <div className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">
                        Seat {seat.slot + 1}
                      </div>
                      {isAvailable ? (
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          Available
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                          {seat.username || 'Player'}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {error && (
                <p className="text-red-600 dark:text-red-400 text-sm text-center font-medium mb-3">
                  {error}
                </p>
              )}
            </div>
          )}

          {phase === 'waiting' && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                  Connected — {selectedTeam} Team, Seat {(selectedSlot ?? 0) + 1}
                </span>
              </div>

              <p className="text-xs text-gray-800 dark:text-gray-300 tracking-[0.15em] uppercase mb-2 font-semibold text-center">
                {filledCount} of 4 players joined
              </p>

              <div className="w-full grid grid-cols-2 gap-2 mb-4">
                {seats.map((seat) => {
                  const isMe = seat.playerId === playerId
                  const isFilled = seat.playerId !== null
                  return (
                    <div
                      key={`${seat.team}-${seat.slot}`}
                      className={`p-3 rounded-xl border-2 text-center ${
                        isMe
                          ? 'border-blue-400 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10'
                          : isFilled
                          ? 'border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03]'
                          : 'border-dashed border-gray-300 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.01]'
                      }`}
                    >
                      <div className={`text-[10px] font-bold tracking-wider uppercase mb-0.5 ${
                        seat.team === 'WHITE' ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {seat.team}
                      </div>
                      <div className="text-[12px] font-semibold text-gray-900 dark:text-white">
                        {isFilled ? (isMe ? `${username || 'You'} ★` : seat.username || 'Player') : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={handleLeave}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mb-4 font-medium"
              >
                Change seat
              </button>
            </>
          )}

          {phase === 'starting' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                All seats filled! Starting game...
              </p>
            </div>
          )}

          {phase !== 'loading' && phase !== 'error' && phase !== 'starting' && (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400 tracking-[0.15em] uppercase mb-2">
                Share this code with 3 friends
              </p>

              <div className="w-full px-5 py-4 bg-gray-50 dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/8 text-center mb-3">
                <p className="font-mono font-bold text-amber-500 tracking-[0.2em] select-all mb-3 text-xl dark:text-amber-400">
                  {roomCode}
                </p>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors min-h-[44px] px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  {copied ? (
                    <>
                      <span className="text-emerald-600 dark:text-emerald-400">✓ Copied</span>
                    </>
                  ) : (
                    <>
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>

              {inviteUrl && (
                <>
                  <p className="text-xs text-gray-600 dark:text-gray-400 tracking-[0.15em] uppercase mb-2">
                    Or share the invite link
                  </p>

                  <div className="w-full px-5 py-4 bg-gray-50 dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/8 text-center mb-4">
                    <div className="flex gap-2">
                      <button
                        onClick={handleShare}
                        className="flex-1 min-h-[44px] rounded-xl bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-sm transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        Share link
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="min-h-[44px] min-w-[44px] rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors inline-flex items-center justify-center"
                        title={linkCopied ? 'Copied' : 'Copy link'}
                      >
                        {linkCopied ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span>Copy</span>}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={handleExit}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors min-h-[44px] px-4 py-2 font-medium"
              >
                ← Leave lobby
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
