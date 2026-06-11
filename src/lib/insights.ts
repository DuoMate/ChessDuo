import { supabase } from './supabase'

const STORAGE_KEY = 'chessduo_insights'

function getLocalState(userId: string): { revealsUsed: number; isPremium: boolean } {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`)
    if (raw) return JSON.parse(raw)
  } catch { console.error('[Insights] Failed to read from localStorage') }
  return { revealsUsed: 0, isPremium: false }
}

function setLocalState(userId: string, state: { revealsUsed: number; isPremium: boolean }) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(state))
  } catch { console.error('[Insights] Failed to write to localStorage') }
}

export async function getUserInsightsState(userId: string): Promise<{
  revealsUsed: number
  isPremium: boolean
  revealsRemaining: number
}> {
  const local = getLocalState(userId)

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('insights_reveals_used, is_premium')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      return {
        revealsUsed: local.revealsUsed,
        isPremium: local.isPremium,
        revealsRemaining: Math.max(0, 3 - local.revealsUsed),
      }
    }

    const serverUsed = data.insights_reveals_used ?? 0
    const serverPremium = data.is_premium ?? false

    // Merge: use the higher reveal count (whichever is more recent)
    const revealsUsed = Math.max(local.revealsUsed, serverUsed)
    const isPremium = local.isPremium || serverPremium

    // Sync merged state back to localStorage
    if (revealsUsed !== local.revealsUsed || isPremium !== local.isPremium) {
      setLocalState(userId, { revealsUsed, isPremium })
    }

    // If server had an older count, try to sync local state back to server
    if (local.revealsUsed > serverUsed) {
      trySyncToServer(userId, local.revealsUsed)
    }

    return {
      revealsUsed,
      isPremium,
      revealsRemaining: Math.max(0, 3 - revealsUsed),
    }
  } catch {
    return {
      revealsUsed: local.revealsUsed,
      isPremium: local.isPremium,
      revealsRemaining: Math.max(0, 3 - local.revealsUsed),
    }
  }
}

async function trySyncToServer(userId: string, revealsUsed: number) {
  try {
      const { error } = await supabase
        .from('profiles')
        .update({ insights_reveals_used: revealsUsed })
        .eq('id', userId)

    if (error) {
      console.warn('[Insights] Sync to server failed:', error.message?.substring?.(0, 80) || error.code)
    }
  } catch { console.error('[Insights] Failed to sync to server') }
}

export async function incrementInsightsReveals(userId: string): Promise<number> {
  const local = getLocalState(userId)
  const nextLocal = local.revealsUsed + 1
  setLocalState(userId, { ...local, revealsUsed: nextLocal })

  trySyncToServer(userId, nextLocal)

  return Math.max(0, 3 - nextLocal)
}

export function setUserPremium(userId: string, isPremium: boolean) {
  const local = getLocalState(userId)
  setLocalState(userId, { ...local, isPremium })

  try {
      supabase
        .from('profiles')
        .update({ is_premium: isPremium })
        .eq('id', userId)
  } catch { console.error('[Insights] Failed to update premium status') }
}

export function isUserPremium(userId: string): boolean {
  return getLocalState(userId).isPremium
}
