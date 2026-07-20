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
})
