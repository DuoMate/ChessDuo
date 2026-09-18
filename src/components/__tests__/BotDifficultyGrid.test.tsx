import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BotDifficultyGrid } from '../BotDifficultyGrid'
import { DIFFICULTY_LEVELS } from '../difficultyLevels'

describe('DIFFICULTY_LEVELS (shared source of truth)', () => {
  it('exposes the same 5 home-UI levels: Easy/Medium/Hard/Expert/Master (1-5)', () => {
    expect(DIFFICULTY_LEVELS.map((d) => d.level)).toEqual([1, 2, 3, 4, 5])
    expect(DIFFICULTY_LEVELS.map((d) => d.label)).toEqual([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
      'Master',
    ])
    for (const d of DIFFICULTY_LEVELS) {
      expect(typeof d.description).toBe('string')
      expect(d.description.length).toBeGreaterThan(0)
    }
  })
})

describe('BotDifficultyGrid', () => {
  it('renders all 5 difficulty options', () => {
    render(<BotDifficultyGrid selectedLevel={3} onSelect={jest.fn()} />)
    expect(screen.getByRole('radio', { name: /easy difficulty/i })).toBeDefined()
    expect(screen.getByRole('radio', { name: /medium difficulty/i })).toBeDefined()
    expect(screen.getByRole('radio', { name: /hard difficulty/i })).toBeDefined()
    expect(screen.getByRole('radio', { name: /expert difficulty/i })).toBeDefined()
    expect(screen.getByRole('radio', { name: /master difficulty/i })).toBeDefined()
  })

  it('marks the selected option as checked', () => {
    render(<BotDifficultyGrid selectedLevel={2} onSelect={jest.fn()} />)
    expect(
      screen.getByRole('radio', { name: /medium difficulty/i }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen.getByRole('radio', { name: /hard difficulty/i }).getAttribute('aria-checked'),
    ).toBe('false')
  })

  it('calls onSelect with the new level when a card is clicked', () => {
    const onSelect = jest.fn()
    render(<BotDifficultyGrid selectedLevel={3} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('radio', { name: /master difficulty/i }))
    expect(onSelect).toHaveBeenCalledWith(5)
  })

  it('applies the brand-token selected class only to the selected card', () => {
    render(<BotDifficultyGrid selectedLevel={1} onSelect={jest.fn()} />)
    const easy = screen.getByRole('radio', { name: /easy difficulty/i })
    const hard = screen.getByRole('radio', { name: /hard difficulty/i })
    expect(easy.className).toContain('border-[var(--color-brand)]')
    expect(hard.className).not.toContain('border-[var(--color-brand)]')
  })

  it('renders inside a radiogroup for screen readers', () => {
    render(<BotDifficultyGrid selectedLevel={3} onSelect={jest.fn()} />)
    expect(screen.getByRole('radiogroup', { name: /bot difficulty/i })).toBeDefined()
  })
})
