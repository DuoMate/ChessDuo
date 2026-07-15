import { transition } from '../SubscriptionStateMachine'
import type { SubscriptionState, SubscriptionEvent } from '../types'

describe('SubscriptionStateMachine', () => {
  describe('transition', () => {
    it.each<[SubscriptionState, SubscriptionEvent, SubscriptionState]>([
      ['active', 'expire', 'expired'],
      ['active', 'grace', 'grace_period'],
      ['active', 'hold', 'on_hold'],
      ['active', 'pause', 'on_hold'],
      ['active', 'cancel', 'cancelled'],
      ['grace_period', 'purchase', 'active'],
      ['grace_period', 'restore', 'active'],
      ['grace_period', 'expire', 'expired'],
      ['grace_period', 'cancel', 'cancelled'],
      ['on_hold', 'purchase', 'active'],
      ['on_hold', 'restore', 'active'],
      ['on_hold', 'expire', 'expired'],
      ['on_hold', 'cancel', 'cancelled'],
      ['pending', 'purchase', 'active'],
      ['pending', 'check', 'active'],
      ['pending', 'expire', 'expired'],
      ['expired', 'purchase', 'active'],
      ['expired', 'restore', 'active'],
      ['cancelled', 'purchase', 'active'],
      ['cancelled', 'restore', 'active'],
    ])('%s + %s → %s', (from, event, expected) => {
      expect(transition(from, event)).toBe(expected)
    })

    it.each<[SubscriptionState, SubscriptionEvent]>([
      ['active', 'purchase'],
      ['active', 'restore'],
      ['active', 'check'],
      ['pending', 'restore'],
      ['pending', 'grace'],
      ['expired', 'expire'],
      ['cancelled', 'expire'],
    ])('%s + %s → stays %s (no-op)', (from, event) => {
      expect(transition(from, event)).toBe(from)
    })
  })
})
