import { supabase } from '@/lib/supabase'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/

export interface ProfileUpsertFields {
  id: string
  username?: string
  avatar_url?: string | null
  display_name?: string | null
}

/**
 * Produce a valid username from a loose candidate (email prefix, display name).
 * Falls back to a seeded `player_<hash>` when the candidate is invalid.
 * Used to ensure avatar/display upserts never INSERT a row with username = NULL
 * (profiles.username is NOT NULL → PostgREST 400 for users without a profile row).
 */
export function deriveUsername(candidate?: string | null, seed?: string): string {
  const cleaned = (candidate || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .slice(0, 30)
  if (USERNAME_PATTERN.test(cleaned)) return cleaned
  const base = (seed || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_]/g, '')
  return `player_${base.slice(0, 6)}`
}

export async function upsertProfile(fields: ProfileUpsertFields): Promise<{ success: boolean; isUniqueConflict: boolean }> {
  const payload: Record<string, unknown> = { id: fields.id }
  if (fields.username !== undefined) payload.username = fields.username
  if (fields.avatar_url !== undefined) payload.avatar_url = fields.avatar_url
  if (fields.display_name !== undefined) payload.display_name = fields.display_name

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
    if (error) {
      const isUniqueConflict = error.message?.includes('unique') || error.code === '23505'
      return { success: false, isUniqueConflict }
    }
    return { success: true, isUniqueConflict: false }
  } catch {
    return { success: false, isUniqueConflict: false }
  }
}

export async function fetchProfile(userId: string): Promise<{ username: string | null; avatar_url: string | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  return { username: data?.username || null, avatar_url: data?.avatar_url || null }
}

export async function updateProfile(userId: string, fields: { username?: string; avatar_url?: string | null; display_name?: string | null }): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...fields }, { onConflict: 'id' })
    return !error
  } catch {
    return false
  }
}

export async function getProfileUsername(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()
  return data?.username ?? null
}
