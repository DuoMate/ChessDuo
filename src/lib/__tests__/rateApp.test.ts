import { Capacitor } from '@capacitor/core'
import { openPlayListing, PLAY_LISTING_URL, PLAY_MARKET_URI, PLAY_APP_ID } from '../rateApp'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(() => false) },
  registerPlugin: jest.fn(),
}))

jest.mock('@capacitor/share', () => ({
  Share: { share: jest.fn() },
}))

jest.mock('@capacitor/browser', () => ({
  Browser: { open: jest.fn(() => Promise.resolve()) },
}))

const { Capacitor: MockCapacitor } = jest.requireMock('@capacitor/core') as {
  Capacitor: { isNativePlatform: jest.Mock }
}

describe('rateApp', () => {
  const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null)

  beforeEach(() => {
    jest.clearAllMocks()
    MockCapacitor.isNativePlatform.mockReturnValue(false)
  })

  afterAll(() => {
    openSpy.mockRestore()
  })

  it('points at the ChessDuo Play listing', () => {
    expect(PLAY_APP_ID).toBe('com.navron.chessduo')
    expect(PLAY_LISTING_URL).toBe(
      'https://play.google.com/store/apps/details?id=com.navron.chessduo',
    )
    expect(PLAY_MARKET_URI).toBe('market://details?id=com.navron.chessduo')
  })

  it('opens the HTTPS listing in a new tab on web', async () => {
    const result = await openPlayListing()
    expect(result).toBe('opened')
    expect(openSpy).toHaveBeenCalledWith(PLAY_LISTING_URL, '_blank', 'noopener')
  })

  it('tries the market:// deep link first on native', async () => {
    MockCapacitor.isNativePlatform.mockReturnValue(true)
    const result = await openPlayListing()
    expect(result).toBe('opened')
    expect(openSpy).toHaveBeenCalledWith(PLAY_MARKET_URI, '_system')
  })

  it('falls back to the Browser plugin when market:// throws on native', async () => {
    MockCapacitor.isNativePlatform.mockReturnValue(true)
    openSpy.mockImplementationOnce(() => {
      throw new Error('unhandled scheme')
    })
    const { Browser } = jest.requireMock('@capacitor/browser') as {
      Browser: { open: jest.Mock }
    }
    const result = await openPlayListing()
    expect(result).toBe('opened')
    expect(Browser.open).toHaveBeenCalledWith({ url: PLAY_LISTING_URL })
  })

  it('never throws when every opener fails', async () => {
    MockCapacitor.isNativePlatform.mockReturnValue(false)
    openSpy.mockImplementation(() => {
      throw new Error('blocked')
    })
    await expect(openPlayListing()).resolves.toBe('unavailable')
  })
})
