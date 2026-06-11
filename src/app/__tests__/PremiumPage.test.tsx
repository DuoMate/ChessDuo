import React from 'react'
import { render, screen } from '@testing-library/react'
import PremiumPage from '../../app/premium/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { is_premium: false, subscription_status: 'inactive' },
          }),
        }),
      }),
    }),
  },
}))

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('PremiumPage Component', () => {
  test('renders the ChessDuo Premium heading', async () => {
    render(<PremiumPage />)
    const heading = await screen.findByText('ChessDuo Premium')
    expect(heading).toBeDefined()
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

  test('renders Subscribe Monthly button', async () => {
    render(<PremiumPage />)
    const button = await screen.findByText('Subscribe Monthly')
    expect(button).toBeDefined()
  })

  test('renders Subscribe Annual button', async () => {
    render(<PremiumPage />)
    const button = await screen.findByText('Subscribe Annual')
    expect(button).toBeDefined()
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
})
