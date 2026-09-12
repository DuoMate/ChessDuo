/**
 * AI Coach daily-trial tests (isolated monetization layer).
 *
 * Covers: eligibility boundaries, countdown, premium bypass, claim-on-start
 * idempotency (double Start / StrictMode / duplicate callbacks), blocked
 * second claim inside the window, and open-without-start never consuming.
 */
import { COACH_TRIAL_WINDOW_MS } from '../../shared/gameConstants'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
import { SubscriptionService } from '../../billing'
import {
  __clearClaimedSessions,
  claimCoachDailyTrial,
  formatTrialCountdown,
  getCoachTrialState,
  isTrialEligible,
  nextEligibleAt,
} from '../coachTrial'

const fromMock = supabase.from as jest.Mock

function mockServerSelect(iso: string | null, ok = true) {
  const updateEq = jest.fn().mockResolvedValue({ error: null })
  const update = jest.fn().mockReturnValue({ eq: updateEq })
  fromMock.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue(ok ? { data: { coach_last_free_game_at: iso }, error: null } : { data: null, error: { message: 'offline' } }),
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
        maybeSingle: jest.fn().mockResolvedValue({ data: { coach_last_free_game_at: null }, error: null }),
      }),
    }),
    update,
  })
  return { update }
}

const NOW = new Date('2026-09-12T12:00:00.000Z').getTime()

describe('isTrialEligible (rolling 24h)', () => {
  it('never-used user is eligible', () => {
    expect(isTrialEligible(null, NOW)).toBe(true)
  })

  it('recent game blocks a second start', () => {
    const last = new Date(NOW - 60_000).toISOString()
    expect(isTrialEligible(last, NOW)).toBe(false)
  })

  it('23h59m is still blocked', () => {
    const last = new Date(NOW - (COACH_TRIAL_WINDOW_MS - 60_000)).toISOString()
    expect(isTrialEligible(last, NOW)).toBe(false)
  })

  it('exactly 24h unlocks again', () => {
    const last = new Date(NOW - COACH_TRIAL_WINDOW_MS).toISOString()
    expect(isTrialEligible(last, NOW)).toBe(true)
  })

  it('unparseable timestamp fails open to eligible (server remains authoritative)', () => {
    expect(isTrialEligible('not-a-date', NOW)).toBe(true)
  })
})

describe('nextEligibleAt / formatTrialCountdown', () => {
  it('returns null when already eligible', () => {
    expect(nextEligibleAt(null, NOW)).toBeNull()
  })

  it('returns last + 24h inside the window', () => {
    const last = new Date(NOW - 3_600_000).toISOString()
    expect(nextEligibleAt(last, NOW)).toBe(new Date(NOW - 3_600_000 + COACH_TRIAL_WINDOW_MS).toISOString())
  })

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
    jest.spyOn(SubscriptionService, 'getStatus').mockResolvedValue({
      isPremium: true,
      subscriptionProvider: 'GOOGLE_PLAY',
      subscriptionPlan: 'monthly',
      purchaseToken: 'tok',
      subscriptionExpiryDate: null,
      autoRenewStatus: true,
      purchaseState: null,
      lastVerifiedDate: null,
      subscriptionStatus: 'active',
    })
    const state = await getCoachTrialState('user-1', NOW)
    expect(state.isPremium).toBe(true)
    expect(state.eligible).toBe(true)
    expect(state.nextEligibleAt).toBeNull()
  })

  it('opening without starting never consumes (read is side-effect free)', async () => {
    jest.spyOn(SubscriptionService, 'getStatus').mockResolvedValue({
      isPremium: false,
      subscriptionProvider: null,
      subscriptionPlan: null,
      purchaseToken: null,
      subscriptionExpiryDate: null,
      autoRenewStatus: false,
      purchaseState: null,
      lastVerifiedDate: null,
      subscriptionStatus: null,
    })
    mockServerSelect(null)
    const state = await getCoachTrialState('user-2', NOW)
    expect(state.eligible).toBe(true)
    expect(localStorage.getItem('chessduo_coach_trial_user-2')).toBeNull()
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
    jest.spyOn(SubscriptionService, 'getStatus').mockResolvedValue({
      isPremium: false,
      subscriptionProvider: null,
      subscriptionPlan: null,
      purchaseToken: null,
      subscriptionExpiryDate: null,
      autoRenewStatus: false,
      purchaseState: null,
      lastVerifiedDate: null,
      subscriptionStatus: null,
    })
    const { update } = mockServerUpdate(null)

    const first = await claimCoachDailyTrial('user-3', 'session-a', NOW)
    expect(first.claimed).toBe(true)
    expect(first.persisted).toBe(true)
    expect(first.state.eligible).toBe(false)
    expect(update).toHaveBeenCalledTimes(1)

    const second = await claimCoachDailyTrial('user-3', 'session-a', NOW + 1000)
    expect(second.claimed).toBe(true)
    // No additional server WRITE for the duplicate callback (reads may occur).
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('second game inside the window is blocked', async () => {
    jest.spyOn(SubscriptionService, 'getStatus').mockResolvedValue({
      isPremium: false,
      subscriptionProvider: null,
      subscriptionPlan: null,
      purchaseToken: null,
      subscriptionExpiryDate: null,
      autoRenewStatus: false,
      purchaseState: null,
      lastVerifiedDate: null,
      subscriptionStatus: null,
    })
    mockServerUpdate(null)

    await claimCoachDailyTrial('user-4', 'session-1', NOW)
    const blocked = await claimCoachDailyTrial('user-4', 'session-2', NOW + 60_000)
    expect(blocked.claimed).toBe(false)
    expect(blocked.state.eligible).toBe(false)
    expect(blocked.state.nextEligibleAt).not.toBeNull()
  })

  it('server failure still consumes locally but reports persisted:false for retry', async () => {
    jest.spyOn(SubscriptionService, 'getStatus').mockResolvedValue({
      isPremium: false,
      subscriptionProvider: null,
      subscriptionPlan: null,
      purchaseToken: null,
      subscriptionExpiryDate: null,
      autoRenewStatus: false,
      purchaseState: null,
      lastVerifiedDate: null,
      subscriptionStatus: null,
    })
    mockServerUpdate({ message: 'network down' })

    const result = await claimCoachDailyTrial('user-5', 'session-x', NOW)
    expect(result.claimed).toBe(true)
    expect(result.persisted).toBe(false)
    // Local mirror holds the claim so the gate stays consistent.
    expect(localStorage.getItem('chessduo_coach_trial_user-5')).not.toBeNull()
  })
})
