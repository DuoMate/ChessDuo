import { renderHook, act } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { useNavigationGuard } from '../useNavigationGuard'

describe('useNavigationGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns blockNavigation, unblockNavigation, and confirmLeave', () => {
    const onLeave = jest.fn()
    const { result } = renderHook(() =>
      useNavigationGuard({ enabled: true, onAttemptLeave: onLeave })
    )
    expect(result.current.blockNavigation).toBeDefined()
    expect(result.current.unblockNavigation).toBeDefined()
    expect(result.current.confirmLeave).toBeDefined()
  })

  it('does not fire onAttemptLeave when disabled', () => {
    const onLeave = jest.fn()
    renderHook(() => useNavigationGuard({ enabled: false, onAttemptLeave: onLeave }))

    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('does not fire onAttemptLeave on beforeunload (uses browser native dialog)', () => {
    const onLeave = jest.fn()
    renderHook(() => useNavigationGuard({ enabled: true, onAttemptLeave: onLeave }))

    window.dispatchEvent(new Event('beforeunload'))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('confirmLeave navigates to /', () => {
    const onLeave = jest.fn()
    const { result } = renderHook(() =>
      useNavigationGuard({ enabled: true, onAttemptLeave: onLeave })
    )

    act(() => {
      result.current.confirmLeave()
    })
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('cleans up event listeners on unmount', () => {
    const onLeave = jest.fn()
    const removeSpy = jest.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useNavigationGuard({ enabled: true, onAttemptLeave: onLeave })
    )

    unmount()
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function), { capture: true })
    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function), { capture: true })
  })

  it('pushes a blocker history entry on mount when enabled', () => {
    const pushState = jest.spyOn(window.history, 'pushState')
    renderHook(() => useNavigationGuard({ enabled: true, onAttemptLeave: jest.fn() }))
    expect(pushState).toHaveBeenCalled()
  })
})
