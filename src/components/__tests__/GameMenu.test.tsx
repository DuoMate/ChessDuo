import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: (props: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) =>
      React.createElement('div', { className: props.className, style: props.style, 'data-motion': 'div' }, props.children),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

jest.mock('lucide-react', () => ({
  Menu: () => React.createElement('div', { 'data-testid': 'menu-icon' }),
  X: () => React.createElement('div', { 'data-testid': 'x-icon' }),
  Flag: () => React.createElement('div', { 'data-testid': 'flag-icon' }),
  Settings: () => React.createElement('div', { 'data-testid': 'settings-icon' }),
  Volume2: () => React.createElement('div', { 'data-testid': 'volume-icon' }),
  VolumeX: () => React.createElement('div', { 'data-testid': 'volume-off-icon' }),
  User: () => React.createElement('div', { 'data-testid': 'user-icon' }),
  ShieldCheck: () => React.createElement('div', { 'data-testid': 'shield-icon' }),
}))

import { GameMenu } from '../GameMenu'

describe('GameMenu', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the menu toggle button', () => {
    render(<GameMenu onOpenSettings={jest.fn()} />)
    expect(screen.getByLabelText('Menu')).toBeInTheDocument()
  })

  it('opens dropdown when menu button is clicked', () => {
    render(<GameMenu onOpenSettings={jest.fn()} />)
    fireEvent.click(screen.getByLabelText('Menu'))
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('calls onOpenSettings when Settings is clicked', () => {
    const onOpenSettings = jest.fn()
    render(<GameMenu onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByLabelText('Menu'))
    fireEvent.click(screen.getByText('Settings'))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('passes onToggleConfirmMove and shows toggle when provided', () => {
    const onToggleConfirmMove = jest.fn()
    render(
      <GameMenu
        onOpenSettings={jest.fn()}
        confirmMove={false}
        onToggleConfirmMove={onToggleConfirmMove}
      />
    )
    fireEvent.click(screen.getByLabelText('Menu'))
    expect(screen.getByText('Confirm Moves')).toBeInTheDocument()
    expect(screen.getByText('Add confirmation before final move')).toBeInTheDocument()
    expect(screen.getByTestId('shield-icon')).toBeInTheDocument()
  })

  it('calls onToggleConfirmMove when toggle switch is clicked', () => {
    const onToggleConfirmMove = jest.fn()
    render(
      <GameMenu
        onOpenSettings={jest.fn()}
        confirmMove={false}
        onToggleConfirmMove={onToggleConfirmMove}
      />
    )
    fireEvent.click(screen.getByLabelText('Menu'))
    // The role="switch" toggle should exist
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(onToggleConfirmMove).toHaveBeenCalledTimes(1)
  })

  it('renders toggle with aria-checked true when confirmMove is enabled', () => {
    render(
      <GameMenu
        onOpenSettings={jest.fn()}
        confirmMove={true}
        onToggleConfirmMove={jest.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText('Menu'))
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('closes dropdown after toggling confirm move', () => {
    render(
      <GameMenu
        onOpenSettings={jest.fn()}
        confirmMove={false}
        onToggleConfirmMove={jest.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText('Menu'))
    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)
    // Menu should close — the Confirm Moves text should no longer be visible
    expect(screen.queryByText('Confirm Moves')).not.toBeInTheDocument()
  })
})
