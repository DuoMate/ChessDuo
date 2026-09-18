import { renderHook, waitFor } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { useGameOverAdPreload } from '../useGameOverAdPreload'
import { preloadNativeAd } from '@/lib/nativeAd'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(() => true) },
}))

jest.mock('@/lib/nativeAd', () => ({
  preloadNativeAd: jest.fn(() => Promise.resolve(true)),
}))

jest.mock('@/hooks/usePremium', () => ({
  usePremium: jest.fn(),
}))

const { usePremium } = jest.requireMock('@/hooks/usePremium') as { usePremium: jest.Mock }

describe('useGameOverAdPreload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    usePremium.mockReturnValue({ isPremium: false, loading: false })
  })

  it('preloads once when the game becomes active for an eligible free user', async () => {
    const { rerender } = renderHook(({ active }) => useGameOverAdPreload(active), {
      initialProps: { active: false },
    })
    expect(preloadNativeAd).not.toHaveBeenCalled()

    rerender({ active: true })

    await waitFor(() => expect(preloadNativeAd).toHaveBeenCalledTimes(1))
  })

  it('never preloads for premium users', () => {
    usePremium.mockReturnValue({ isPremium: true, loading: false })
    renderHook(() => useGameOverAdPreload(true))
    expect(preloadNativeAd).not.toHaveBeenCalled()
  })

  it('never preloads while premium status is still loading', () => {
    usePremium.mockReturnValue({ isPremium: false, loading: true })
    renderHook(() => useGameOverAdPreload(true))
    expect(preloadNativeAd).not.toHaveBeenCalled()
  })

  it('never preloads on web (non-native platform)', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)
    renderHook(() => useGameOverAdPreload(true))
    expect(preloadNativeAd).not.toHaveBeenCalled()
  })

  it('does not refire on every render while staying active', async () => {
    const { rerender } = renderHook(({ active }) => useGameOverAdPreload(active), {
      initialProps: { active: true },
    })
    await waitFor(() => expect(preloadNativeAd).toHaveBeenCalledTimes(1))
    rerender({ active: true })
    rerender({ active: true })
    expect(preloadNativeAd).toHaveBeenCalledTimes(1)
  })
})
