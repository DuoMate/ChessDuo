import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RateChessDuoRow } from '@/components/RateChessDuoRow'
import { openPlayListing } from '@/lib/rateApp'

jest.mock('@/lib/rateApp', () => ({
  PLAY_APP_ID: 'com.navron.chessduo',
  PLAY_LISTING_URL: 'https://play.google.com/store/apps/details?id=com.navron.chessduo',
  PLAY_MARKET_URI: 'market://details?id=com.navron.chessduo',
  openPlayListing: jest.fn().mockResolvedValue('opened'),
}))

describe('RateChessDuoRow (shared profile row)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  it('renders Rate ChessDuo with rating subtitle', () => {
    render(<RateChessDuoRow />)
    expect(screen.getByRole('button', { name: /Rate ChessDuo/ })).toBeDefined()
    expect(screen.getByText('Enjoying the game? Leave us a rating')).toBeDefined()
  })

  it('calls openPlayListing and shows transient feedback on tap', async () => {
    render(<RateChessDuoRow />)
    await userEvent.click(screen.getByRole('button', { name: /Rate ChessDuo/ }))
    expect(openPlayListing as jest.Mock).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Opening Play Store…')).toBeDefined()
  })

  it('meets touch-target + truncation hardening (no overflow on 320px)', () => {
    const { container } = render(<RateChessDuoRow />)
    const button = container.querySelector('button') as HTMLElement
    expect(button.className).toContain('min-h-[44px]')
    expect(container.querySelector('.min-w-0')).not.toBeNull()
    expect(container.querySelector('.truncate')).not.toBeNull()
    expect(container.querySelector('.shrink-0')).not.toBeNull()
  })
})
