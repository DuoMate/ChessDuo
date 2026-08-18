import React from 'react'
import { render, screen } from '@testing-library/react'
import { PendingMovesRow } from '../PendingMovesRow'

describe('PendingMovesRow', () => {
  it('shows "Waiting..." when no teammate move', () => {
    render(<PendingMovesRow yourMove={null} teammateMove={null} />)
    expect(screen.getByText('Waiting...')).toBeInTheDocument()
    expect(screen.getByText('Selecting...')).toBeInTheDocument()
  })

  it('shows submitted badge on BOTH cards when both moves present', () => {
    render(
      <PendingMovesRow
        yourMove={{ san: 'Nf3', piece: 'N', color: 'white' }}
        teammateMove={{ san: 'e4', piece: 'P', color: 'white' }}
      />
    )
    const submitted = screen.getAllByText('Submitted')
    expect(submitted.length).toBe(2)
    expect(screen.getByText('Nf3')).toBeInTheDocument()
    expect(screen.getByText('e4')).toBeInTheDocument()
  })

  it('renders long usernames without losing the Submitted badge (truncation is CSS, badge has its own space)', () => {
    const { container } = render(
      <PendingMovesRow
        yourMove={{ san: 'c3', piece: 'P', color: 'white' }}
        teammateMove={{ san: 'd4', piece: 'P', color: 'white' }}
        yourLabel="Your Move"
        teammateLabel="Teammate"
        teammateName="VeryLongPlayerName123456789"
      />
    )
    // The name is rendered (truncation via CSS, not dropped from the DOM).
    expect(screen.getByText('VeryLongPlayerName123456789')).toBeInTheDocument()
    expect(screen.getAllByText('Submitted').length).toBe(2)
    // Both moves stay readable.
    expect(screen.getByText('c3')).toBeInTheDocument()
    expect(screen.getByText('d4')).toBeInTheDocument()

    // Layout contract: two equal-width stretch cells; name/move rows truncate
    // inside min-w-0 flex containers; the badge is a shrink-0 flex item so it
    // can never be crushed or overlapped by long text.
    const cards = container.querySelectorAll('.grid-cols-2')
    expect(cards.length).toBe(1)
    expect(container.querySelectorAll('.min-w-0').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.shrink-0').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.truncate').length).toBeGreaterThan(0)
  })

  it('keeps the Submitted badge aligned as a single compact flex item (icon + text)', () => {
    const { container } = render(
      <PendingMovesRow
        yourMove={{ san: 'e4', piece: 'P', color: 'white' }}
        teammateMove={{ san: 'e5', piece: 'P', color: 'black' }}
      />
    )
    const badges = container.querySelectorAll('span[class*="shrink-0"]')
    // At least one badge is a shrink-0 whitespace-nowrap flex item.
    expect(badges.length).toBeGreaterThanOrEqual(2)
    badges.forEach((b) => {
      expect(b.className).toContain('whitespace-nowrap')
      expect(b.className).toContain('inline-flex')
    })
  })

  it('renders both cards with consistent layout in a stretch grid (equal height)', () => {
    const { container } = render(
      <PendingMovesRow
        yourMove={{ san: 'Nf3', piece: 'N', color: 'white' }}
        teammateMove={null}
        yourName="chessdoubles27"
        teammateName="ai_enddown"
      />
    )
    const grid = container.querySelector('.grid-cols-2')
    expect(grid?.className).toContain('items-stretch')
    // Both card cells present.
    expect(screen.getByText('Your Move')).toBeInTheDocument()
    expect(screen.getByText('Teammate')).toBeInTheDocument()
    expect(screen.getByText('chessdoubles27')).toBeInTheDocument()
    expect(screen.getByText('ai_enddown')).toBeInTheDocument()
  })
})
