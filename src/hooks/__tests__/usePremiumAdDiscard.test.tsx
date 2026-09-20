import { render, act, waitFor } from '@testing-library/react'
import { PremiumProvider, usePremium } from '../usePremium'
import { AuthService } from '@/lib/authService'
import { SubscriptionService } from '@/features/billing'
import { discardPreloadedAd } from '@/lib/nativeAd'

// ADS-03: premium upgrade must destroy any unused preloaded ad. Entitlement
// logic itself is untouched — this only asserts the ad-cache side effect.

jest.mock('@/lib/authService', () => ({
  AuthService: {
    getSession: jest.fn(),
    onAuthChange: jest.fn(() => jest.fn()),
  },
}))

jest.mock('@/features/billing', () => ({
  SubscriptionService: {
    isPremium: jest.fn(),
    invalidate: jest.fn(),
  },
}))

jest.mock('@/lib/realtimeService', () => ({
  RealtimeService: {
    subscribeToTable: jest.fn(() => ({})),
    cleanupChannel: jest.fn(),
  },
}))

jest.mock('@/lib/nativeAd', () => ({
  discardPreloadedAd: jest.fn(() => Promise.resolve()),
}))

const getSession = AuthService.getSession as jest.Mock
const onAuthChange = AuthService.onAuthChange as jest.Mock
const isPremiumMethod = SubscriptionService.isPremium as jest.Mock
const discard = discardPreloadedAd as jest.Mock

type AuthEvent = 'SIGNED_IN' | 'INITIAL_SESSION' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'
let authListener: ((event: AuthEvent, session: unknown) => void) | null = null

function Probe() {
  const { isPremium, loading } = usePremium()
  return <div data-testid="probe">{`${isPremium}:${loading}`}</div>
}

describe('PremiumProvider ad-cache discard (ADS-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    authListener = null
    onAuthChange.mockImplementation((cb: (event: AuthEvent, session: unknown) => void) => {
      authListener = cb
      return jest.fn()
    })
    getSession.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('discards the preloaded ad when the user becomes premium', async () => {
    isPremiumMethod.mockResolvedValue(true)
    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>,
    )
    // Provider only checks premium on auth events — simulate sign-in.
    await act(async () => {
      authListener?.('SIGNED_IN', { user: { id: 'u1' } })
    })
    await waitFor(() => expect(discard).toHaveBeenCalledTimes(1))
  })

  it('does not discard for free users', async () => {
    isPremiumMethod.mockResolvedValue(false)
    render(
      <PremiumProvider>
        <Probe />
      </PremiumProvider>,
    )
    await act(async () => {
      authListener?.('SIGNED_IN', { user: { id: 'u1' } })
    })
    await act(async () => {})
    expect(discard).not.toHaveBeenCalled()
  })
})
