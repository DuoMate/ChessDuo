import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { shareLink, getRoomInviteLink, isNativePlatform } from '../share'

jest.mock('@capacitor/share', () => ({
  Share: { share: jest.fn() },
}))

const mockShare = Share.share as jest.Mock

describe('share helpers', () => {
  afterEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  describe('isNativePlatform', () => {
    it('returns true when running inside Capacitor', () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      expect(isNativePlatform()).toBe(true)
    })

    it('returns false on the web', () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      expect(isNativePlatform()).toBe(false)
    })
  })

  describe('getRoomInviteLink', () => {
    it('uses a clickable https App Link on native', () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      const origin = window.location.origin
      expect(getRoomInviteLink('HZW8M9')).toBe(`${origin}/?code=HZW8M9`)
    })

    it('uses the https URL on web', () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      const origin = window.location.origin
      expect(getRoomInviteLink('HZW8M9')).toBe(`${origin}/?code=HZW8M9`)
    })
  })

  describe('shareLink', () => {
    const opts = {
      title: 'Join my game',
      text: 'Room code: HZW8M9',
      url: 'https://chessduo.example/?code=HZW8M9',
    }

    it('opens the native share sheet with the clickable https URL', async () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      mockShare.mockResolvedValue({ value: true })

      const result = await shareLink(opts)

      expect(result).toBe('shared')
      expect(mockShare).toHaveBeenCalledWith({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        dialogTitle: undefined,
      })
    })

    it('falls back to the Web Share API when the native sheet is unavailable', async () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      mockShare.mockRejectedValue(new Error('not implemented'))
      const shareMock = jest.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true })

      const result = await shareLink(opts)

      expect(result).toBe('shared')
      expect(shareMock).toHaveBeenCalledWith(opts)
    })

    it('copies the clickable https URL when the native sheet and Web Share API are both unavailable', async () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
      mockShare.mockRejectedValue(new Error('not implemented'))

      const result = await shareLink(opts)

      expect(result).toBe('copied')
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(opts.url)
    })

    it('uses the Web Share API on the web when available', async () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)
      const shareMock = jest.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true })

      const result = await shareLink(opts)

      expect(result).toBe('shared')
      expect(shareMock).toHaveBeenCalledWith(opts)
    })

    it('copies to clipboard on the web when navigator.share is unavailable', async () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)

      const result = await shareLink(opts)

      expect(result).toBe('copied')
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(opts.url)
    })
  })
})
