import { supabase } from '@/lib/supabase'

export interface ProfileUpsertFields {
  id: string
  username?: string
  avatar_url?: string | null
  display_name?: string | null
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
