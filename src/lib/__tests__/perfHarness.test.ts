jest.mock('../debug', () => ({ DEBUG: true }))

import {
  getPerfCounters,
  incDbRequest,
  incPollOverlap,
  incPollTick,
  logTiming,
  resetPerfCounters,
  startMark,
  tryEnterPoll,
  exitPoll,
} from '../perfHarness'

beforeEach(() => {
  resetPerfCounters()
})

describe('perfHarness DB/poll instrumentation (Phase 0)', () => {
  it('counts db requests per mark', () => {
    incDbRequest('history', 'memberships')
    incDbRequest('history', 'games')
    expect(getPerfCounters().dbRequests).toBe(2)
  })

  it('counts poll ticks and overlaps', () => {
    incPollTick('matchmaking')
    incPollTick('matchmaking')
    incPollOverlap('matchmaking')
    const c = getPerfCounters()
    expect(c.pollTicks).toBe(2)
    expect(c.pollOverlaps).toBe(1)
  })

  it('startMark/logTiming measures elapsed ms without throwing', () => {
    const t0 = startMark()
    expect(typeof t0).toBe('number')
    expect(() => logTiming('home', 'session', t0)).not.toThrow()
  })

  it('poll guard detects re-entry while in flight', () => {
    expect(tryEnterPoll('duel-test')).toBe(true)
    // Second entry while first is in flight reports overlap.
    expect(tryEnterPoll('duel-test')).toBe(false)
    expect(getPerfCounters().pollOverlaps).toBe(1)
    exitPoll('duel-test')
    expect(tryEnterPoll('duel-test')).toBe(true)
    exitPoll('duel-test')
  })

  it('reset clears all counters including legacy ones', () => {
    incDbRequest('x', 'y')
    incPollTick('x')
    resetPerfCounters()
    const c = getPerfCounters()
    expect(c.dbRequests).toBe(0)
    expect(c.pollTicks).toBe(0)
    expect(c.pollOverlaps).toBe(0)
    expect(c.timerTicks).toBe(0)
  })
})
