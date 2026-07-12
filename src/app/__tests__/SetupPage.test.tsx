import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockSearchParams = new Map<string, string>()

// Capture the onAuthStateChange callback
let capturedAuthCallback: ((event: string, session: any) => void) | null = null

jest.mock('@/lib/supabase', () => {
  // Chainable mock builder — each method returns the chainable object
  const createChainableMock = (finalResult: any = { data: null, error: null }) => {
    const chained: any = {}
    const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'in', 'order', 'limit', 'range', 'single', 'maybeSingle', 'not', 'or', 'is', 'match', 'contains', 'containedBy', 'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte', 'rangeAdjacent', 'overlaps', 'textSearch', 'filter', 'abortSignal']
    methods.forEach(method => {
      chained[method] = jest.fn().mockReturnValue(chained)
    })
    chained.maybeSingle = jest.fn().mockResolvedValue(finalResult)
    chained.single = jest.fn().mockResolvedValue(finalResult)
    return chained
  }

  const noRoom = createChainableMock({ data: null, error: null })
  const userProfile = createChainableMock({ data: { username: 'TestUser' }, error: null })
  const defaultQuery = createChainableMock({ data: null, error: null })

  const mockFrom = jest.fn().mockImplementation((table: string) => {
    if (table === 'rooms') return noRoom
    if (table === 'profiles') return userProfile
    return defaultQuery
  })

  // Expose for tests
  ;(globalThis as any).__mockFrom = mockFrom

  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1', email: 'test@test.com' } } },
        }),
        onAuthStateChange: (cb: (event: string, session: any) => void) => {
          capturedAuthCallback = cb
          return { data: { subscription: { unsubscribe: jest.fn() } } }
        },
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
      from: mockFrom,
    },
  }
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
    toString: () => '',
  }),
  usePathname: () => '/',
}))

jest.mock('@/lib/friends', () => ({
  getFriendsList: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/messages', () => ({
  getUnreadCounts: jest.fn().mockResolvedValue({ total: 0, bySender: {} }),
  subscribeToMessages: jest.fn().mockReturnValue(jest.fn()),
  sendMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/roomActions', () => ({
  createOnlineRoom: jest.fn(),
}))

jest.mock('@/lib/fourPlayerActions', () => ({
  createFourPlayerRoom: jest.fn(),
  joinFourPlayerByCode: jest.fn(),
}))

jest.mock('@/lib/challenges', () => ({
  createChallenge: jest.fn(),
  getChallengeUrl: jest.fn(),
}))

jest.mock('@/features/bots/botConfig', () => ({
  getAvailableSkillLevels: () => [
    { level: 1, label: 'Beginner', description: 'Easy' },
    { level: 4, label: 'Expert', description: 'Hard' },
  ],
}))

jest.mock('@/components/Auth', () => ({
  Auth: () => <div data-testid="mock-auth">Auth</div>,
}))

jest.mock('@/components/ChooseUsername', () => ({
  ChooseUsername: () => <div data-testid="mock-choose-username">Choose Username</div>,
}))

jest.mock('@/components/SlideOver', () => ({
  SlideOver: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="mock-slideover">{children}</div> : null,
}))

jest.mock('@/components/ProfilePanel', () => ({
  ProfilePanel: ({ onSignOut }: { onSignOut: () => void; playerId: string; onViewHistory: () => void }) => (
    <div data-testid="mock-profile-panel">
      <button data-testid="sign-out-btn" onClick={onSignOut}>Sign Out</button>
    </div>
  ),
}))

jest.mock('@/components/FriendsPanel', () => ({
  FriendsPanel: () => <div data-testid="mock-friends-panel">Friends</div>,
}))

jest.mock('@/components/WelcomeDisclaimer', () => ({
  WelcomeDisclaimer: () => <div data-testid="mock-disclaimer">Disclaimer</div>,
}))

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/lib/settings', () => ({
  useSettings: () => [{}],
}))

import SetupPage from '../page'

describe('SetupPage — joinError persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new Map()
    capturedAuthCallback = null
    localStorage.clear()
  })

  it('shows joinError from auto-join failure and clears it on auth state change to null', async () => {
    // Valid format code but room doesn't exist
    mockSearchParams.set('code', 'ABC123')

    await act(async () => {
      render(<SetupPage />)
    })

    // Wait for auto-join to fail and error to appear
    await waitFor(() => {
      expect(screen.getByText('Room not found or already started')).toBeDefined()
    })

    // Simulate sign-out via auth state change (token expired, etc.)
    expect(capturedAuthCallback).not.toBeNull()
    await act(async () => {
      capturedAuthCallback!('SIGNED_OUT', null)
    })

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Room not found or already started')).toBeNull()
    })
  })

  it('clears joinError when user signs out via ProfilePanel', async () => {
    mockSearchParams.set('code', 'ABC123')

    await act(async () => {
      render(<SetupPage />)
    })

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Room not found or already started')).toBeDefined()
    })

    // Open profile slide-over
    const profileBtn = screen.getByText('Profile')
    await act(async () => {
      profileBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('sign-out-btn')).toBeDefined()
    })

    // Click Sign Out
    await act(async () => {
      screen.getByTestId('sign-out-btn').click()
    })

    // Error should be gone
    await waitFor(() => {
      expect(screen.queryByText('Room not found or already started')).toBeNull()
    })
  })

  it('does not show joinError when no code param is present', async () => {
    await act(async () => {
      render(<SetupPage />)
    })

    // Home page should render — verify by checking for Game Mode section
    await waitFor(() => {
      expect(screen.getByText('Game Mode')).toBeDefined()
    })

    // No error should be visible
    expect(screen.queryByText('Room not found or already started')).toBeNull()
    expect(screen.queryByText('Room not found')).toBeNull()
  })

  it('does not show stale joinError after re-mount without code param', async () => {
    // First mount: simulate failed auto-join
    mockSearchParams.set('code', 'ABC123')
    const { unmount } = await act(async () => {
      return render(<SetupPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Room not found or already started')).toBeDefined()
    })

    unmount()

    // Second mount: clean URL (no code param)
    mockSearchParams = new Map()
    await act(async () => {
      render(<SetupPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Game Mode')).toBeDefined()
    })

    // Stale error from previous mount should NOT appear
    expect(screen.queryByText('Room not found or already started')).toBeNull()
  })
})
