import React from 'react'
import { render } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { usePremium } from '@/hooks/usePremium'
import { AdSenseLoader } from '../AdSenseLoader'

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn() },
}))

jest.mock('@/hooks/usePremium', () => ({
  usePremium: jest.fn(),
}))

jest.mock('next/script', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src }: { src: string }) => <script data-testid="adsense-script" src={src} />,
}))

describe('AdSenseLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test/web'
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false)
    ;(usePremium as jest.Mock).mockReturnValue({ isPremium: false, loading: false })
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
  })

  it('loads the AdSense script for non-premium web users', () => {
    const { getByTestId } = render(<AdSenseLoader />)
    expect(getByTestId('adsense-script').getAttribute('src')).toContain(
      'pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-test/web'
    )
  })

  it('loads nothing for premium users', () => {
    ;(usePremium as jest.Mock).mockReturnValue({ isPremium: true, loading: false })
    const { container } = render(<AdSenseLoader />)
    expect(container).toBeEmptyDOMElement()
  })

  it('loads nothing on native platforms', () => {
    ;(Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true)
    const { container } = render(<AdSenseLoader />)
    expect(container).toBeEmptyDOMElement()
  })

  it('loads nothing when the client ID is missing', () => {
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
    const { container } = render(<AdSenseLoader />)
    expect(container).toBeEmptyDOMElement()
  })
})
