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
      mode: 'fourplayer',
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

export interface LobbyPlayer {
  playerId: string
  username: string | null
  team: 'WHITE' | 'BLACK' | null
  slot: number | null
  status: 'joined' | 'ready' | 'locked'
}

export async function joinLobby(options: {
  roomId: string
  playerId: string
}): Promise<void> {
  const { roomId, playerId } = options
  await supabase
    .from('room_players')
    .upsert({
      room_id: roomId,
      player_id: playerId,
      status: 'joined',
    }, { onConflict: 'room_id,player_id' })
}

export async function assignPlayer(options: {
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
  if (error) throw new Error(error.message)
}

export async function unassignPlayer(options: {
  roomId: string
  playerId: string
}): Promise<void> {
  const { roomId, playerId } = options
  const { error } = await supabase
    .from('room_players')
    .upsert({
      room_id: roomId,
      player_id: playerId,
      team: null,
      slot: null,
      status: 'joined',
    }, { onConflict: 'room_id,player_id' })
  if (error) throw new Error(error.message)
}

export async function getLobbyPlayers(roomId: string): Promise<LobbyPlayer[]> {
  const { data: players, error } = await supabase
    .from('room_players')
    .select('player_id, team, slot, status')
    .eq('room_id', roomId)

  if (error) {
    throw new Error(error.message || 'Failed to fetch lobby players')
  }

  const playerIds = (players || []).map(p => p.player_id)
  const profilesMap = new Map<string, string>()

  if (playerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', playerIds)
    for (const p of profiles || []) {
      profilesMap.set(p.id, p.username)
    }
  }

  return (players || []).map(p => ({
    playerId: p.player_id,
    username: profilesMap.get(p.player_id) || null,
    team: p.team as 'WHITE' | 'BLACK' | null,
    slot: p.slot as number | null,
    status: (p.status === 'ready' ? 'ready' : 'joined') as 'joined' | 'ready' | 'locked',
  }))
}

export function areTeamsReady(players: LobbyPlayer[]): boolean {
  const whiteCount = players.filter(p => p.team === 'WHITE').length
  const blackCount = players.filter(p => p.team === 'BLACK').length
  return players.length === 4 && whiteCount === 2 && blackCount === 2
}

export async function joinFourPlayerByCode(options: {
  code: string
  playerId: string
}): Promise<{ roomId: string; roomCode: string; timeSeconds: number } | null> {
  const { code } = options

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .eq('mode', 'fourplayer')
    .eq('status', 'waiting')
    .maybeSingle()

  if (!room) return null

  return {
    roomId: room.id,
    roomCode: room.code,
    timeSeconds: room.time_seconds || 600,
  }
}
