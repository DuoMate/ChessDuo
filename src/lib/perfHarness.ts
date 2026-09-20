'use client'

import { DEBUG } from './debug'

// DEBUG-gated perf counters. In production without ?debug=1/localStorage flag,
// DEBUG is false and all tracking is a no-op (no bundle cost in hot path).
type Counters = {
  gameRenders: number
  chessBoardRenders: number
  boardTopBarRenders: number
  pendingRowRenders: number
  moveResolvedRenders: number
  timerTicks: number
  realtimeEvents: number
  dbRequests: number
  pollTicks: number
  pollOverlaps: number
}

const counters: Counters = {
  gameRenders: 0,
  chessBoardRenders: 0,
  boardTopBarRenders: 0,
  pendingRowRenders: 0,
  moveResolvedRenders: 0,
  timerTicks: 0,
  realtimeEvents: 0,
  dbRequests: 0,
  pollTicks: 0,
  pollOverlaps: 0,
}

export function incCounter(key: keyof Counters): void {
  if (!DEBUG) return
  counters[key]++
}

export function incGameRender(): void {
  incCounter('gameRenders')
}

export function incTimerTick(): void {
  incCounter('timerTicks')
}

export function incRealtimeEvent(): void {
  incCounter('realtimeEvents')
}

// Phase 0 DB/poll instrumentation — all DEBUG-gated no-ops in production
// without ?debug=1 (same contract as the render counters above). Surface/op
// strings are static labels only, never user data (no PII/tokens).
export function incDbRequest(surface: string, op: string): void {
  if (!DEBUG) return
  counters.dbRequests++
  console.log(`[PERF][DB] ${surface} ${op} total=${counters.dbRequests}`)
}

export function incPollTick(surface: string): void {
  if (!DEBUG) return
  counters.pollTicks++
  console.log(`[PERF][POLL] ${surface} tick total=${counters.pollTicks}`)
}

export function incPollOverlap(surface: string): void {
  if (!DEBUG) return
  counters.pollOverlaps++
  console.log(`[PERF][POLL] ${surface} overlap total=${counters.pollOverlaps}`)
}

// Wall-clock marks for waterfall measurement (cheap; safe to call in prod,
// logging stays DEBUG-gated).
export function startMark(): number {
  try {
    return typeof performance !== 'undefined' ? performance.now() : Date.now()
  } catch {
    return Date.now()
  }
}

export function logTiming(surface: string, stage: string, t0: number): void {
  if (!DEBUG) return
  let elapsed = 0
  try {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    elapsed = now - t0
  } catch {
    elapsed = 0
  }
  console.log(`[PERF] ${surface} ${stage} ${elapsed.toFixed(1)}ms`)
}

// In-flight poll guard (Phase 0: measure overlaps; Phase 3: callers skip
// when tryEnterPoll returns false). Functional regardless of DEBUG so the
// guard itself can't skew timing; only the logging is gated.
const pollsInFlight = new Set<string>()

export function tryEnterPoll(key: string): boolean {
  if (pollsInFlight.has(key)) {
    incPollOverlap(key)
    return false
  }
  pollsInFlight.add(key)
  return true
}

export function exitPoll(key: string): void {
  pollsInFlight.delete(key)
}

export function getPerfCounters(): Readonly<Counters> {
  return { ...counters }
}

export function resetPerfCounters(): void {
  ;(Object.keys(counters) as (keyof Counters)[]).forEach((k) => {
    counters[k] = 0
  })
}

// Lightweight Profiler onRender callback compatible with React.Profiler
export function createProfilerCallback(component: string) {
  return (
    _id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
  ) => {
    if (!DEBUG) return
    // eslint-disable-next-line no-console
    console.log(`[PERF][PROFILER] ${component} ${phase} ${actualDuration.toFixed(2)}ms`)
  }
}

// Expose counters on window for manual `?debug=1` inspection without DevTools.
if (typeof window !== 'undefined' && DEBUG) {
  try {
    ;(window as unknown as Record<string, unknown>).__CHESS_PERF__ = {
      counters,
      getPerfCounters,
      resetPerfCounters,
      incDbRequest,
      incPollTick,
      incPollOverlap,
      startMark,
      logTiming,
      tryEnterPoll,
      exitPoll,
    }
  } catch {
    // ignore — window not writable in some test envs
  }
}
