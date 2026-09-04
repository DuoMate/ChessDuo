import { Capacitor, registerPlugin } from '@capacitor/core'
import { hideNativeAd, preloadNativeAd, showNativeAd } from '../nativeAd'

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

  it('does nothing on web', async () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)

    await preloadNativeAd()
    await showNativeAd({ x: 0, y: 0, width: 300, height: 180 })
    await hideNativeAd()

    expect(nativeAdPlugin.preload).not.toHaveBeenCalled()
    expect(nativeAdPlugin.show).not.toHaveBeenCalled()
    expect(nativeAdPlugin.hide).not.toHaveBeenCalled()
  })
})