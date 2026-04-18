'use client'

import { useState, useEffect } from 'react'
import { supabase, Room, RoomPlayer, Profile } from '@/lib/supabase'

interface RoomProps {
  playerId: string
  username: string
  onRoomJoined: (room: Room, team: 'WHITE' | 'BLACK') => void
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function RoomManager({ playerId, username, onRoomJoined }: RoomProps) {
  const [joinCode, setJoinCode] = useState('')
  const [myRoomCode, setMyRoomCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([])

  const createRoom = async () => {
    setLoading(true)
    setError(null)
    try {
      const code = generateRoomCode()
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code,
          status: 'waiting',
          created_by: playerId
        })
        .select()
        .single()

      if (roomError) throw roomError

      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: room.id,
          player_id: playerId,
          team: 'WHITE',
          slot: 0,
          status: 'waiting'
        })

      if (playerError) throw playerError

      setMyRoomCode(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async () => {
    if (!joinCode.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .single()

      if (roomError || !rooms) {
        throw new Error('Room not found')
      }

      if (rooms.status !== 'waiting') {
        throw new Error('Room is no longer available')
      }

      const { data: existingPlayers, error: playersError } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', rooms.id)

      if (playersError) throw playersError

      const whiteSlots = existingPlayers?.filter(p => p.team === 'WHITE') || []
      const blackSlots = existingPlayers?.filter(p => p.team === 'BLACK') || []

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

      const { error: playerError } = await supabase
        .from('room_players')
        .insert({
          room_id: rooms.id,
          player_id: playerId,
          team,
          slot,
          status: 'waiting'
        })

      if (playerError) throw playerError

      onRoomJoined(rooms as Room, team)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-yellow-400">
          ♟️ ChessDuo
        </h1>
        <h2 className="text-xl text-center mb-6 text-white">
          Game Rooms
        </h2>

        <div className="space-y-4">
          <button
            onClick={createRoom}
            disabled={loading}
            className="w-full p-4 bg-yellow-500 text-gray-900 font-bold rounded hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create New Room'}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-500 text-sm">OR</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="flex-1 p-4 bg-gray-700 text-white rounded border border-gray-600 focus:border-yellow-400 focus:outline-none text-center text-xl tracking-widest font-mono"
            />
            <button
              onClick={joinRoom}
              disabled={loading || joinCode.length < 6}
              className="p-4 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 disabled:opacity-50"
            >
              Join
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-center">{error}</p>
          )}

          {myRoomCode && (
            <div className="mt-6 p-4 bg-gray-700 rounded">
              <p className="text-gray-400 text-center mb-2">Share this code with your teammate:</p>
              <p className="text-3xl font-bold text-center text-yellow-400 tracking-widest font-mono">
                {myRoomCode}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}