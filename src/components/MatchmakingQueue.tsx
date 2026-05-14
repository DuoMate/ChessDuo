'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { findAvailableRoom, createQuickMatchRoom, joinQuickMatchRoom } from '@/lib/matchmaking'
import { Room } from '@/lib/supabase'

type Status = 'searching' | 'creating' | 'waiting' | 'joining' | 'error'

interface MatchmakingQueueProps {
  playerId: string
  username: string
  onRoomJoined: (room: Room, team: 'WHITE' | 'BLACK', playerId: string) => void
  onCancel: () => void
}

export function MatchmakingQueue({ playerId, username, onRoomJoined, onCancel }: MatchmakingQueueProps) {
  const [status, setStatus] = useState<Status>('searching')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retries, setRetries] = useState(0)

  useEffect(() => {
    let cancelled = false

    const attemptMatch = async () => {
      setStatus('searching')
      setError(null)

      try {
        const match = await findAvailableRoom(playerId)
        if (cancelled) return

        if (match) {
          setStatus('joining')
          const joined = await joinQuickMatchRoom(match.room.id, playerId, match.team, match.slot)
          if (cancelled) return

          if (joined) {
            onRoomJoined(match.room, match.team, playerId)
            return
          }
          setError('Failed to join room')
          setStatus('error')
          return
        }

        // No rooms available — create one
        setStatus('creating')
        const room = await createQuickMatchRoom(playerId)
        if (cancelled) return

        if (room) {
          setRoomCode(room.code)
          setStatus('waiting')
          return
        }

        setError('Failed to create room')
        setStatus('error')
      } catch {
        if (!cancelled) {
          setError('Something went wrong')
          setStatus('error')
        }
      }
    }

    attemptMatch()
    return () => { cancelled = true }
  }, [playerId, retries])

  // Poll for match while waiting
  useEffect(() => {
    if (status !== 'waiting') return

    const interval = setInterval(async () => {
      const match = await findAvailableRoom(playerId)
      if (match) {
        const joined = await joinQuickMatchRoom(match.room.id, playerId, match.team, match.slot)
        if (joined) {
          onRoomJoined(match.room, match.team, playerId)
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [status, playerId, onRoomJoined])

  return (
    <div className="min-h-screen bg-[#0f1119] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="text-[42px] mb-4 drop-shadow-[0_0_20px_rgba(250,204,21,0.2)]">
          {"\u265A"}
        </div>

        <h2 className="text-2xl font-black text-yellow-400 tracking-wider mb-2">Quick Match</h2>

        {status === 'searching' && (
          <div className="mt-6 space-y-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-10 h-10 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full mx-auto"
            />
            <p className="text-gray-400 text-sm">Searching for opponent...</p>
          </div>
        )}

        {status === 'creating' && (
          <div className="mt-6 space-y-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-10 h-10 bg-yellow-400/10 border border-yellow-400/20 rounded-xl mx-auto flex items-center justify-center text-xl"
            >
              {"\u265E"}
            </motion.div>
            <p className="text-gray-400 text-sm">Creating room...</p>
          </div>
        )}

        {status === 'joining' && (
          <div className="mt-6 space-y-3">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-xl mx-auto flex items-center justify-center text-xl"
            >
              {"\u2713"}
            </motion.div>
            <p className="text-green-400 text-sm">Match found! Joining...</p>
          </div>
        )}

        {status === 'waiting' && roomCode && (
          <div className="mt-6 space-y-4">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-gray-400 text-sm"
            >
              Waiting for opponent to join...
            </motion.div>
            <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Share this code</p>
              <p className="text-3xl font-bold text-yellow-400 tracking-[0.15em] font-mono select-all">
                {roomCode}
              </p>
            </div>
            <p className="text-[11px] text-gray-600">
              Or wait — someone will join automatically
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-6 space-y-4">
            <p className="text-red-400 text-sm">{error || 'Something went wrong'}</p>
            <button
              onClick={() => setRetries(r => r + 1)}
              className="px-6 py-2 bg-white/[0.05] border border-white/10 rounded-xl text-gray-300 text-sm hover:bg-white/[0.08] transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        <button
          onClick={onCancel}
          className="mt-8 text-gray-500 hover:text-gray-400 text-sm transition-colors"
        >
          {"\u2190"} Cancel
        </button>
      </motion.div>
    </div>
  )
}
