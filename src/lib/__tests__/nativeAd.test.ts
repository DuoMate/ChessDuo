import { Capacitor, registerPlugin } from '@capacitor/core'
import { getLastAdError, hideNativeAd, preloadNativeAd, showNativeAd } from '../nativeAd'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn() },
  registerPlugin: jest.fn(() => ({
    preload: jest.fn().mockResolvedValue(undefined),
    show: jest.fn().mockResolvedValue(undefined),
    hide: jest.fn().mockResolvedValue(undefined),
  })),
}))

const nativeAdPlugin = (registerPlugin as jest.Mock).mock.results[0].value as {
  preload: jest.Mock
  show: jest.Mock
  hide: jest.Mock
}

describe('nativeAd', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID = 'ca-app-pub-test/native'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID
  })

  it('preloads, shows, and hides a configured native ad on native platforms', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)

    await preloadNativeAd()
    await showNativeAd({ x: 12, y: 24, width: 300, height: 180 })
    await hideNativeAd()

    expect(nativeAdPlugin.preload).toHaveBeenCalledWith({ adUnitId: 'ca-app-pub-test/native' })
    expect(nativeAdPlugin.show).toHaveBeenCalledWith({ x: 12, y: 24, width: 300, height: 180 })
    expect(nativeAdPlugin.hide).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent preload requests for the same native ad', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)

    const first = preloadNativeAd()
    const second = preloadNativeAd()

    await Promise.all([first, second])

    expect(nativeAdPlugin.preload).toHaveBeenCalledTimes(1)
  })

  it('does nothing on web', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)

    await preloadNativeAd()
    await showNativeAd({ x: 0, y: 0, width: 300, height: 180 })
    await hideNativeAd()

    expect(nativeAdPlugin.preload).not.toHaveBeenCalled()
    expect(nativeAdPlugin.show).not.toHaveBeenCalled()
    expect(nativeAdPlugin.hide).not.toHaveBeenCalled()
  })

  it('discards a stale preloaded ad after its TTL so the next game fetches fresh', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)

    // Fresh module instance so earlier tests' cached ad cannot leak in.
    let freshPreload: typeof preloadNativeAd
    let freshPlugin: { preload: jest.Mock }
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../nativeAd') as typeof import('../nativeAd')
      freshPreload = mod.preloadNativeAd
      const results = (registerPlugin as jest.Mock).mock.results
      freshPlugin = results[results.length - 1].value as { preload: jest.Mock }
    })

    await freshPreload!()
    expect(freshPlugin!.preload).toHaveBeenCalledTimes(1)
    // Same game session reuses the cached ad — no second native request.
    await freshPreload!()
    expect(freshPlugin!.preload).toHaveBeenCalledTimes(1)

    // Simulate the cached ad aging past its TTL: next game fetches fresh.
    const realNow = Date.now
    jest.spyOn(Date, 'now').mockReturnValue(realNow() + 61 * 60 * 1000)
    try {
      await freshPreload!()
      expect(freshPlugin!.preload).toHaveBeenCalledTimes(2)
    } finally {
      jest.restoreAllMocks()
    }
  })
})
describe('nativeAd diagnostics (ADS-01)', () => {
  const bounds = { x: 0, y: 0, width: 300, height: 180 }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID = 'ca-app-pub-test/native'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID
  })

  it('records the native error code/message when preload fails', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    // Clear any cached ad left by earlier tests so this preload hits native.
    await showNativeAd(bounds)
    nativeAdPlugin.preload.mockRejectedValue(
      Object.assign(new Error('No fill'), { code: 'ERROR_CODE_NO_FILL' }),
    )

    await expect(preloadNativeAd({ retryDelaysMs: [0, 0] })).resolves.toBe(false)
    expect(nativeAdPlugin.preload.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(getLastAdError()).toEqual({ code: 'ERROR_CODE_NO_FILL', message: 'No fill' })
  })

  it('clears the recorded error after a successful preload', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await showNativeAd(bounds)
    nativeAdPlugin.preload.mockRejectedValue(new Error('transient'))

    await expect(preloadNativeAd({ retryDelaysMs: [0, 0] })).resolves.toBe(false)
    expect(getLastAdError()).not.toBeNull()
    nativeAdPlugin.preload.mockReset()
    nativeAdPlugin.preload.mockResolvedValue(undefined)
    await expect(preloadNativeAd()).resolves.toBe(true)
    expect(getLastAdError()).toBeNull()
  })

  it('records the native error when show fails', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    nativeAdPlugin.preload.mockRejectedValue(
      Object.assign(new Error('refill pending'), { code: 'ERROR_CODE_NO_FILL' }),
    )
    nativeAdPlugin.show.mockRejectedValueOnce(
      Object.assign(new Error('show failed'), { code: 'ERROR_CODE_INTERNAL_ERROR' }),
    )

    nativeAdPlugin.preload.mockClear()
    await expect(showNativeAd(bounds)).resolves.toBe(false)
    // Recovery: the failed show kicks a background refill for the next placement.
    await new Promise<void>((resolve) => { setTimeout(resolve, 0) })
    expect(nativeAdPlugin.preload.mock.calls.length).toBe(1)
  })
})

describe('nativeAd retry + refill (ADS-02)', () => {
  const bounds = { x: 0, y: 0, width: 300, height: 180 }

  beforeEach(() => {
    // mockReset (not clear): persistent implementations set by earlier
    // suites must not leak into the retry-bound assertions below.
    nativeAdPlugin.preload.mockReset()
    nativeAdPlugin.preload.mockResolvedValue(undefined)
    nativeAdPlugin.show.mockReset()
    nativeAdPlugin.show.mockResolvedValue(undefined)
    process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID = 'ca-app-pub-test/native'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID
  })

  const flush = () => new Promise<void>((resolve) => { setTimeout(resolve, 0) })

  it('retries transient preload failures within the bound, then succeeds', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await showNativeAd(bounds)
    nativeAdPlugin.preload.mockClear()
    nativeAdPlugin.preload
      .mockRejectedValueOnce(Object.assign(new Error('flaky 1'), { code: 'ERROR_CODE_NETWORK_ERROR' }))
      .mockRejectedValueOnce(Object.assign(new Error('flaky 2'), { code: 'ERROR_CODE_NETWORK_ERROR' }))
      .mockResolvedValueOnce(undefined)

    await expect(preloadNativeAd({ retryDelaysMs: [0, 0] })).resolves.toBe(true)
    expect(nativeAdPlugin.preload).toHaveBeenCalledTimes(3)
    expect(getLastAdError()).toBeNull()
  })

  it('gives up after the bound and records the last error', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await showNativeAd(bounds)
    nativeAdPlugin.preload.mockClear()
    nativeAdPlugin.preload.mockRejectedValue(
      Object.assign(new Error('no fill'), { code: 'ERROR_CODE_NO_FILL' }),
    )

    await expect(preloadNativeAd({ retryDelaysMs: [0, 0] })).resolves.toBe(false)
    expect(nativeAdPlugin.preload).toHaveBeenCalledTimes(3)
    expect(getLastAdError()).toEqual({ code: 'ERROR_CODE_NO_FILL', message: 'no fill' })
  })

  it('a failed show triggers at most one background refill per cooldown', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    const realNow = Date.now()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 61 * 1000)
    try {
      nativeAdPlugin.preload.mockReset()
    nativeAdPlugin.preload.mockResolvedValue(undefined)
    nativeAdPlugin.show.mockReset()
    nativeAdPlugin.show.mockResolvedValue(undefined)
    await showNativeAd(bounds)
    await expect(preloadNativeAd()).resolves.toBe(true)
    nativeAdPlugin.show.mockRejectedValue(new Error('show failed'))

    await expect(preloadNativeAd()).resolves.toBe(true)
    const baseline = nativeAdPlugin.preload.mock.calls.length
    await expect(showNativeAd(bounds)).resolves.toBe(false)
    await flush()
    await flush()
    const afterFirstRefill = nativeAdPlugin.preload.mock.calls.length
    expect(afterFirstRefill).toBe(baseline + 1)
    // Second failure inside the cooldown must not manufacture another request.
    await expect(showNativeAd(bounds)).resolves.toBe(false)
    await flush()
    await flush()
    expect(nativeAdPlugin.preload.mock.calls.length).toBe(afterFirstRefill)
    } finally {
      nowSpy.mockRestore()
    }
  })
})
