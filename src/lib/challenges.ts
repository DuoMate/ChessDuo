import { supabase, ChallengeLink } from './supabase'

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function createChallenge(
  creatorId: string,
  gameMode: string,
  timeSeconds: number
): Promise<{ data: ChallengeLink | null; error: string | null }> {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('challenge_links')
    .insert({
      creator_id: creatorId,
      game_mode: gameMode,
      time_seconds: timeSeconds,
      code,
      expires_at: expiresAt,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) return { data: null, error: error.message }

  return { data, error: null }
}

export function getChallengeUrl(code: string): string {
  return `${window.location.origin}/challenge/${code}`
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
