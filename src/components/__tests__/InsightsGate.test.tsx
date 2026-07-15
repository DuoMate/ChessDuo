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
    insights.getUserInsightsState.mockResolvedValue({
      revealsUsed: 3,
      isPremium: false,
      revealsRemaining: 0,
    })
    render(<InsightsGate {...baseProps} />)
    const upsell = await screen.findByText(/Get Premium/i)
    expect(upsell).toBeDefined()
    expect(screen.getByText(/0\/3 free insights used/i)).toBeDefined()
  })

  test('shows MoveInsights immediately when user is premium', async () => {
    const billing = require('@/features/billing')
    billing.SubscriptionService.isPremium.mockResolvedValue(true)
    render(<InsightsGate {...baseProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('move-insights')).toBeDefined()
    })
  })
})
