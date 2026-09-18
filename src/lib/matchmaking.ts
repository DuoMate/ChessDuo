import { supabase, Room } from './supabase'
import { RoomService } from './roomService'
import { generateRoomCode } from './roomActions'
import { QUICK_MATCH_ROOM_EXPIRY_MS } from '@/features/shared/gameConstants'
import { emitTrace } from '@/features/shared/gameTrace'

export interface QuickMatchResult {
  room: Room
  team: 'WHITE' | 'BLACK'
  slot: number
}

export async function findAvailableRoom(playerId: string, timeSeconds?: number): Promise<QuickMatchResult | null> {
  const now = new Date().toISOString()

  // Only online-mode waiting rooms are quick-match candidates (4-player
  // lobbies share the rooms table and must not be auto-joined here).
  // Narrow columns (was select('*')) — join logic needs identity + timing only.
  let query = supabase
    .from('rooms')
    .select('id, code, status, created_by, created_at, time_seconds, expires_at, mode, host_team')
    .eq('status', 'waiting')
    .eq('mode', 'online')
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  if (timeSeconds) {
    query = query.eq('time_seconds', timeSeconds)
  }

  const { data: rooms, error } = await query
    .order('created_at', { ascending: true })
    .limit(5)

  if (error || !rooms || rooms.length === 0) return null

  // P1 perf: join-state RPCs are independent per candidate room — fetch in
  // parallel (was sequential await-in-loop, up to 5 round trips). Order is
  // preserved: first fit in created_at order wins, own rooms skipped.
  const candidates = rooms.filter(room => room.created_by !== playerId)
  if (candidates.length === 0) return null

  const joinStates = await Promise.all(
    candidates.map(room =>
      supabase.rpc('get_room_join_state', { p_room_id: room.id })
        .then(({ data }) => ({ room, joinState: data }))
        .catch(() => ({ room, joinState: null }))
    ),
  )

  for (const { room, joinState } of joinStates) {
    // RLS restricts room_players to members, but a quick-match seeker is not
    // a member of the rooms it inspects. The public get_room_join_state RPC
    // (SECURITY DEFINER) reports team counts without requiring membership.
    const total = Number(joinState?.player_count ?? 0)
    if (total >= 4) continue

    const whiteSlots = Number(joinState?.white_count ?? 0)
    const blackSlots = Number(joinState?.black_count ?? 0)

    if (whiteSlots < 2) {
      return { room: room as Room, team: 'WHITE', slot: whiteSlots }
    } else if (blackSlots < 2) {
      return { room: room as Room, team: 'BLACK', slot: blackSlots }
    }
  }

  return null
}

export async function checkMyRoomJoined(roomId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('room_players')
    .select('player_id')
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


export async function createQuickMatchRoom(playerId: string, timeSeconds: number = 600): Promise<Room | null> {
  const expiresAt = new Date(Date.now() + QUICK_MATCH_ROOM_EXPIRY_MS).toISOString()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode()

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

    emitTrace('GAME_CREATED', { roomId: room.id, playerId, team: 'WHITE', color: 'white' })
    return room as Room
  }

  console.warn('[Matchmaking] Failed to create room after 5 attempts')
  return null
}

export async function deleteRoom(roomId: string): Promise<void> {
  await RoomService.deleteAllRoomPlayers(roomId)
  await RoomService.deleteRoom(roomId)
}
