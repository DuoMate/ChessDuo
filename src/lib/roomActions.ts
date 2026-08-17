import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { PlayerColor, resolvePlayerColor, ROOM_EXPIRY_MS } from '@/features/shared/gameConstants'
import { emitTrace } from '@/features/shared/gameTrace'
import { traceDuoJoin, hashId } from '@/lib/duoJoinTrace'

// Atomic Duo room-join result returned by the join_room_by_code RPC.
export interface JoinRoomResult {
  roomId: string
  code: string
  team: 'WHITE' | 'BLACK'
  slot: number
  status: string
  mode: string
  hostTeam: 'WHITE' | 'BLACK' | null
  createdBy: string
  timeSeconds: number
  gameId?: string | null
  gameStatus?: string | null
}

// Error carrying the underlying database/RPC code + message so callers can map
// specific conditions without swallowing the real error.
export interface DuoJoinError extends Error {
  code: string
  rawMessage: string
}

export const DUO_JOIN_ERROR_MESSAGES: Record<string, string> = {
  '42501': 'Please sign in to join a room',
  'P0001': 'Room not found — check the code',
  'P0002': 'Room has expired',
  'P0003': 'Room is full',
  'P0004': 'Room is no longer available',
}

export function messageForDuoJoinError(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = (err as { code?: string }).code
    if (code && DUO_JOIN_ERROR_MESSAGES[code]) return DUO_JOIN_ERROR_MESSAGES[code]
  }
  return 'Something went wrong — try again'
}

/**
 * Joins a Duo room atomically on the server. The database authenticates the
 * caller via auth.uid(), locks the room, validates it, and computes the team
 * and slot server-side. The client never supplies team/slot.
 */
export async function joinRoomByCode(code: string): Promise<JoinRoomResult> {
  const normalized = code.trim().toUpperCase()
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  const codeHash = hashId(normalized)
  const session = await AuthService.getSession()
  const userIdHash = hashId(session?.user?.id)

  traceDuoJoin('DUO_JOIN_STARTED', { requestId, codeHash, userIdHash })

  const { data, error } = await supabase.rpc('join_room_by_code', { p_code: normalized })

  if (error) {
    traceDuoJoin('DUO_JOIN_FAILED', {
      requestId,
      codeHash,
      userIdHash,
      errorCode: error.code || '',
      errorMessage: error.message || '',
    })
    const err = new Error(messageForDuoJoinError(error)) as DuoJoinError
    err.code = error.code || 'P0001'
    err.rawMessage = error.message || ''
    throw err
  }

  const row = Array.isArray(data) ? data?.[0] : data
  if (!row) {
    traceDuoJoin('DUO_JOIN_FAILED', { requestId, codeHash, userIdHash, errorCode: 'P0001', errorMessage: 'RPC returned no row' })
    const err = new Error(DUO_JOIN_ERROR_MESSAGES['P0001']) as DuoJoinError
    err.code = 'P0001'
    err.rawMessage = 'RPC returned no row'
    throw err
  }

  traceDuoJoin('DUO_JOIN_SUCCESS', { requestId, roomId: row.room_id, team: row.team, slot: row.slot, userIdHash })

  return {
    roomId: row.room_id,
    code: row.code,
    team: row.team,
    slot: row.slot,
    status: row.status,
    mode: row.mode,
    hostTeam: row.host_team ?? null,
    createdBy: row.created_by,
    timeSeconds: row.time_seconds ?? 600,
    gameId: row.game_id ?? null,
    gameStatus: row.game_status ?? null,
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function createOnlineRoom(options: {
  playerId: string
  timeSeconds: number
  hostColor?: PlayerColor
}): Promise<{ roomId: string; roomCode: string; team: 'WHITE' | 'BLACK'; playerId: string; time: number }> {
  const { playerId, timeSeconds, hostColor = 'white' } = options
  const code = generateRoomCode()
  const expiresAt = new Date(Date.now() + ROOM_EXPIRY_MS).toISOString()

  // Resolve the host's color once at room creation. The host always sits on
  // this color; the joiner inherits the same team so both humans play together
  // against bots (Duo mode: "You + Friend vs Bots").
  const hostTeam: 'WHITE' | 'BLACK' = resolvePlayerColor(hostColor) === 'white' ? 'WHITE' : 'BLACK'

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      code,
      status: 'waiting',
      mode: 'online',
      created_by: playerId,
      time_seconds: timeSeconds,
      expires_at: expiresAt,
      host_team: hostTeam,
    })
    .select()
    .single()

  if (roomError || !room) {
    throw new Error(roomError?.message || 'Failed to create room')
  }

  const { error: playerError } = await supabase
    .from('room_players')
    .insert({
      room_id: room.id,
      player_id: playerId,
      team: hostTeam,
      slot: 0,
      status: 'waiting',
    })

  if (playerError) {
    throw new Error(playerError.message)
  }

  emitTrace('GAME_CREATED', { roomId: room.id, playerId, team: hostTeam, color: hostColor })

  return {
    roomId: room.id,
    roomCode: room.code,
    team: hostTeam,
    playerId,
    time: timeSeconds,
  }
}
