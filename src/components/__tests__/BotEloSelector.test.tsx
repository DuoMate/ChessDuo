import { render, screen, fireEvent } from '@testing-library/react'
import { BotEloSelector } from '../BotEloSelector'

jest.mock('@/features/bots/botConfig', () => ({
  getAvailableSkillLevels: () => [
    { level: 1, description: 'Beginner ~1000 ELO', label: 'Beginner' },
    { level: 2, description: 'Novice ~1500 ELO', label: 'Novice' },
    { level: 3, description: 'Intermediate ~1800 ELO', label: 'Intermediate' },
    { level: 4, description: 'Advanced ~2000 ELO', label: 'Advanced' },
    { level: 5, description: 'Expert ~2200 ELO', label: 'Expert' },
    { level: 6, description: 'Master ~2600 ELO', label: 'Master' },
  ],
}))

describe('BotEloSelector', () => {
  it('renders all 6 skill levels', () => {
    render(<BotEloSelector selectedLevel={4} onSelect={jest.fn()} />)
    expect(screen.getByText('Beginner')).toBeDefined()
    expect(screen.getByText('Novice')).toBeDefined()
    expect(screen.getByText('Intermediate')).toBeDefined()
    expect(screen.getByText('Advanced')).toBeDefined()
    expect(screen.getByText('Expert')).toBeDefined()
    expect(screen.getByText('Master')).toBeDefined()
  })

  it('highlights selected level with yellow border', () => {
    const { container } = render(<BotEloSelector selectedLevel={6} onSelect={jest.fn()} />)
    const masterButton = screen.getByText('Master').closest('button')
    expect(masterButton?.className).toContain('border-yellow-500')
    const beginnerButton = screen.getByText('Beginner').closest('button')
    expect(beginnerButton?.className).not.toContain('border-yellow-500')
  })

  it('calls onSelect with the selected level when clicked', () => {
    const onSelect = jest.fn()
    render(<BotEloSelector selectedLevel={4} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Master'))
    expect(onSelect).toHaveBeenCalledWith(6)
  })

  it('does not call onSelect when clicking already-selected level', () => {
    const onSelect = jest.fn()
    render(<BotEloSelector selectedLevel={4} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Advanced'))
    expect(onSelect).toHaveBeenCalledWith(4)
  })
})
