/**
 * Central AI Coach daily-limit contract (TDD RED).
 *
 * Single source of truth: `AI_COACH_FREE_DAILY_LIMIT` in
 * `src/features/shared/gameConstants.ts`. Every number in user-facing
 * copy and every quota check must derive from it — changing 3 → 5 must
 * flip enforcement + messaging with no other edits.
 */
import {
  AI_COACH_FREE_DAILY_LIMIT,
  AI_COACH_FREE_DAILY_LIMIT_ENABLED,
} from '../../shared/gameConstants'
import {
  getAiCoachDailyLimit,
  getAiCoachDailyLimitMessage,
  getAiCoachLimitReachedMessage,
  getAiCoachRemainingMessage,
  getCoachDayKey,
  getRemainingToday,
  isAiCoachLimitEnabled,
} from '../coachTrial'

describe('AI Coach daily limit — single source of truth', () => {
  it('launch value is 3 and the limit switch exists', () => {
    expect(AI_COACH_FREE_DAILY_LIMIT).toBe(3)
    expect(AI_COACH_FREE_DAILY_LIMIT_ENABLED).toBe(true)
    expect(getAiCoachDailyLimit()).toBe(AI_COACH_FREE_DAILY_LIMIT)
    expect(isAiCoachLimitEnabled()).toBe(AI_COACH_FREE_DAILY_LIMIT_ENABLED)
  })

  it('limit message derives from the config (no hardcoded "3 free games")', () => {
    expect(getAiCoachDailyLimitMessage()).toBe(`${AI_COACH_FREE_DAILY_LIMIT} free games every day`)
  })

  it('remaining messages pluralize and derive from the config', () => {
    expect(getAiCoachRemainingMessage(2)).toBe('2 free games left today')
    expect(getAiCoachRemainingMessage(1)).toBe('1 free game left today')
    expect(getAiCoachRemainingMessage(0)).toBeNull()
  })

  it('limit-reached message derives from the config', () => {
    expect(getAiCoachLimitReachedMessage()).toBe(
      `You've used your ${AI_COACH_FREE_DAILY_LIMIT} free AI Coach games today.`,
    )
  })

  it('day keys are UTC calendar days and remaining math follows the limit', () => {
    expect(getCoachDayKey(new Date('2026-09-18T23:59:00.000Z').getTime())).toBe('2026-09-18')
    expect(getCoachDayKey(new Date('2026-09-19T00:01:00.000Z').getTime())).toBe('2026-09-19')
    expect(getRemainingToday(0)).toBe(AI_COACH_FREE_DAILY_LIMIT)
    expect(getRemainingToday(2)).toBe(AI_COACH_FREE_DAILY_LIMIT - 2)
    expect(getRemainingToday(99)).toBe(0)
  })
})
