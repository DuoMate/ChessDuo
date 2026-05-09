import { supabase } from './supabase'

const STORAGE_KEY = 'chessduo_insights'

function getLocalState(userId: string): { revealsUsed: number; isPremium: boolean } {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { revealsUsed: 0, isPremium: false }
}

function setLocalState(userId: string, state: { revealsUsed: number; isPremium: boolean }) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(state))
  } catch {}
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

    if (error) {
      console.warn('[Insights] Server fetch failed, using local state:', error.message?.substring?.(0, 80) || error.code)
      return {
        revealsUsed: local.revealsUsed,
        isPremium: local.isPremium,
        revealsRemaining: Math.max(0, 3 - local.revealsUsed),
      }
    }

    if (data) {
      setLocalState(userId, { revealsUsed: data.insights_reveals_used ?? 0, isPremium: data.is_premium ?? false })
    }

    const used = data?.insights_reveals_used ?? 0
    return {
      revealsUsed: used,
      isPremium: data?.is_premium ?? false,
      revealsRemaining: Math.max(0, 3 - used),
    }
  } catch (e) {
    console.warn('[Insights] Server error, using local state:', e)
    return {
      revealsUsed: local.revealsUsed,
      isPremium: local.isPremium,
      revealsRemaining: Math.max(0, 3 - local.revealsUsed),
    }
  }
}

export async function incrementInsightsReveals(userId: string): Promise<number> {
  const local = getLocalState(userId)
  const nextLocal = local.revealsUsed + 1
  setLocalState(userId, { ...local, revealsUsed: nextLocal })

  try {
    const { data: current } = await supabase
      .from('profiles')
      .select('insights_reveals_used')
      .eq('id', userId)
      .maybeSingle()

    const next = (current?.insights_reveals_used ?? 0) + 1

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, insights_reveals_used: next }, { onConflict: 'id' })

    if (error) {
      console.warn('[Insights] Server increment failed, using local:', error.message?.substring?.(0, 80) || error.code)
    }

    return Math.max(0, 3 - Math.max(next, nextLocal))
  } catch (e) {
    console.warn('[Insights] Server error on increment, using local:', e)
    return Math.max(0, 3 - nextLocal)
  }
}

export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .maybeSingle()

    return data?.is_premium ?? false
  } catch {
    return false
  }
}
