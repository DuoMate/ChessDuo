import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoachSetup } from '../CoachSetup'

describe('CoachSetup', () => {
  it('renders color and difficulty selectors with a Start CTA', () => {
    render(
      <CoachSetup
        initialLevel={3}
        initialColor="white"
        onStart={jest.fn()}
        onBack={jest.fn()}
      />,
    )
    expect(screen.getByRole('radiogroup', { name: /choose your color/i })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: /bot difficulty/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /start ai coach/i })).toBeDefined()
  })

  it('initializes from props (level + color checked)', () => {
    render(
      <CoachSetup
        initialLevel={2}
        initialColor="black"
        onStart={jest.fn()}
        onBack={jest.fn()}
      />,
    )
    expect(
      screen.getByRole('radio', { name: /medium difficulty/i }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen.getByRole('radio', { name: /black pieces/i }).getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('starts with defaults when nothing is changed', () => {
    const onStart = jest.fn()
    render(
      <CoachSetup
        initialLevel={3}
        initialColor="white"
        onStart={onStart}
        onBack={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /start ai coach/i }))
    expect(onStart).toHaveBeenCalledWith(3, 'white')
  })

  it('passes the selected level and color to onStart', () => {
    const onStart = jest.fn()
    render(
      <CoachSetup
        initialLevel={3}
        initialColor="white"
        onStart={onStart}
        onBack={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /master difficulty/i }))
    fireEvent.click(screen.getByRole('radio', { name: /black pieces/i }))
    fireEvent.click(screen.getByRole('button', { name: /start ai coach/i }))
    expect(onStart).toHaveBeenCalledWith(5, 'black')
  })

  it('passes random color through unresolved (game resolves it)', () => {
    const onStart = jest.fn()
    render(
      <CoachSetup
        initialLevel={1}
        initialColor="white"
        onStart={onStart}
        onBack={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /random color/i }))
    fireEvent.click(screen.getByRole('button', { name: /start ai coach/i }))
    expect(onStart).toHaveBeenCalledWith(1, 'random')
  })

  it('shows the selected difficulty description', () => {
    render(
      <CoachSetup
        initialLevel={1}
        initialColor="white"
        onStart={jest.fn()}
        onBack={jest.fn()}
      />,
    )
    expect(screen.getByText(/great for learning/i)).toBeDefined()
  })

  it('calls onBack when the back button is pressed', () => {
    const onBack = jest.fn()
    render(
      <CoachSetup initialLevel={3} initialColor="white" onStart={jest.fn()} onBack={onBack} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
