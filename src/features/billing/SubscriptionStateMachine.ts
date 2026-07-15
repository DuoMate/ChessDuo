import type { SubscriptionState, SubscriptionEvent } from './types'

const transitions: Record<SubscriptionState, Partial<Record<SubscriptionEvent, SubscriptionState>>> = {
  active: {
    expire: 'expired',
    grace: 'grace_period',
    hold: 'on_hold',
    pause: 'on_hold',
    cancel: 'cancelled',
  },
  grace_period: {
    purchase: 'active',
    restore: 'active',
    expire: 'expired',
    cancel: 'cancelled',
  },
  on_hold: {
    purchase: 'active',
    restore: 'active',
    expire: 'expired',
    cancel: 'cancelled',
  },
  pending: {
    purchase: 'active',
    check: 'active',
    expire: 'expired',
  },
  expired: {
    purchase: 'active',
    restore: 'active',
  },
  cancelled: {
    purchase: 'active',
    restore: 'active',
  },
}

export function transition(current: SubscriptionState, event: SubscriptionEvent): SubscriptionState {
  const next = transitions[current]?.[event]
  return next ?? current
}
