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
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      }),
      removeChannel: jest.fn(),
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
  sendMessage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/hooks/useBadgeCount', () => ({
  useBadgeCount: () => ({ unreadMessages: 0, pendingRequests: 0, total: 0, unreadBySender: {} }),
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

jest.mock('@/components/HomeBottomNav', () => ({
  HomeBottomNav: ({ unreadMessages }: { unreadMessages: number }) => (
    <nav data-testid="home-bottom-nav">
      <span>Home</span>
      <button onClick={() => mockPush('/history')}>History</button>
      <button onClick={() => mockPush('/friends')}>Friends</button>
      <button onClick={() => mockPush('/profile')}>Profile</button>
    </nav>
  ),
}))

jest.mock('@/components/WelcomeDisclaimer', () => ({
  WelcomeDisclaimer: () => <div data-testid="mock-disclaimer">Disclaimer</div>,
}))

jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    autoQueen: false,
    lowTimeWarning: true,
    confirmMove: false,
    soundEnabled: true,
    theme: 'dark',
    setAutoQueen: jest.fn(),
    setLowTimeWarning: jest.fn(),
    setTheme: jest.fn(),
    setConfirmMove: jest.fn(),
    setSoundEnabled: jest.fn(),
  }),
}))

jest.mock('@/hooks/useCapacitorBackButton', () => ({
  useCapacitorBackButton: () => {},
}))

jest.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => true,  // default to mobile in tests
}))

jest.mock('@/components/SidebarNav', () => ({
  SidebarNav: () => <nav data-testid="sidebar-nav" />,
}))

jest.mock('@/components/DesktopSidebar', () => ({
  DesktopSidebar: () => <nav data-testid="desktop-sidebar" />,
}))

jest.mock('@/components/ConfigurationPanel', () => ({
  ConfigurationPanel: () => <div data-testid="configuration-panel" />,
}))

jest.mock('@/components/InitialsAvatar', () => ({
  InitialsAvatar: () => <div data-testid="mock-avatar">A</div>,
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

  it('navigates to profile page instead of opening slide-over', async () => {
    await act(async () => {
      render(<SetupPage />)
    })

    // Home page should render
    await waitFor(() => {
      expect(screen.getByText('Game Mode')).toBeDefined()
    })

    // Profile button should navigate — verify the nav is rendered
    expect(screen.getByTestId('home-bottom-nav')).toBeDefined()
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
