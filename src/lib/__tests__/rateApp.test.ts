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

  it('opens the HTTPS listing via the Browser plugin on native', async () => {
    MockCapacitor.isNativePlatform.mockReturnValue(true)
    const { Browser } = jest.requireMock('@capacitor/browser') as {
      Browser: { open: jest.Mock }
    }
    const result = await openPlayListing()
    expect(result).toBe('opened')
    // Capacitor's WebView ignores window.open(url, '_system') popups (no
    // onCreateWindow), so native reliably uses Browser.open(HTTPS listing).
    expect(Browser.open).toHaveBeenCalledWith({ url: PLAY_LISTING_URL })
    expect(openSpy).not.toHaveBeenCalledWith(PLAY_MARKET_URI, '_system')
  })

  it('falls back to a new tab when the Browser plugin fails on native', async () => {
    MockCapacitor.isNativePlatform.mockReturnValue(true)
    const { Browser } = jest.requireMock('@capacitor/browser') as {
      Browser: { open: jest.Mock }
    }
    Browser.open.mockRejectedValueOnce(new Error('plugin unavailable'))
    const result = await openPlayListing()
    expect(result).toBe('opened')
    expect(openSpy).toHaveBeenCalledWith(PLAY_LISTING_URL, '_blank', 'noopener')
  })

  it('never throws when every opener fails', async () => {
    MockCapacitor.isNativePlatform.mockReturnValue(false)
    openSpy.mockImplementation(() => {
      throw new Error('blocked')
    })
    await expect(openPlayListing()).resolves.toBe('unavailable')
  })
})
