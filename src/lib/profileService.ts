import { supabase } from '@/lib/supabase'
import { DEBUG } from './debug'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/

export interface ProfileUpsertFields {
  id: string
  username?: string
  avatar_url?: string | null
  display_name?: string | null
  username_lower?: string | null
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
  if (fields.username_lower !== undefined) payload.username_lower = fields.username_lower

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
    if (error) {
      const isUniqueConflict = error.message?.includes('unique') || error.code === '23505'
      // A username-less upsert for a user WITHOUT a profiles row is a NOT NULL
      // INSERT violation (23502) — indicate the contract was broken so a single
      // prod run surfaces the exact request that 400s instead of a bare network error.
      if (!isUniqueConflict && error.code === '23502' && fields.username === undefined) {
        console.warn('[profileService] username-less upsert hit NOT NULL violation — caller must deriveUsername():', {
          id: fields.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
      }
      DEBUG && console.warn('[profileService] upsertProfile failed:', {
        id: fields.id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        hadUsername: fields.username !== undefined,
      })
      return { success: false, isUniqueConflict }
    }
    invalidateProfileCache(fields.id)
    return { success: true, isUniqueConflict: false }
  } catch {
    return { success: false, isUniqueConflict: false }
  }
}

interface CachedProfile {
  username: string | null
  avatar_url: string | null
}

const profileCache = new Map<string, { value: CachedProfile; fetchedAt: number }>()
const PROFILE_CACHE_TTL_MS = 60_000

export function invalidateProfileCache(userId: string): void {
  profileCache.delete(userId)
}

export function clearProfileCache(): void {
  profileCache.clear()
}

function getCachedProfile(userId: string): CachedProfile | null {
  const entry = profileCache.get(userId)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > PROFILE_CACHE_TTL_MS) {
    profileCache.delete(userId)
    return null
  }
  return entry.value
}

export async function fetchProfile(userId: string): Promise<{ username: string | null; avatar_url: string | null }> {
  const cached = getCachedProfile(userId)
  if (cached) return cached

  const { data } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  const value: CachedProfile = { username: data?.username || null, avatar_url: data?.avatar_url || null }
  profileCache.set(userId, { value, fetchedAt: Date.now() })
  return value
}

export async function updateProfile(userId: string, fields: { username?: string; avatar_url?: string | null; display_name?: string | null; username_lower?: string | null }): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...fields }, { onConflict: 'id' })
    if (error) {
      DEBUG && console.warn('[profileService] updateProfile failed:', {
        id: userId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
    } else {
      invalidateProfileCache(userId)
    }
    return !error
  } catch {
    return false
  }
}

export async function getProfileUsername(userId: string): Promise<string | null> {
  return (await fetchProfile(userId)).username
}
