import React from 'react'
import { render } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { usePremium } from '@/hooks/usePremium'
import { AdSenseSlot } from '../AdSenseSlot'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn() },
}))

jest.mock('@/hooks/usePremium', () => ({
  usePremium: jest.fn(),
}))

const mockPremium = (isPremium: boolean, loading = false) => {
  ;(usePremium as jest.Mock).mockReturnValue({ isPremium, loading })
}

describe('AdSenseSlot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test/web'
    process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID = '1234567890'
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)
    mockPremium(false)
    delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
    delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID
  })

  it('renders the responsive display unit and pushes once when open on web', () => {
    const { container } = render(<AdSenseSlot open={true} gameOverReason="checkmate" />)
    const ins = container.querySelector('ins.adsbygoogle')
    expect(ins).not.toBeNull()
    expect(ins?.getAttribute('data-ad-client')).toBe('ca-pub-test/web')
    expect(ins?.getAttribute('data-ad-slot')).toBe('1234567890')
    expect(ins?.getAttribute('data-ad-format')).toBe('auto')
    expect(window.adsbygoogle).toHaveLength(1)
  })

  it('renders nothing when closed', () => {
    const { container } = render(<AdSenseSlot open={false} />)
    expect(container).toBeEmptyDOMElement()
    expect(window.adsbygoogle).toBeUndefined()
  })

  it('renders nothing for premium users (ad-free entitlement)', () => {
    mockPremium(true)
    const { container } = render(<AdSenseSlot open={true} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on native platforms (AdMob owns that surface)', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    const { container } = render(<AdSenseSlot open={true} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when IDs are missing', () => {
    delete process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID
    const { container } = render(<AdSenseSlot open={true} />)
    expect(container).toBeEmptyDOMElement()
  })
})
