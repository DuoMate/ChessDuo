import { Capacitor } from '@capacitor/core'
import { canUseWebAds, getAdSenseClientId, getAdSenseSlotId, pushWebAd } from '../webAds'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn() },
}))

describe('webAds', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test/web'
    process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID = '1234567890'
    delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
    delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID
  })

  it('reads the AdSense client and slot IDs', () => {
    expect(getAdSenseClientId()).toBe('ca-pub-test/web')
    expect(getAdSenseSlotId()).toBe('1234567890')
  })

  it('is usable on web with both IDs configured', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)
    expect(canUseWebAds()).toBe(true)
  })

  it('is a no-op on native platforms (AdMob owns that surface)', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    expect(canUseWebAds()).toBe(false)
    expect(pushWebAd()).toBe(false)
  })

  it('is a no-op when IDs are missing', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)
    delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID
    expect(canUseWebAds()).toBe(false)
    expect(pushWebAd()).toBe(false)
  })

  it('pushes once per call and never throws (ad blockers included)', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)
    expect(pushWebAd()).toBe(true)
    expect(window.adsbygoogle).toHaveLength(1)
  })
})
