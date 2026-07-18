import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorPicker } from '../ColorPicker'

describe('ColorPicker', () => {
  it('renders all 3 color options (White, Black, Random)', () => {
    render(<ColorPicker value="white" onChange={jest.fn()} />)
    expect(screen.getByRole('radio', { name: /white pieces/i })).toBeDefined()
    expect(screen.getByRole('radio', { name: /black pieces/i })).toBeDefined()
    expect(screen.getByRole('radio', { name: /random color/i })).toBeDefined()
  })

  it('marks the selected option as checked', () => {
    render(<ColorPicker value="black" onChange={jest.fn()} />)
    const black = screen.getByRole('radio', { name: /black pieces/i })
    expect(black.getAttribute('aria-checked')).toBe('true')

    const white = screen.getByRole('radio', { name: /white pieces/i })
    expect(white.getAttribute('aria-checked')).toBe('false')
  })

  it('calls onChange with the new color when a card is clicked', () => {
    const onChange = jest.fn()
    render(<ColorPicker value="white" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /random color/i }))
    expect(onChange).toHaveBeenCalledWith('random')
  })

  it('applies the blue-glow selected class only to the selected card', () => {
    render(<ColorPicker value="white" onChange={jest.fn()} />)
    const white = screen.getByRole('radio', { name: /white pieces/i })
    const black = screen.getByRole('radio', { name: /black pieces/i })
    expect(white.className).toContain('border-blue-500')
    expect(white.className).toContain('shadow-[var(--shadow-glow-blue-strong)]')
    expect(black.className).not.toContain('border-blue-500')
  })

  it('handles all three values without crashing', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ColorPicker value="white" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /black pieces/i }))
    expect(onChange).toHaveBeenLastCalledWith('black')

    rerender(<ColorPicker value="black" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /random color/i }))
    expect(onChange).toHaveBeenLastCalledWith('random')

    rerender(<ColorPicker value="random" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /white pieces/i }))
    expect(onChange).toHaveBeenLastCalledWith('white')
  })

  it('renders inside a radiogroup for screen readers', () => {
    render(<ColorPicker value="white" onChange={jest.fn()} />)
    expect(screen.getByRole('radiogroup', { name: /choose your color/i })).toBeDefined()
  })
})
