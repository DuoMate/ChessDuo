import React from 'react'
import { render, screen } from '@testing-library/react'
import PremiumPage from '../(main)/premium/page'
import { SubscriptionService } from '@/features/billing'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('@/features/billing', () => ({
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
    getPlans: jest.fn().mockResolvedValue([
      { productId: 'premium_monthly', title: 'Monthly', subtitle: 'Flexible', price: '\u20B999', description: 'Monthly', billingPeriod: 'monthly' },
      { productId: 'premium_yearly', title: 'Annual', subtitle: 'Most popular choice', price: '\u20B9999', description: 'Annual', billingPeriod: 'yearly' },
    ]),
    purchaseMonthly: jest.fn().mockResolvedValue({ success: false, error: 'not initialized' }),
    purchaseYearly: jest.fn().mockResolvedValue({ success: false, error: 'not initialized' }),
    restore: jest.fn().mockResolvedValue(false),
    isPremium: jest.fn().mockResolvedValue(false),
    initialize: jest.fn().mockResolvedValue(undefined),
    setProvider: jest.fn(),
    invalidate: jest.fn(),
  },
  CreemBillingProvider: {},
}))

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('PremiumPage Component', () => {
  test('renders the ChessDuo Premium heading', async () => {
    render(<PremiumPage />)
    const heading = await screen.findByText('Premium')
    expect(heading).toBeDefined()
    const chessText = screen.getByText('Chess')
    expect(chessText).toBeDefined()
    const duoText = screen.getByText('Duo')
    expect(duoText).toBeDefined()
  })

  test('renders Monthly plan card', async () => {
    render(<PremiumPage />)
    const monthly = await screen.findByText('Monthly')
    expect(monthly).toBeDefined()
  })

  test('renders Annual plan card', async () => {
    render(<PremiumPage />)
    const annual = await screen.findByText('Annual')
    expect(annual).toBeDefined()
  })

  test('renders Upgrade to Premium buttons', async () => {
    render(<PremiumPage />)
    const buttons = await screen.findAllByText('Upgrade to Premium')
    expect(buttons).toHaveLength(2)
  })

  test('renders feature list', async () => {
    render(<PremiumPage />)
    const feature = await screen.findByText('Unlimited Move Insights')
    expect(feature).toBeDefined()
  })

  test('shows free insights note', async () => {
    render(<PremiumPage />)
    const note = await screen.findByText(/3 free insights/i)
    expect(note).toBeDefined()
  })

  test('shows Restore Purchases button', async () => {
    render(<PremiumPage />)
    const restore = await screen.findByText('Restore Purchases')
    expect(restore).toBeDefined()
  })

  test('verifies a checkout and shows premium after upgrade', async () => {
    // session_id is no longer in the URL — the API resolves it from
    // pending_checkout_id stored at checkout creation time.
    window.history.replaceState({}, '', '/premium')

    const premiumStatus = {
      isPremium: true,
      subscriptionProvider: 'CREEM',
      subscriptionPlan: 'monthly',
      purchaseToken: 'chk_123',
      subscriptionExpiryDate: '2026-08-30T00:00:00.000Z',
      autoRenewStatus: true,
      purchaseState: 'purchased',
      lastVerifiedDate: '2026-07-31T00:00:00.000Z',
      subscriptionStatus: 'active',
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ verified: true, status: premiumStatus }),
    })

    render(<PremiumPage />)
    const premium = await screen.findByText(/You're Premium/)
    expect(premium).toBeDefined()
    expect(SubscriptionService.invalidate).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/creem/verify-checkout'),
      expect.anything(),
    )
  })

  test('success layout renders all premium success elements', async () => {
    window.history.replaceState({}, '', '/premium')

    const premiumStatus = {
      isPremium: true,
      subscriptionProvider: 'CREEM',
      subscriptionPlan: 'yearly',
      purchaseToken: 'chk_123',
      subscriptionExpiryDate: '2026-08-30T00:00:00.000Z',
      autoRenewStatus: true,
      purchaseState: 'purchased',
      lastVerifiedDate: '2026-07-31T00:00:00.000Z',
      subscriptionStatus: 'active',
    }

    ;(SubscriptionService.getStatus as jest.Mock).mockResolvedValueOnce(premiumStatus)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ verified: true, status: premiumStatus }),
    })

    render(<PremiumPage />)

    expect(await screen.findByText('Welcome to Premium!')).toBeDefined()
    expect(screen.getByText(/Unlock the best tools/)).toBeDefined()
    expect(screen.getByText('Annual Plan')).toBeDefined()
    expect(screen.getByText(/Unlimited move insights/)).toBeDefined()
    expect(screen.getByText('Unlimited')).toBeDefined()
    expect(screen.getByText('Move Insights')).toBeDefined()
    expect(screen.getByText('AI')).toBeDefined()
    expect(screen.getByText('Analysis')).toBeDefined()
    expect(screen.getByText('All Premium')).toBeDefined()
    expect(screen.getByText('Features')).toBeDefined()
    expect(screen.getByText('Secure &')).toBeDefined()
    expect(screen.getByText('Protected')).toBeDefined()
    expect(screen.getByText('Secured by Creem')).toBeDefined()
    expect(screen.getByText(/Thank you for choosing ChessDuo Premium/)).toBeDefined()
    expect(screen.getByText('Go to Dashboard')).toBeDefined()
  })
})
