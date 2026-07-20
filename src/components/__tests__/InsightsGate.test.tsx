import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { InsightsGate } from '../InsightsGate'

jest.mock('@/lib/insights', () => ({
  getUserInsightsState: jest.fn().mockResolvedValue({
    revealsUsed: 0,
    isPremium: false,
    revealsRemaining: 3,
  }),
  incrementInsightsReveals: jest.fn().mockResolvedValue(2),
}))

jest.mock('@/features/billing', () => ({
  SubscriptionService: {
    isPremium: jest.fn().mockResolvedValue(false),
    setProvider: jest.fn(),
    initialize: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({ isPremium: false }),
    getPlans: jest.fn().mockResolvedValue([]),
    purchaseMonthly: jest.fn(),
    purchaseYearly: jest.fn(),
    restore: jest.fn(),
  },
  GooglePlayBillingProvider: {},
}))

jest.mock('../MoveInsights', () => ({
  MoveInsights: () => <div data-testid="move-insights">MoveInsights</div>,
}))

describe('InsightsGate Component', () => {
  const baseProps = {
    playerId: 'user-1',
    player1Move: 'e4',
    player2Move: 'e5',
    player1Accuracy: 100,
    player2Accuracy: 50,
    player1Loss: 0,
    player2Loss: 100,
    isSync: true,
    winnerId: 'player1' as const,
  }

  test('shows Reveal button when reveals are available', async () => {
    render(<InsightsGate {...baseProps} />)
    const button = await screen.findByText(/Reveal Move Insights/i)
    expect(button).toBeDefined()
  })

  test('shows remaining reveals count', async () => {
    render(<InsightsGate {...baseProps} />)
    const revealText = await screen.findByText(/3 free insights remaining/i)
    expect(revealText).toBeDefined()
  })

  test('shows premium upsell when no reveals remain', async () => {
    const insights = require('@/lib/insights')
    const billing = require('@/features/billing')
    billing.SubscriptionService.isPremium.mockResolvedValue(false)
    insights.getUserInsightsState.mockResolvedValue({
      revealsUsed: 3,
      isPremium: false,
      revealsRemaining: 0,
    })
    render(<InsightsGate {...baseProps} />)
    const upsell = await screen.findByText(/UPGRADE NOW/i)
    expect(upsell).toBeDefined()
    // Text is split across elements (UNLOCK <span>PREMIUM</span> INSIGHTS)
    const headings = await screen.findAllByRole('heading')
    const hasPremiumHeading = headings.some(h =>
      h.textContent?.includes('UNLOCK') &&
      h.textContent?.includes('PREMIUM') &&
      h.textContent?.includes('INSIGHTS')
    )
    expect(hasPremiumHeading).toBe(true)
    expect(screen.getByText(/VIEW PLANS/i)).toBeDefined()
  })

  test('shows MoveInsights immediately when user is premium', async () => {
    const billing = require('@/features/billing')
    billing.SubscriptionService.isPremium.mockResolvedValue(true)
    render(<InsightsGate {...baseProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('move-insights')).toBeDefined()
    })
  })

  test('calls onStateChange with insights state after loading', async () => {
    const onStateChange = jest.fn()
    const insights = require('@/lib/insights')
    const billing = require('@/features/billing')
    billing.SubscriptionService.isPremium.mockResolvedValue(false)
    insights.getUserInsightsState.mockResolvedValue({
      revealsUsed: 1,
      isPremium: false,
      revealsRemaining: 2,
    })
    render(<InsightsGate {...baseProps} onStateChange={onStateChange} />)
    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith({ isPremium: false, revealsRemaining: 2 })
    })
  })
})
