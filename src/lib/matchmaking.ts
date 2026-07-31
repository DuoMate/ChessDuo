import { supabase, Room } from './supabase'
import { RoomService } from './roomService'

const ROOM_EXPIRY_MS = 60_000 // 60 seconds — stale rooms auto-cleanup

export interface QuickMatchResult {
  room: Room
  team: 'WHITE' | 'BLACK'
  slot: number
}

export async function findAvailableRoom(playerId: string, timeSeconds?: number): Promise<QuickMatchResult | null> {
  const now = new Date().toISOString()

  let query = supabase
    .from('rooms')
    .select('*')
    .eq('status', 'waiting')
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  if (timeSeconds) {
    query = query.eq('time_seconds', timeSeconds)
  }

  const { data: rooms, error } = await query

  if (error || !rooms || rooms.length === 0) return null

  for (const room of rooms) {
    if (room.created_by === playerId) continue

    const { data: players } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', room.id)

    if (!players || players.length >= 4) continue

    const whiteSlots = players.filter(p => p.team === 'WHITE')
    const blackSlots = players.filter(p => p.team === 'BLACK')

    const alreadyInRoom = players.some(p => p.player_id === playerId)
    if (alreadyInRoom) continue

    if (whiteSlots.length < 2) {
      return { room: room as Room, team: 'WHITE', slot: whiteSlots.length }
    } else if (blackSlots.length < 2) {
      return { room: room as Room, team: 'BLACK', slot: blackSlots.length }
    }
  }

  return null
}

export async function checkMyRoomJoined(roomId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', roomId)
  if (error || !data) return false
  return data.length >= 2
}

export async function joinQuickMatchRoom(
  roomId: string,
  playerId: string,
  team: 'WHITE' | 'BLACK',
  slot: number
): Promise<boolean> {
  const { error } = await supabase
    .from('room_players')
    .insert({
      room_id: roomId,
      player_id: playerId,
      team,
      slot,
      status: 'waiting'
    })

  if (error) {
    if (error.code === '409' || error.message.includes('duplicate')) {
      return true
    }
    console.warn('[Matchmaking] Failed to join room:', error.message)
    return false
  }

  return true
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function createQuickMatchRoom(playerId: string, timeSeconds: number = 600): Promise<Room | null> {
  const expiresAt = new Date(Date.now() + ROOM_EXPIRY_MS).toISOString()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ code, status: 'waiting', created_by: playerId, time_seconds: timeSeconds, expires_at: expiresAt, host_team: 'WHITE' })
      .select()
      .single()

    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        continue
      }
      console.warn('[Matchmaking] Failed to create room:', error.message)
      return null
    }

    if (!room) return null

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
      console.warn('[Matchmaking] Failed to join own room:', playerError.message)
      return null
    }

    return room as Room
  }

  console.warn('[Matchmaking] Failed to create room after 5 attempts')
  return null
}

export async function deleteRoom(roomId: string): Promise<void> {
  await RoomService.deleteAllRoomPlayers(roomId)
  await RoomService.deleteRoom(roomId)
}
