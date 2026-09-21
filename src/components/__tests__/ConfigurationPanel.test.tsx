import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfigurationPanel } from '../ConfigurationPanel'
import { DIFFICULTY_LEVELS } from '../difficultyLevels'

const noop = () => {}

function renderPanel(showPlayMyMove: boolean) {
  return render(
    React.createElement(ConfigurationPanel, {
      selectedLevel: 3,
      onSelectLevel: noop,
      selectedColor: 'white' as const,
      onSelectColor: noop,
      difficultyLevels: DIFFICULTY_LEVELS,
      showPlayMyMove,
    }),
  )
}

describe('ConfigurationPanel — Play My Move', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('does not render Play My Move outside Quick Play', () => {
    renderPanel(false)
    expect(screen.queryByText('Play My Move')).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Play My Move' })).toBeNull()
  })

  test('renders and toggles Play My Move for Quick Play (default OFF)', () => {
    renderPanel(true)
    const toggle = screen.getByRole('switch', { name: 'Play My Move' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.getByText('Your move is always played. The bot shows its best move as a hint.'),
    ).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })
})
