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

  it('tags the blocker history entry so it can be recognized later', () => {
    const pushState = jest.spyOn(window.history, 'pushState')
    renderHook(() => useNavigationGuard({ enabled: true, onAttemptLeave: jest.fn() }))
    const stateArg = pushState.mock.calls[0][0] as Record<string, unknown>
    expect(stateArg.__chessduoNavGuard).toBe(true)
  })

  it('consumes the blocker entry when the guard deactivates (game over)', () => {
    jest.spyOn(window.history, 'pushState')
    // Simulate that our tagged sentinel is the live history entry.
    const stateSpy = jest.spyOn(window.history, 'state', 'get').mockReturnValue({ __chessduoNavGuard: true })
    const backSpy = jest.spyOn(window.history, 'back').mockImplementation(() => {})

    const { rerender } = renderHook(
      ({ enabled }) => useNavigationGuard({ enabled, onAttemptLeave: jest.fn() }),
      { initialProps: { enabled: true } },
    )

    expect(backSpy).not.toHaveBeenCalled()
    rerender({ enabled: false })
    expect(backSpy).toHaveBeenCalledTimes(1)

    stateSpy.mockRestore()
    backSpy.mockRestore()
  })

  it('does not consume history when the live entry is not our sentinel', () => {
    jest.spyOn(window.history, 'pushState')
    const stateSpy = jest.spyOn(window.history, 'state', 'get').mockReturnValue(null)
    const backSpy = jest.spyOn(window.history, 'back').mockImplementation(() => {})

    const { rerender } = renderHook(
      ({ enabled }) => useNavigationGuard({ enabled, onAttemptLeave: jest.fn() }),
      { initialProps: { enabled: true } },
    )
    rerender({ enabled: false })
    expect(backSpy).not.toHaveBeenCalled()

    stateSpy.mockRestore()
    backSpy.mockRestore()
  })
})

  describe('onOverlayBack', () => {
    it('calls onOverlayBack before onAttemptLeave on popstate', () => {
      const onLeave = jest.fn()
      const onOverlayBack = jest.fn(() => false)
      renderHook(() =>
        useNavigationGuard({ enabled: true, onAttemptLeave: onLeave, onOverlayBack })
      )

      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(onOverlayBack).toHaveBeenCalled()
      expect(onLeave).toHaveBeenCalled()
    })

    it('does not call onAttemptLeave when onOverlayBack returns true', () => {
      const onLeave = jest.fn()
      const onOverlayBack = jest.fn(() => true)
      renderHook(() =>
        useNavigationGuard({ enabled: true, onAttemptLeave: onLeave, onOverlayBack })
      )

      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(onOverlayBack).toHaveBeenCalled()
      expect(onLeave).not.toHaveBeenCalled()
    })

    it('works without onOverlayBack (backward compatible)', () => {
      const onLeave = jest.fn()
      renderHook(() =>
        useNavigationGuard({ enabled: true, onAttemptLeave: onLeave })
      )

      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(onLeave).toHaveBeenCalled()
    })
  })

  describe('hasOpenOverlay (completed game)', () => {
    it('pushes a blocker history entry when an overlay is open even when disabled', () => {
      const pushState = jest.spyOn(window.history, 'pushState')
      renderHook(() =>
        useNavigationGuard({
          enabled: false,
          onAttemptLeave: jest.fn(),
          onOverlayBack: jest.fn(() => true),
          hasOpenOverlay: true,
        })
      )
      expect(pushState).toHaveBeenCalled()
    })

    it('closes the overlay on popstate without firing onAttemptLeave when disabled', () => {
      const onLeave = jest.fn()
      const onOverlayBack = jest.fn(() => true)
      renderHook(() =>
        useNavigationGuard({ enabled: false, onAttemptLeave: onLeave, onOverlayBack, hasOpenOverlay: true })
      )

      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(onOverlayBack).toHaveBeenCalled()
      expect(onLeave).not.toHaveBeenCalled()
    })

    it('does not register a popstate handler when disabled and no overlay is open', () => {
      const onLeave = jest.fn()
      const onOverlayBack = jest.fn(() => false)
      renderHook(() =>
        useNavigationGuard({ enabled: false, onAttemptLeave: onLeave, onOverlayBack, hasOpenOverlay: false })
      )

      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(onOverlayBack).not.toHaveBeenCalled()
      expect(onLeave).not.toHaveBeenCalled()
    })

    it('consumes the sentinel when the overlay closes on a disabled game', () => {
      jest.spyOn(window.history, 'pushState')
      const stateSpy = jest.spyOn(window.history, 'state', 'get').mockReturnValue({ __chessduoNavGuard: true })
      const backSpy = jest.spyOn(window.history, 'back').mockImplementation(() => {})

      const { rerender } = renderHook(
        ({ hasOpenOverlay }) =>
          useNavigationGuard({
            enabled: false,
            onAttemptLeave: jest.fn(),
            onOverlayBack: jest.fn(() => true),
            hasOpenOverlay,
          }),
        { initialProps: { hasOpenOverlay: true } },
      )

      expect(backSpy).not.toHaveBeenCalled()
      rerender({ hasOpenOverlay: false })
      expect(backSpy).toHaveBeenCalledTimes(1)

      stateSpy.mockRestore()
      backSpy.mockRestore()
    })
  })
