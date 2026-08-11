import React from 'react'
import { render, screen } from '@testing-library/react'
import PremiumPage from '../(main)/premium/page'
import { SubscriptionService } from '@/features/billing'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/premium',
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
  GooglePlayBillingProvider: {},
}))

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function setNativePlatform(native: boolean) {
  if (native) {
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor = { isNativePlatform: () => true }
  } else {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor
  }
}

describe('PremiumPage Component — Web', () => {
  beforeEach(() => { setNativePlatform(false) })

  test('renders the ChessDuo Premium heading', async () => {
    render(<PremiumPage />)
    const heading = await screen.findByText('Premium')
    expect(heading).toBeDefined()
  })

  test('shows download app CTA on web', async () => {
    render(<PremiumPage />)
    const heading = await screen.findByText('Premium on Android')
    expect(heading).toBeDefined()
    const download = screen.getByText('Download on Google Play')
    expect(download).toBeDefined()
  })

  test('does not show pricing cards on web', async () => {
    render(<PremiumPage />)
    await screen.findByText('Premium on Android')
    expect(screen.queryByText('Monthly')).toBeNull()
    expect(screen.queryByText('Annual')).toBeNull()
    expect(screen.queryByText('Upgrade to Premium')).toBeNull()
  })

  test('does not show Restore Purchases on web', async () => {
    render(<PremiumPage />)
    await screen.findByText('Premium on Android')
    expect(screen.queryByText('Restore Purchases')).toBeNull()
  })

  test('renders feature list', async () => {
    render(<PremiumPage />)
    const feature = await screen.findByText('Unlimited Move Insights')
    expect(feature).toBeDefined()
  })
})

describe('PremiumPage Component — Native (Android)', () => {
  beforeEach(() => { setNativePlatform(true) })

  test('renders Monthly plan card on native', async () => {
    render(<PremiumPage />)
    const monthly = await screen.findByText('Monthly')
    expect(monthly).toBeDefined()
  })

  test('renders Annual plan card on native', async () => {
    render(<PremiumPage />)
    const annual = await screen.findByText('Annual')
    expect(annual).toBeDefined()
  })

  test('renders Upgrade to Premium buttons on native', async () => {
    render(<PremiumPage />)
    const buttons = await screen.findAllByText('Upgrade to Premium')
    expect(buttons).toHaveLength(2)
  })

  test('shows Restore Purchases button on native', async () => {
    render(<PremiumPage />)
    const restore = await screen.findByText('Restore Purchases')
    expect(restore).toBeDefined()
  })

  test('shows premium success screen when premium', async () => {
    ;(SubscriptionService.getStatus as jest.Mock).mockResolvedValueOnce({
      isPremium: true,
      subscriptionProvider: 'GOOGLE_PLAY',
      subscriptionPlan: 'yearly',
      purchaseToken: 'gpa_123',
      subscriptionExpiryDate: '2026-08-30T00:00:00.000Z',
      autoRenewStatus: true,
      purchaseState: 'active',
      lastVerifiedDate: '2026-07-31T00:00:00.000Z',
      subscriptionStatus: 'active',
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
    expect(screen.getByText('Secured by Google Play')).toBeDefined()
    expect(screen.getByText(/Thank you for choosing ChessDuo Premium/)).toBeDefined()
    expect(screen.getByText('Go to Dashboard')).toBeDefined()
  })
})
