'use client'

import { useState, useEffect } from 'react'
import { supabase, Room, RoomPlayer, Profile } from '@/lib/supabase'

interface RoomProps {
  playerId: string
  username: string
  onRoomJoined: (room: Room, team: 'WHITE' | 'BLACK') => void
}

export function generateRoomCode(): string {
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
      console.log('[Room] Creating room...')
      const code = generateRoomCode()
      
      // First, let's try to check if table exists by selecting
      const { data: testData, error: testError } = await supabase
        .from('rooms')
        .select('id')
        .limit(1)
      
      console.log('[Room] Table test:', { testData, testError })
      
      if (testError) {
        console.error('[Room] Table check failed:', testError)
        throw new Error(`Database table 'rooms' not accessible: ${testError.message}. Please create tables in Supabase.`)
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
        console.error('[Room] Create room error:', roomError)
        throw new Error(`Insert error: ${roomError.message}`)
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

      if (playerError) throw playerError

       setMyRoomCode(code)
       // Automatically join the creator to the match
       onRoomJoined(room as Room, 'WHITE')
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
      console.log('[Join] Looking for room:', joinCode.toUpperCase())
      
      // Try to find by code first (6-char code), then by ID (UUID)
      let rooms = null
      let roomError = null
      
      // First try as room code
      const { data: byCode, error: codeError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .single()
      
      if (byCode) {
        rooms = byCode
      } else {
        // If not found by code, try as UUID
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

      // Check if player already in room
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
        console.log('[Join] Already in room, joining existing')
        onRoomJoined(rooms as Room, existingPlayer.team)
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
        // Handle 409 conflict - already joined
        if (playerError.code === '409' || playerError.message.includes('duplicate')) {
          onRoomJoined(rooms as Room, team)
          return
        }
        throw new Error(`Failed to join: ${playerError.message}`)
      }

      onRoomJoined(rooms as Room, team)
    } catch (err) {
      console.error('[Join] Full error:', err)
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
               placeholder="Enter room code or URL"
               value={joinCode}
               onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
               maxLength={36}
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