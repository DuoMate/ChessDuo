import { supabase, ChallengeLink } from './supabase'
import { getAppBaseUrl } from './appUrl'

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let roomCode = ''
  for (let i = 0; i < 6; i++) {
    roomCode += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return roomCode
}

export async function createChallenge(
  creatorId: string,
  gameMode: string,
  timeSeconds: number,
  friendId?: string
): Promise<{ data: ChallengeLink | null; error: string | null; roomId?: string; roomCode?: string }> {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // If this is for a duel (friendId provided), pre-create the room
  let roomId: string | undefined
  let roomCode: string | undefined
  if (friendId) {
    roomCode = generateRoomCode()
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ code: roomCode, status: 'waiting', created_by: creatorId })
      .select('*')
      .single()

    if (roomError) return { data: null, error: roomError.message }
    roomId = room.id

    await supabase
      .from('room_players')
      .insert({ room_id: roomId, player_id: creatorId, team: 'WHITE', slot: 0, status: 'ready' })

    await supabase
      .from('duel_games')
      .insert({
        room_id: roomId,
        player_white: creatorId,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        status: 'waiting',
        time_limit_seconds: timeSeconds,
      })
  }

  const { data, error } = await supabase
    .from('challenge_links')
    .insert({
      creator_id: creatorId,
      game_mode: gameMode,
      time_seconds: timeSeconds,
      code,
      expires_at: expiresAt,
      is_active: true,
      room_id: roomId,
    })
    .select('*')
    .single()

  if (error) return { data: null, error: error.message }

  return { data, error: null, roomId, roomCode }
}

export function getChallengeUrl(code: string): string {
  return `${getAppBaseUrl()}/challenge/${code}`
}

export async function getChallengeByCode(code: string): Promise<ChallengeLink | null> {
  const { data } = await supabase
    .from('challenge_links')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  return data || null
}

export async function deactivateChallenge(challengeId: string): Promise<void> {
  await supabase
    .from('challenge_links')
    .update({ is_active: false })
    .eq('id', challengeId)
}

export async function getChallengeHistory(creatorId: string): Promise<ChallengeLink[]> {
  const { data } = await supabase
    .from('challenge_links')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(20)

  return data || []
}
