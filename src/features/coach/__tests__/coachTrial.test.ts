/**
 * AI Coach daily-trial tests (isolated monetization layer).
 *
 * Covers: UTC-day quota boundaries (`AI_COACH_FREE_DAILY_LIMIT` per
 * calendar day), countdown to UTC midnight, premium bypass, claim-on-start
 * idempotency (double Start / StrictMode / duplicate callbacks), blocked
 * claim once the quota is exhausted, and open-without-start never consuming.
 */
import { AI_COACH_FREE_DAILY_LIMIT } from '../../shared/gameConstants'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
import { SubscriptionService } from '../../billing'
import {
  __clearClaimedSessions,
  claimCoachDailyTrial,
  formatTrialCountdown,
  getCoachDayKey,
  getCoachTrialState,
  getRemainingToday,
  isEligibleToday,
  nextMidnightUtc,
} from '../coachTrial'

const fromMock = supabase.from as jest.Mock

const LIMIT = AI_COACH_FREE_DAILY_LIMIT

function mockStatus(isPremium: boolean, extra: Record<string, unknown> = {}) {
  jest.spyOn(SubscriptionService, 'getStatus').mockResolvedValue({
    isPremium,
    subscriptionProvider: isPremium ? 'GOOGLE_PLAY' : null,
    subscriptionPlan: isPremium ? 'monthly' : null,
    purchaseToken: isPremium ? 'tok' : null,
    subscriptionExpiryDate: null,
    autoRenewStatus: isPremium,
    purchaseState: null,
    lastVerifiedDate: null,
    subscriptionStatus: isPremium ? 'active' : null,
    ...extra,
  } as never)
}

/** Server select returns daily-count columns (post-migration shape). */
function mockServerUsage(day: string | null, count: number, iso: string | null = null) {
  const updateEq = jest.fn().mockResolvedValue({ error: null })
  const update = jest.fn().mockReturnValue({ eq: updateEq })
  fromMock.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({
          data: { coach_free_day: day, coach_free_count: count, coach_last_free_game_at: iso },
          error: null,
        }),
      }),
    }),
    update,
  })
  return { update }
}

function mockServerUpdate(error: { message: string } | null) {
  const updateEq = jest.fn().mockResolvedValue({ error })
  const update = jest.fn().mockReturnValue({ eq: updateEq })
  fromMock.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({
          data: { coach_free_day: null, coach_free_count: 0, coach_last_free_game_at: null },
          error: null,
        }),
      }),
    }),
    update,
  })
  return { update }
}

const NOW = new Date('2026-09-18T12:00:00.000Z').getTime()
const TODAY = getCoachDayKey(NOW)

describe('daily quota boundaries (UTC calendar day)', () => {
  it('fresh user has the full configured quota', () => {
    expect(getRemainingToday(0)).toBe(LIMIT)
    expect(isEligibleToday(0, NOW)).toBe(true)
  })

  it('consuming up to the limit stays eligible; hitting it blocks', () => {
    expect(isEligibleToday(LIMIT - 1, NOW)).toBe(true)
    expect(isEligibleToday(LIMIT, NOW)).toBe(false)
    expect(isEligibleToday(LIMIT + 5, NOW)).toBe(false)
    expect(getRemainingToday(LIMIT)).toBe(0)
  })

  it('quota resets at UTC midnight', () => {
    expect(nextMidnightUtc(NOW)).toBe(new Date('2026-09-19T00:00:00.000Z').toISOString())
    // Same wall-clock games on a new UTC day start from zero (callers pass
    // today's count; a new day means count 0).
    expect(isEligibleToday(0, new Date('2026-09-19T00:01:00.000Z').getTime())).toBe(true)
  })
})

describe('formatTrialCountdown', () => {
  it('formats countdown as hours + minutes', () => {
    const next = new Date(NOW + 2 * 3_600_000 + 5 * 60_000).toISOString()
    expect(formatTrialCountdown(next, NOW)).toBe('2h 5m')
  })

  it('formats sub-hour countdown as minutes', () => {
    const next = new Date(NOW + 45 * 60_000).toISOString()
    expect(formatTrialCountdown(next, NOW)).toBe('45m')
  })

  it('returns null for null/past timestamps', () => {
    expect(formatTrialCountdown(null, NOW)).toBeNull()
    expect(formatTrialCountdown(new Date(NOW - 1).toISOString(), NOW)).toBeNull()
  })
})

describe('getCoachTrialState', () => {
  beforeEach(() => {
    localStorage.clear()
    fromMock.mockClear()
    jest.restoreAllMocks()
  })

  it('premium users bypass the trial (unlimited, no offer)', async () => {
    mockStatus(true, { coachLastFreeGameAt: null })
    const state = await getCoachTrialState('user-1', NOW)
    expect(state.isPremium).toBe(true)
    expect(state.eligible).toBe(true)
    expect(state.nextEligibleAt).toBeNull()
    expect(state.dailyLimit).toBe(LIMIT)
  })

  it('fresh free user sees the full quota as remaining', async () => {
    mockStatus(false)
    mockServerUsage(null, 0, null)
    const state = await getCoachTrialState('user-2', NOW)
    expect(state.eligible).toBe(true)
    expect(state.usedToday).toBe(0)
    expect(state.remainingToday).toBe(LIMIT)
    expect(state.dailyLimit).toBe(LIMIT)
    expect(localStorage.getItem('chessduo_coach_trial_user-2')).toBeNull()
  })

  it('opening without starting never consumes (read is side-effect free)', async () => {
    mockStatus(false)
    mockServerUsage(TODAY, 1, new Date(NOW - 60_000).toISOString())
    const state = await getCoachTrialState('user-2b', NOW)
    expect(state.eligible).toBe(true)
    expect(state.usedToday).toBe(1)
    expect(state.remainingToday).toBe(LIMIT - 1)
  })
})

describe('claimCoachDailyTrial', () => {
  beforeEach(() => {
    localStorage.clear()
    fromMock.mockClear()
    jest.restoreAllMocks()
    __clearClaimedSessions()
  })

  it('first start claims exactly once; duplicate session claim is a no-op', async () => {
    mockStatus(false)
    const { update } = mockServerUpdate(null)

    const first = await claimCoachDailyTrial('user-3', 'session-a', NOW)
    expect(first.claimed).toBe(true)
    expect(first.persisted).toBe(true)
    expect(first.state.usedToday).toBe(1)
    expect(first.state.remainingToday).toBe(LIMIT - 1)
    expect(first.state.eligible).toBe(LIMIT - 1 > 0)
    expect(update).toHaveBeenCalledTimes(1)

    const second = await claimCoachDailyTrial('user-3', 'session-a', NOW + 1000)
    expect(second.claimed).toBe(true)
    // No additional server WRITE for the duplicate callback (reads may occur).
    expect(update).toHaveBeenCalledTimes(1)
  })

  it(`claiming ${LIMIT} games exhausts the quota and blocks the next`, async () => {
    mockStatus(false)
    mockServerUpdate(null)

    for (let i = 0; i < LIMIT; i += 1) {
      const r = await claimCoachDailyTrial('user-4', `session-${i}`, NOW + i * 60_000)
      expect(r.claimed).toBe(true)
    }
    const blocked = await claimCoachDailyTrial('user-4', 'session-over', NOW + LIMIT * 60_000)
    expect(blocked.claimed).toBe(false)
    expect(blocked.state.eligible).toBe(false)
    expect(blocked.state.remainingToday).toBe(0)
    expect(blocked.state.nextEligibleAt).not.toBeNull()
  })

  it('server failure still consumes locally but reports persisted:false for retry', async () => {
    mockStatus(false)
    mockServerUpdate({ message: 'network down' })

    const result = await claimCoachDailyTrial('user-5', 'session-x', NOW)
    expect(result.claimed).toBe(true)
    expect(result.persisted).toBe(false)
    // Local mirror holds the claim so the gate stays consistent.
    expect(localStorage.getItem('chessduo_coach_trial_user-5')).not.toBeNull()
  })
})
