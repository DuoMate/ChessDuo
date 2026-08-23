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
}

const counters: Counters = {
  gameRenders: 0,
  chessBoardRenders: 0,
  boardTopBarRenders: 0,
  pendingRowRenders: 0,
  moveResolvedRenders: 0,
  timerTicks: 0,
  realtimeEvents: 0,
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
    }
  } catch {
    // ignore — window not writable in some test envs
  }
}
