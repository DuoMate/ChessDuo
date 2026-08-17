/**
 * Lightweight Realtime diagnostics (P0-3).
 *
 * Tracks channel lifecycle, subscription status transitions, and recovery
 * latency across the existing Supabase Realtime usage. Recording is negligible
 * (in-memory counters). The report is exposed on `window.__chessDuoRealtime`
 * ONLY when `NEXT_PUBLIC_CHESSDUO_DIAGNOSTICS=true` so the load-test harness
 * can read it; no sensitive data is collected.
 */

export type RealtimeChannelType =
  | 'room'
  | 'submissions'
  | 'game-status'
  | 'badge'
  | 'presence'
  | 'message'
  | 'postgres-changes'
  | 'other'

const ENV_FLAG = process.env.NEXT_PUBLIC_CHESSDUO_DIAGNOSTICS === 'true'

let active = 0
let peakActive = 0
let created = 0
let removed = 0
let subscribed = 0
let channelErrors = 0
let closed = 0
let subscribeErrors = 0
let reconnectAttempts = 0
let reconnectSuccess = 0
const recoveryLatencies: number[] = []
const MAX_LATENCIES = 200
const startTimes = new Map<string, number>()
const byType = new Map<RealtimeChannelType, number>()

function classify(topic: string): RealtimeChannelType {
  if (!topic) return 'other'
  if (topic.startsWith('room:')) return 'room'
  if (topic.startsWith('submissions:')) return 'submissions'
  if (topic.startsWith('game-status:')) return 'game-status'
  if (topic.startsWith('badge:')) return 'badge'
  if (topic === 'global-presence') return 'presence'
  if (topic.startsWith('messages:')) return 'message'
  return 'postgres-changes'
}

function recordLatency(ms: number): void {
  recoveryLatencies.push(ms)
  if (recoveryLatencies.length > MAX_LATENCIES) recoveryLatencies.shift()
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[idx]
}

export const realtimeMetrics = {
  enabled: ENV_FLAG,

  get active(): number {
    return active
  },
  get peak(): number {
    return peakActive
  },

  onChannelCreated(topic: string): void {
    created++
    active++
    if (active > peakActive) peakActive = active
    const t = classify(topic)
    byType.set(t, (byType.get(t) || 0) + 1)
    startTimes.set(topic, Date.now())
  },

  onChannelRemoved(topic: string): void {
    removed++
    active = Math.max(0, active - 1)
    startTimes.delete(topic)
  },

  onSubscribeStatus(topic: string, status: string): void {
    const now = Date.now()
    const start = startTimes.get(topic)
    if (status === 'SUBSCRIBED') {
      subscribed++
      if (start) recordLatency(now - start)
    } else if (status === 'CHANNEL_ERROR') {
      channelErrors++
      reconnectAttempts++
    } else if (status === 'SUBSCRIBE_ERROR' || status === 'TIMED_OUT') {
      subscribeErrors++
    } else if (status === 'CLOSED') {
      closed++
    }
  },

  onReconnectSuccess(topic: string): void {
    reconnectSuccess++
    const start = startTimes.get(topic)
    if (start) recordLatency(Date.now() - start)
  },

  reset(): void {
    active = 0
    peakActive = 0
    created = 0
    removed = 0
    subscribed = 0
    channelErrors = 0
    closed = 0
    subscribeErrors = 0
    reconnectAttempts = 0
    reconnectSuccess = 0
    recoveryLatencies.length = 0
    startTimes.clear()
    byType.clear()
  },

  getReport() {
    const sorted = [...recoveryLatencies].sort((a, b) => a - b)
    return {
      active,
      peak: peakActive,
      created,
      removed,
      subscribed,
      channelErrors,
      closed,
      subscribeErrors,
      reconnectAttempts,
      reconnectSuccess,
      recoveryLatencyMs: {
        count: sorted.length,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        max: sorted[sorted.length - 1] || 0,
      },
      byType: Object.fromEntries(byType),
    }
  },
}

// Expose for the load-test harness / diagnostics (only when enabled).
declare global {
  interface Window {
    __chessDuoRealtime?: typeof realtimeMetrics
  }
}
if (typeof window !== 'undefined' && ENV_FLAG) {
  window.__chessDuoRealtime = realtimeMetrics
}
