import { renderHook, waitFor, act } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { useAppUpdate } from '../useAppUpdate'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(() => true) },
}))

jest.mock('@/lib/share', () => ({
  isNativePlatform: jest.fn(() => true),
}))

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}))

const { usePathname } = jest.requireMock('next/navigation') as {
  usePathname: jest.Mock
}

const { isNativePlatform } = jest.requireMock('@/lib/share') as {
  isNativePlatform: jest.Mock
}

const MANIFEST = {
  latestVersion: '1.0.387',
  latestVersionCode: 387,
  minimumVersion: '1.0.300',
  minimumVersionCode: 300,
  playUrl: 'https://play.google.com/store/apps/details?id=com.navron.chessduo',
}

function mockManifestFetch(manifest: typeof MANIFEST | null) {
  global.fetch = jest.fn(() =>
    manifest
      ? Promise.resolve({
          ok: true,
          json: () => Promise.resolve(manifest),
        })
      : Promise.reject(new Error('offline')),
  ) as unknown as typeof fetch
}

describe('useAppUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    sessionStorage.clear()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://chessduo.navron.org'
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.386'
    process.env.NEXT_PUBLIC_VERSION_CODE = '386'
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    isNativePlatform.mockReturnValue(true)
    ;(usePathname as jest.Mock).mockReturnValue('/')
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('reports optional when the installed build is older than the manifest', async () => {
    mockManifestFetch(MANIFEST)
    const { result } = renderHook(() => useAppUpdate())

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    await waitFor(() =>
      expect(result.current.status).toBe('optional'),
    )
    expect(result.current.manifest?.latestVersionCode).toBe(387)
  })

  it('stays current when the manifest cannot be reached (offline)', async () => {
    mockManifestFetch(null)
    const { result } = renderHook(() => useAppUpdate())

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Give the async check a chance to resolve; it must fail silently.
    await act(async () => {
      jest.advanceTimersByTime(0)
    })
    expect(result.current.status).toBe('current')
    expect(result.current.manifest).toBeNull()
  })

  it('stays current on web (never invokes the native update path)', () => {
    isNativePlatform.mockReturnValue(false)
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    const { result } = renderHook(() => useAppUpdate())

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(result.current.status).toBe('current')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('suppresses the prompt during active games', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/game')
    mockManifestFetch(MANIFEST)
    const { result } = renderHook(() => useAppUpdate())

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(result.current.status).toBe('current')
  })
})
