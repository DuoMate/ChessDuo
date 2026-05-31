import { supabase } from '@/lib/supabase'

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
}): Promise<{ roomId: string; roomCode: string; team: 'WHITE'; playerId: string; time: number }> {
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

  const { error: playerError } = await supabase
    .from('room_players')
    .insert({
      room_id: room.id,
      player_id: playerId,
      team: 'WHITE',
      slot: 0,
      status: 'waiting',
    })

  if (playerError) {
    throw new Error(playerError.message)
  }

  return {
    roomId: room.id,
    roomCode: room.code,
    team: 'WHITE',
    playerId,
    time: timeSeconds,
  }
}
