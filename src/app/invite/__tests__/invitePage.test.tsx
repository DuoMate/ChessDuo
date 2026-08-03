import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InvitePageClient from '../[userId]/client'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useParams: () => ({ userId: 'test-user-id' }),
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => '/invite/test-user-id',
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'current-user-id' } } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { username: 'test-target' } }),
        }),
      }),
    }),
  },
}))

jest.mock('@/lib/friends', () => ({
  isFriend: jest.fn().mockResolvedValue(true),
  sendFriendRequest: jest.fn().mockResolvedValue({ error: null }),
}))

jest.mock('@/lib/profileService', () => ({
  getProfileUsername: jest.fn().mockResolvedValue('test-target'),
}))

jest.mock('@/components/Auth', () => ({
  Auth: () => <div data-testid="auth">Auth</div>,
}))

jest.mock('@/components/ChooseUsername', () => ({
  ChooseUsername: () => <div data-testid="choose-username">ChooseUsername</div>,
}))

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div data-testid="error-boundary">{children}</div>,
}))

describe('InvitePageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows "Already Friends" when isFriend returns true', async () => {
    render(<InvitePageClient />)

    await waitFor(() => {
      expect(screen.getByText('Already Friends!')).toBeInTheDocument()
    })
    expect(screen.getByText('You and test-target are already friends')).toBeInTheDocument()
  })

  it('shows a consent button instead of auto-sending when not friends (Bug: invite auto-send)', async () => {
    require('@/lib/friends').isFriend.mockResolvedValueOnce(false)
    const sendFriendRequest = require('@/lib/friends').sendFriendRequest

    render(<InvitePageClient />)

    await waitFor(() => {
      expect(screen.getByText('Send Friend Request')).toBeInTheDocument()
    })
    expect(sendFriendRequest).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Send Friend Request'))

    await waitFor(() => {
      expect(sendFriendRequest).toHaveBeenCalledWith('current-user-id', 'test-user-id')
    })
    expect(screen.getByText('Friend Request Sent!')).toBeInTheDocument()
  })

  it('Go Home button navigates to /', async () => {
    render(<InvitePageClient />)

    await waitFor(() => {
      expect(screen.getByText('Already Friends!')).toBeInTheDocument()
    })
    const goHomeButton = screen.getByText('Go Home')
    fireEvent.click(goHomeButton)

    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('shows "Cannot Add Yourself" when user invites themselves', async () => {
    const getSession = require('@/lib/supabase').supabase.auth.getSession
    getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'test-user-id' } } },
    })

    render(<InvitePageClient />)

    await waitFor(() => {
      expect(screen.getByText('Cannot Add Yourself')).toBeInTheDocument()
    })
    expect(screen.getByText('You cannot add yourself as a friend')).toBeInTheDocument()

    const goHomeButton = screen.getByText('Go Home')
    fireEvent.click(goHomeButton)

    expect(mockPush).toHaveBeenCalledWith('/')
  })
})
