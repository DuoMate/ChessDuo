import { Capacitor, registerPlugin } from '@capacitor/core'
import { getLastAdError, hideNativeAd, preloadNativeAd, showNativeAd } from '../nativeAd'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn() },
  registerPlugin: jest.fn(() => ({
    preload: jest.fn().mockResolvedValue(undefined),
    show: jest.fn().mockResolvedValue(undefined),
    hide: jest.fn().mockResolvedValue(undefined),
    discardLoadedAd: jest.fn().mockResolvedValue(undefined),
  })),
}))

// Settles background preload/refill promises (all test delays are 0ms) so
// single-flight state never leaks across tests. Call after discard.
const flushAdQueue = () => new Promise<void>((resolve) => { setTimeout(resolve, 0) })

async function settleAdState(): Promise<void> {
  const { discardPreloadedAd } = await import('../nativeAd')
  await discardPreloadedAd()
  await flushAdQueue()
  await flushAdQueue()
}

/**
 * Deterministic slate for tests that count native requests. Background
 * preloads/refills (show-success next-ad, show-failure refill) complete in
 * microtasks and set the JS cache — so: settle orphans, reset
 * implementations, succeed a show (clears cache), settle ITS refill,
 * discard the refill's cache, then wipe call counts. Afterwards the next
 * preload/show under test hits native exactly as configured.
 */
async function cleanSlate(): Promise<void> {
  nativeAdPlugin.preload.mockReset()
  nativeAdPlugin.preload.mockResolvedValue(undefined)
  nativeAdPlugin.show.mockReset()
  nativeAdPlugin.show.mockResolvedValue(undefined)
  await flushAdQueue()
  await flushAdQueue()
  await showNativeAd({ x: 0, y: 0, width: 300, height: 180 })
  await flushAdQueue()
  await flushAdQueue()
  const { discardPreloadedAd } = await import('../nativeAd')
  await discardPreloadedAd()
  // Wipe all call counts (calls only — implementations set afterwards by
  // each test survive) so assertions start from a clean slate.
  jest.clearAllMocks()
}

const nativeAdPlugin = (registerPlugin as jest.Mock).mock.results[0].value as {
  preload: jest.Mock
  show: jest.Mock
  hide: jest.Mock
}

describe('nativeAd', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID = 'ca-app-pub-test/native'
    // Settle any background preload/refill from the previous test so
    // single-flight state and the JS cache never leak across tests.
    await settleAdState()
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
    await cleanSlate()
    nativeAdPlugin.preload.mockRejectedValue(
      Object.assign(new Error('No fill'), { code: 'ERROR_CODE_NO_FILL' }),
    )

    await expect(preloadNativeAd({ retryDelaysMs: [0, 0] })).resolves.toBe(false)
    expect(nativeAdPlugin.preload.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(getLastAdError()).toEqual({ code: 'ERROR_CODE_NO_FILL', message: 'No fill' })
  })

  it('clears the recorded error after a successful preload', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await cleanSlate()
    nativeAdPlugin.preload.mockRejectedValue(new Error('transient'))

    await expect(preloadNativeAd({ retryDelaysMs: [0, 0] })).resolves.toBe(false)
    expect(getLastAdError()).not.toBeNull()
    nativeAdPlugin.preload.mockReset()
    nativeAdPlugin.preload.mockResolvedValue(undefined)
    await expect(preloadNativeAd()).resolves.toBe(true)
    expect(getLastAdError()).toBeNull()
  })

  it('records the background refill error when show fails on an unloadable ad', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await cleanSlate()
    // Loader stays broken: the show failure's background refill records the
    // same no-fill shape diagnostics show for genuine load failures.
    nativeAdPlugin.preload.mockRejectedValue(
      Object.assign(new Error('No fill'), { code: 'ERROR_CODE_NO_FILL' }),
    )
    nativeAdPlugin.show.mockRejectedValue(
      Object.assign(new Error('show failed'), { code: 'ERROR_CODE_INTERNAL_ERROR' }),
    )

    await expect(showNativeAd(bounds)).resolves.toBe(false)
    await flushAdQueue()
    await flushAdQueue()
    expect(getLastAdError()).toEqual({ code: 'ERROR_CODE_NO_FILL', message: 'No fill' })
  })
})

describe('nativeAd retry + refill (ADS-02)', () => {
  const bounds = { x: 0, y: 0, width: 300, height: 180 }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID = 'ca-app-pub-test/native'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID
  })

  it('retries transient preload failures within the bound, then succeeds', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await cleanSlate()
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
    await cleanSlate()
    nativeAdPlugin.preload.mockRejectedValue(
      Object.assign(new Error('no fill'), { code: 'ERROR_CODE_NO_FILL' }),
    )

    await expect(preloadNativeAd({ retryDelaysMs: [0, 0] })).resolves.toBe(false)
    expect(nativeAdPlugin.preload).toHaveBeenCalledTimes(3)
    expect(getLastAdError()).toEqual({ code: 'ERROR_CODE_NO_FILL', message: 'no fill' })
  })

  it('a failed show triggers at most one background refill per cooldown', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    // Escape earlier suites' refill cooldown by advancing the clock.
    const realNow = Date.now()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 61 * 1000)
    try {
      await cleanSlate()
      await expect(preloadNativeAd()).resolves.toBe(true)
      nativeAdPlugin.show.mockRejectedValue(new Error('show failed'))

      const baseline = nativeAdPlugin.preload.mock.calls.length
      await expect(showNativeAd(bounds)).resolves.toBe(false)
      await flushAdQueue()
      await flushAdQueue()
      const afterFirstRefill = nativeAdPlugin.preload.mock.calls.length
      expect(afterFirstRefill).toBe(baseline + 1)
      // Second failure inside the cooldown must not manufacture another request.
      await expect(showNativeAd(bounds)).resolves.toBe(false)
      await flushAdQueue()
      await flushAdQueue()
      expect(nativeAdPlugin.preload.mock.calls.length).toBe(afterFirstRefill)
    } finally {
      nowSpy.mockRestore()
    }
  })
})

describe('nativeAd consume + discard (ADS-03)', () => {
  const bounds = { x: 0, y: 0, width: 300, height: 180 }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID = 'ca-app-pub-test/native'
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADMOB_NATIVE_ID
  })

  it('preloads the next ad after a successful show (consume → refill)', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await cleanSlate()
    await expect(preloadNativeAd()).resolves.toBe(true)
    expect(nativeAdPlugin.preload).toHaveBeenCalledTimes(1)
    await expect(showNativeAd(bounds)).resolves.toBe(true)
    await flushAdQueue()
    await flushAdQueue()
    // Exactly one proactive next-ad request — MAX_READY stays 1.
    expect(nativeAdPlugin.preload).toHaveBeenCalledTimes(2)
  })

  it('discard clears the JS cache and notifies native', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    await cleanSlate()
    const { discardPreloadedAd } = await import('../nativeAd')
    const plugin = nativeAdPlugin as unknown as {
      preload: jest.Mock
      discardLoadedAd: jest.Mock
    }
    await expect(preloadNativeAd()).resolves.toBe(true)
    await discardPreloadedAd()
    expect(plugin.discardLoadedAd).toHaveBeenCalledTimes(1)
    // Cache cleared: the next preload fetches fresh instead of reusing.
    await expect(preloadNativeAd()).resolves.toBe(true)
    expect(plugin.preload).toHaveBeenCalledTimes(2)
  })
})
