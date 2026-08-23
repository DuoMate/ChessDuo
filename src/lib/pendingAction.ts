import type { PlayerColor } from '@/features/shared/gameConstants'

const PENDING_ACTION_KEY = 'chessduo_pending_action'

// AUTH-JOIN FIX: 5 minutes was too short to survive a Google OAuth round-trip
// plus first-time signup/email verification — the stored JOIN_ROOM intent
// silently expired and the user's original room code was lost. 30 minutes
// covers slow auth flows while still bounding stale actions.
const TTL_MS = 30 * 60 * 1000

export type PendingAction =
  | { type: 'start_offline'; level: number; time: number; color: PlayerColor }
  | { type: 'start_online'; time: number; color: PlayerColor }
  | { type: 'start_four_player'; time: number }
  | { type: 'start_duel'; friendId: string; friendName: string; time: number }
  | { type: 'join_by_code'; code: string }
  | { type: 'navigate'; route: string }

type StoredAction = PendingAction & { timestamp: number }

export function storePendingAction(action: PendingAction): void {
  if (typeof window === 'undefined') return
  try {
    const stored: StoredAction = { ...action, timestamp: Date.now() }
    localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(stored))
  } catch { /* quota exceeded */ }
}

export function consumePendingAction(): PendingAction | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PENDING_ACTION_KEY)
    if (!raw) return null
    localStorage.removeItem(PENDING_ACTION_KEY)
    const parsed = JSON.parse(raw) as StoredAction
    if (Date.now() - parsed.timestamp > TTL_MS) return null
    const timestamp = parsed.timestamp
    delete (parsed as Record<string, unknown>).timestamp
    return parsed as PendingAction
  } catch {
    localStorage.removeItem(PENDING_ACTION_KEY)
    return null
  }
}

export function clearPendingAction(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PENDING_ACTION_KEY)
  } catch { /* best-effort */ }
}

export function hasPendingAction(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(PENDING_ACTION_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as StoredAction
    return Date.now() - parsed.timestamp <= TTL_MS
  } catch {
    return false
  }
}
