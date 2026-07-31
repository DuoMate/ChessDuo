import { supabase } from '@/lib/supabase'
import { PlayerColor, resolvePlayerColor } from '@/features/shared/gameConstants'

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
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Resolve the host's color once at room creation. The host always sits on
  // this color; the joiner auto-receives the opposite when they enter.
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

  return {
    roomId: room.id,
    roomCode: room.code,
    team: hostTeam,
    playerId,
    time: timeSeconds,
  }
}
