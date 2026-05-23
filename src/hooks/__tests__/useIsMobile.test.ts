import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../useIsMobile'

describe('useIsMobile', () => {
  let matchMediaListeners: Array<EventListener> = []

  beforeEach(() => {
    matchMediaListeners = []
  })

  const setScreenWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    window.dispatchEvent(new Event('resize'))
  }

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('767') ? window.innerWidth < 768 : false,
        media: query,
        onchange: null,
        addEventListener: (_event: string, listener: EventListener) => {
          matchMediaListeners.push(listener)
        },
        removeEventListener: (_event: string, listener: EventListener) => {
          matchMediaListeners = matchMediaListeners.filter(l => l !== listener)
        },
        dispatchEvent: (_event: Event) => false,
        addListener: (listener: EventListener) => {
          matchMediaListeners.push(listener)
        },
        removeListener: (listener: EventListener) => {
          matchMediaListeners = matchMediaListeners.filter(l => l !== listener)
        },
      }),
    })
  })

  it('returns false for desktop screen width', () => {
    setScreenWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true for mobile screen width', () => {
    setScreenWidth(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false at exact breakpoint (768)', () => {
    setScreenWidth(768)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true just below breakpoint (767)', () => {
    setScreenWidth(767)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns true for very small screens', () => {
    setScreenWidth(320)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false for large desktop screens', () => {
    setScreenWidth(1920)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })
})
