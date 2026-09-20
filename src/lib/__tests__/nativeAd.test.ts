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
    nativeAdPlugin.preload.mockRejectedValueOnce(
      Object.assign(new Error('No fill'), { code: 'ERROR_CODE_NO_FILL' }),
    )

    await expect(preloadNativeAd()).resolves.toBe(false)
    expect(getLastAdError()).toEqual({ code: 'ERROR_CODE_NO_FILL', message: 'No fill' })
  })

  it('clears the recorded error after a successful preload', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await showNativeAd(bounds)
    nativeAdPlugin.preload.mockRejectedValueOnce(new Error('transient'))

    await expect(preloadNativeAd()).resolves.toBe(false)
    expect(getLastAdError()).not.toBeNull()
    await expect(preloadNativeAd()).resolves.toBe(true)
    expect(getLastAdError()).toBeNull()
  })

  it('records the native error when show fails', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await showNativeAd(bounds)
    nativeAdPlugin.preload.mockResolvedValueOnce(undefined)
    nativeAdPlugin.show.mockRejectedValueOnce(
      Object.assign(new Error('show failed'), { code: 'ERROR_CODE_INTERNAL_ERROR' }),
    )

    await expect(preloadNativeAd()).resolves.toBe(true)
    await expect(showNativeAd(bounds)).resolves.toBe(false)
    expect(getLastAdError()).toEqual({ code: 'ERROR_CODE_INTERNAL_ERROR', message: 'show failed' })
  })
})
