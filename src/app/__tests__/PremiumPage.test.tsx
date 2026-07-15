import React from 'react'
import { render, screen } from '@testing-library/react'
import PremiumPage from '../(main)/premium/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
  },
  GooglePlayBillingProvider: {},
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

  test('shows Managed by Google Play', async () => {
    render(<PremiumPage />)
    const managed = await screen.findByText('Managed by Google Play')
    expect(managed).toBeDefined()
  })

  test('shows Restore Purchases button', async () => {
    render(<PremiumPage />)
    const restore = await screen.findByText('Restore Purchases')
    expect(restore).toBeDefined()
  })
})
