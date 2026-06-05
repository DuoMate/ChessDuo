import { supabase } from '@/lib/supabase'
import { generateRoomCode } from '@/lib/roomActions'

export interface FourPlayerRoom {
  roomId: string
  roomCode: string
  timeSeconds: number
}

export interface FourPlayerSeat {
  team: 'WHITE' | 'BLACK'
  slot: number
  playerId: string | null
  username: string | null
  status: 'empty' | 'joined' | 'ready'
}

export async function createFourPlayerRoom(options: {
  playerId: string
  timeSeconds: number
}): Promise<FourPlayerRoom> {
  const { playerId, timeSeconds } = options
  const code = generateRoomCode()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      code,
      status: 'waiting',
      created_by: playerId,
      time_seconds: timeSeconds,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (roomError || !room) {
    throw new Error(roomError?.message || 'Failed to create room')
  }

  return {
    roomId: room.id,
    roomCode: room.code,
    timeSeconds,
  }
}

export async function joinFourPlayerRoom(options: {
  roomId: string
  playerId: string
  team: 'WHITE' | 'BLACK'
  slot: number
}): Promise<void> {
  const { roomId, playerId, team, slot } = options

  const { error } = await supabase
    .from('room_players')
    .upsert({
      room_id: roomId,
      player_id: playerId,
      team,
      slot,
      status: 'ready',
    }, { onConflict: 'room_id,player_id' })

  if (error) {
    throw new Error(error.message || 'Failed to join room')
  }
}

export async function leaveFourPlayerRoom(options: {
  roomId: string
  playerId: string
}): Promise<void> {
  const { roomId, playerId } = options

  await supabase
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', playerId)
}

export async function getFourPlayerSeats(roomId: string): Promise<FourPlayerSeat[]> {
  const { data: players, error } = await supabase
    .from('room_players')
    .select('player_id, team, slot, status')
    .eq('room_id', roomId)

  if (error) {
    throw new Error(error.message || 'Failed to fetch seats')
  }

  const seats: FourPlayerSeat[] = [
    { team: 'WHITE', slot: 0, playerId: null, username: null, status: 'empty' },
    { team: 'WHITE', slot: 1, playerId: null, username: null, status: 'empty' },
    { team: 'BLACK', slot: 0, playerId: null, username: null, status: 'empty' },
    { team: 'BLACK', slot: 1, playerId: null, username: null, status: 'empty' },
  ]

  for (const p of players || []) {
    const idx = seats.findIndex(s => s.team === p.team && s.slot === p.slot)
    if (idx !== -1) {
      seats[idx].playerId = p.player_id
      seats[idx].status = p.status === 'ready' ? 'ready' : 'joined'
    }
  }

  const playerIds = seats.filter(s => s.playerId).map(s => s.playerId!)
  if (playerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', playerIds)

    for (const seat of seats) {
      const profile = profiles?.find(p => p.id === seat.playerId)
      if (profile) seat.username = profile.username
    }
  }

  return seats
}

export function areAllSeatsFilled(seats: FourPlayerSeat[]): boolean {
  return seats.every(s => s.playerId !== null)
}
