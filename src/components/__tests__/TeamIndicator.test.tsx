import React from 'react'
import { render, screen } from '@testing-library/react'
import { TeamIndicator } from '../../components/TeamIndicator'

describe('TeamIndicator Component', () => {
  test('renders White and Black team labels from props', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team (You)"
        blackLabel="Black Team (Bot)"
        activeTeam="WHITE"
        isGameOver={false}
        isBotThinking={false}
      />
    )
    expect(screen.getByText('White Team (You)')).toBeDefined()
    expect(screen.getByText('Black Team (Bot)')).toBeDefined()
  })

  test('renders VS divider', () => {
    render(
      <TeamIndicator
        whiteLabel="White"
        blackLabel="Black"
        activeTeam="WHITE"
        isGameOver={false}
        isBotThinking={false}
      />
    )
    expect(screen.getByText('VS')).toBeDefined()
  })

  test('White team has amber border when active', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team"
        blackLabel="Black Team"
        activeTeam="WHITE"
        isGameOver={false}
        isBotThinking={false}
      />
    )
    const whiteLabel = screen.getByText('White Team')
    const whitePanel = whiteLabel.closest('[class*="rounded-xl"]')
    expect(whitePanel?.className).toContain('border-amber-400/60')
    expect(whitePanel?.className).toContain('from-white/15')
  })

  test('Black team has gray border when active', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team"
        blackLabel="Black Team"
        activeTeam="BLACK"
        isGameOver={false}
        isBotThinking={false}
      />
    )
    const blackLabel = screen.getByText('Black Team')
    const blackPanel = blackLabel.closest('[class*="rounded-xl"]')
    expect(blackPanel?.className).toContain('border-gray-400/40')
    expect(blackPanel?.className).toContain('from-gray-700')
  })

  test('inactive team has muted background', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team"
        blackLabel="Black Team"
        activeTeam="WHITE"
        isGameOver={false}
        isBotThinking={false}
      />
    )
    const blackLabel = screen.getByText('Black Team')
    const blackPanel = blackLabel.closest('[class*="rounded-xl"]')
    expect(blackPanel?.className).toContain('bg-white/5')
    expect(blackPanel?.className).toContain('border-white/10')
  })

  test('no team is highlighted when game is over', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team"
        blackLabel="Black Team"
        activeTeam="WHITE"
        isGameOver={true}
        isBotThinking={false}
      />
    )
    expect(screen.getByText('Game Over')).toBeDefined()
    const whiteLabel = screen.getByText('White Team')
    const whitePanel = whiteLabel.closest('[class*="rounded-xl"]')
    expect(whitePanel?.className).not.toContain('border-amber-400')
  })

  test('shows "Your turn to move" when bot is thinking', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team"
        blackLabel="Black Team"
        activeTeam="WHITE"
        isGameOver={false}
        isBotThinking={true}
      />
    )
    expect(screen.getByText('Your turn to move')).toBeDefined()
  })

  test('shows turn indicator text during normal play', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team"
        blackLabel="Black Team"
        activeTeam="WHITE"
        isGameOver={false}
        isBotThinking={false}
      />
    )
    expect(screen.getByText('White to move')).toBeDefined()
  })

  test('shows Black to move when Black is active', () => {
    render(
      <TeamIndicator
        whiteLabel="White Team"
        blackLabel="Black Team"
        activeTeam="BLACK"
        isGameOver={false}
        isBotThinking={false}
      />
    )
    expect(screen.getByText('Black to move')).toBeDefined()
  })
})
