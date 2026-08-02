import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/delete-account',
}))

jest.mock('@/hooks/useCapacitorBackButton', () => ({
  useCapacitorBackButton: () => {},
}))

jest.mock('@/components/BackButton', () => ({
  BackButton: ({ label }: { label?: string }) => (
    <button data-testid="back-button">{label || 'Back'}</button>
  ),
}))

jest.mock('@/components/AuthGate', () => ({
  AuthGate: ({ children }: { children: (playerId: string) => React.ReactNode; pageTitle: string; pageEmoji: string; subtitle: string }) => (
    <div data-testid="auth-gate">{children('user-123')}</div>
  ),
}))

jest.mock('@/lib/supabase', () => {
  const actual = {
    auth: {
      getSession: jest.fn(),
      signOut: jest.fn(),
    },
    rpc: jest.fn(),
  }
  return {
    supabase: actual,
    __mockSupabase: actual,
  }
})

import DeleteAccountPage from '../page'

function getMockSupabase() {
  const mod = require('@/lib/supabase')
  return mod.__mockSupabase
}

function setupFetchMock(response: { ok: boolean; status: number; json: () => Promise<any> }) {
  const mockFetch = jest.fn().mockResolvedValue(response)
  globalThis.fetch = mockFetch
  return mockFetch
}

describe('DeleteAccountPage', () => {
  let supabaseMock: any

  beforeEach(() => {
    jest.clearAllMocks()
    supabaseMock = getMockSupabase()
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123', email: 'test@test.com' } } },
    })
    supabaseMock.auth.signOut.mockResolvedValue({ error: null })
    supabaseMock.rpc.mockResolvedValue({ error: null })
    globalThis.fetch = jest.fn()
  })

  it('renders the info step with delete options', async () => {
    await act(async () => {
      render(<DeleteAccountPage />)
    })

    expect(screen.getByText('Delete Account')).toBeDefined()
    expect(screen.getByText('Delete My Account')).toBeDefined()
  })

  it('navigates to confirm step when clicking Delete My Account', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<DeleteAccountPage />)
    })

    await user.click(screen.getByText('Delete My Account'))

    expect(screen.getByText('Are you sure?')).toBeDefined()
  })

  it('calls POST /api/delete-account on confirm (not supabase.rpc)', async () => {
    const user = userEvent.setup()
    const mockFetch = setupFetchMock({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      render(<DeleteAccountPage />)
    })

    await user.click(screen.getByText('Delete My Account'))
    await user.click(screen.getByText('Yes, Permanently Delete Everything'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/delete-account'), expect.objectContaining({
        method: 'POST',
      }))
    })

    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('delete_my_account')
    expect(supabaseMock.auth.signOut).toHaveBeenCalled()
  })

  it('shows done state on successful deletion', async () => {
    const user = userEvent.setup()
    setupFetchMock({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    })

    await act(async () => {
      render(<DeleteAccountPage />)
    })

    await user.click(screen.getByText('Delete My Account'))
    await user.click(screen.getByText('Yes, Permanently Delete Everything'))

    await waitFor(() => {
      expect(screen.getByText('Account Deleted')).toBeDefined()
    })
  })

  it('shows error state on API failure', async () => {
    const user = userEvent.setup()
    setupFetchMock({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    await act(async () => {
      render(<DeleteAccountPage />)
    })

    await user.click(screen.getByText('Delete My Account'))
    await user.click(screen.getByText('Yes, Permanently Delete Everything'))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeDefined()
    })
  })

  it('shows error on network failure', async () => {
    const user = userEvent.setup()
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    await act(async () => {
      render(<DeleteAccountPage />)
    })

    await user.click(screen.getByText('Delete My Account'))
    await user.click(screen.getByText('Yes, Permanently Delete Everything'))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeDefined()
    })
  })

  it('shows error if not signed in', async () => {
    const user = userEvent.setup()
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: null },
    })

    await act(async () => {
      render(<DeleteAccountPage />)
    })

    await user.click(screen.getByText('Delete My Account'))
    await user.click(screen.getByText('Yes, Permanently Delete Everything'))

    await waitFor(() => {
      expect(screen.getByText('You must be signed in to delete your account')).toBeDefined()
    })
  })
})
