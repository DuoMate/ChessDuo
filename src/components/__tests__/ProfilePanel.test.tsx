import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfilePanel } from '@/components/ProfilePanel'
import { SubscriptionService } from '@/features/billing'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/lib/settings', () => ({
  useSettings: () => ({ theme: 'dark', setTheme: jest.fn() }),
}))

jest.mock('@/lib/matchHistory', () => ({
  getMatchHistory: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/share', () => ({
  shareLink: jest.fn().mockResolvedValue('shared'),
}))

jest.mock('@/lib/realtimeService', () => ({
  RealtimeService: {
    subscribeToTable: jest.fn().mockReturnValue({}),
    cleanupChannel: jest.fn(),
  },
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({}),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { username: 'TestPlayer', avatar_url: null } }),
        }),
      }),
    }),
  },
}))

jest.mock('@/components/InitialsAvatar', () => ({
  InitialsAvatar: ({ username }: { username: string }) => (
    <div data-testid="initials-avatar">{username}</div>
  ),
}))

jest.mock('@/components/ProfileEditor', () => ({
  ProfileEditor: () => <div data-testid="profile-editor">Profile Editor</div>,
}))

jest.mock('@/features/billing', () => {
  const actual = jest.requireActual('@/features/billing')
  return {
    ...actual,
    SubscriptionService: {
      getStatus: jest.fn().mockResolvedValue({
        isPremium: false,
        subscriptionProvider: null,
        subscriptionPlan: null,
        purchaseToken: null,
        subscriptionExpiryDate: null,
        autoRenewStatus: false,
        purchaseState: null,
        lastVerifiedDate: null,
        subscriptionStatus: null,
      }),
      invalidate: jest.fn(),
    },
  }
})

const renderPanel = (props = {}) =>
  render(
    <ProfilePanel
      playerId="player-1"
      onViewHistory={jest.fn()}
      onSignOut={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />
  )

describe('ProfilePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows upgrade button when not premium', async () => {
    renderPanel()
    expect(await screen.findByText('Upgrade to Premium')).toBeDefined()
  })

  it('shows premium active card with plan when premium', async () => {
    ;(SubscriptionService.getStatus as jest.Mock).mockResolvedValueOnce({
      isPremium: true,
      subscriptionProvider: 'CREEM',
      subscriptionPlan: 'monthly',
      purchaseToken: 'chk_123',
      subscriptionExpiryDate: '2026-08-30T00:00:00.000Z',
      autoRenewStatus: true,
      purchaseState: 'purchased',
      lastVerifiedDate: '2026-07-31T00:00:00.000Z',
      subscriptionStatus: 'active',
    })

    renderPanel()

    expect(await screen.findByText('Premium Active')).toBeDefined()
    expect(screen.getByText('Monthly plan')).toBeDefined()
    expect(screen.getByText('Creem')).toBeDefined()
    expect(screen.queryByText('Upgrade to Premium')).toBeNull()
  })

  it('shows annual plan when premium yearly', async () => {
    ;(SubscriptionService.getStatus as jest.Mock).mockResolvedValueOnce({
      isPremium: true,
      subscriptionProvider: 'CREEM',
      subscriptionPlan: 'yearly',
      purchaseToken: 'chk_123',
      subscriptionExpiryDate: '2026-08-30T00:00:00.000Z',
      autoRenewStatus: true,
      purchaseState: 'purchased',
      lastVerifiedDate: '2026-07-31T00:00:00.000Z',
      subscriptionStatus: 'active',
    })

    renderPanel()

    expect(await screen.findByText('Premium Active')).toBeDefined()
    expect(screen.getByText('Annual plan')).toBeDefined()
  })

  it('shows spinner while checking premium status', async () => {
    let resolveStatus: (value: unknown) => void = () => {}
    ;(SubscriptionService.getStatus as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => { resolveStatus = resolve })
    )

    renderPanel()
    expect(screen.getByRole('status')).toBeDefined()

    // Clean up the pending promise so React stops warning about unmount.
    resolveStatus({
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
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})
