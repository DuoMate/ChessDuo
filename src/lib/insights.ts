import { INSIGHTS_FREE_LIMIT } from '@/features/shared/gameConstants'

const STORAGE_KEY = 'chessduo_insights'

function getLocalState(userId: string): { revealsUsed: number } {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`)
    if (raw) return JSON.parse(raw)
  } catch (e) { console.error('[Insights] Failed to read from localStorage:', e) }
  return { revealsUsed: 0 }
}

function setLocalState(userId: string, state: { revealsUsed: number }) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(state))
  } catch (e) { console.error('[Insights] Failed to write to localStorage:', e) }
}

export async function getUserInsightsState(userId: string): Promise<{
  revealsUsed: number
  isPremium: boolean
  revealsRemaining: number
}> {
  const local = getLocalState(userId)

  return {
    revealsUsed: local.revealsUsed,
    isPremium: false,
    revealsRemaining: Math.max(0, INSIGHTS_FREE_LIMIT - local.revealsUsed),
  }
}

export async function incrementInsightsReveals(userId: string): Promise<number> {
  const local = getLocalState(userId)
  const nextLocal = local.revealsUsed + 1
  setLocalState(userId, { revealsUsed: nextLocal })

  return Math.max(0, INSIGHTS_FREE_LIMIT - nextLocal)
}

export function isUserPremium(_userId: string): boolean {
  return false
}
