import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BoardMoveNav } from '../BoardMoveNav'

const noop = () => {}

describe('BoardMoveNav (BOARD FIRST compact history nav)', () => {
  test('renders the current / total counter', () => {
    render(React.createElement(BoardMoveNav, { current: 12, total: 38, onBack: noop, onForward: noop }))
    expect(screen.getByText('12 / 38')).toBeInTheDocument()
  })

  test('calls the existing back/forward handlers', () => {
    const onBack = jest.fn()
    const onForward = jest.fn()
    render(React.createElement(BoardMoveNav, { current: 5, total: 10, onBack, onForward }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous move' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next move' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onForward).toHaveBeenCalledTimes(1)
  })

  test('disables the controls at the first/last move', () => {
    const { rerender } = render(
      React.createElement(BoardMoveNav, { current: 1, total: 10, onBack: noop, onForward: noop }),
    )
    expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next move' })).not.toBeDisabled()

    rerender(React.createElement(BoardMoveNav, { current: 10, total: 10, onBack: noop, onForward: noop }))
    expect(screen.getByRole('button', { name: 'Next move' })).toBeDisabled()
  })

  test('renders nothing before any move exists', () => {
    const { container } = render(
      React.createElement(BoardMoveNav, { current: 1, total: 0, onBack: noop, onForward: noop }),
    )
    expect(container.firstChild).toBeNull()
  })
})
