import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: (props: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) =>
      React.createElement('div', { className: props.className, style: props.style, 'data-motion': 'div' }, props.children),
    button: (props: { children?: React.ReactNode; className?: string; onClick?: () => void; disabled?: boolean; whileTap?: unknown }) =>
      React.createElement('button', { className: props.className, onClick: props.onClick, disabled: props.disabled }, props.children),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

jest.mock('lucide-react', () => ({
  X: () => React.createElement('div', { 'data-testid': 'x-icon' }),
  Check: () => React.createElement('div', { 'data-testid': 'check-icon' }),
}))

import { ConfirmMoveBar } from '../ConfirmMoveBar'

describe('ConfirmMoveBar', () => {
  it('returns null when not visible', () => {
    const { container } = render(
      <ConfirmMoveBar visible={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders Cancel and Confirm buttons when visible', () => {
    render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={jest.fn()} />
    )
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm Move')).toBeInTheDocument()
  })

  it('renders the X icon and Check icon', () => {
    render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={jest.fn()} />
    )
    expect(screen.getByTestId('x-icon')).toBeInTheDocument()
    expect(screen.getByTestId('check-icon')).toBeInTheDocument()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = jest.fn()
    render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={onCancel} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when Confirm button is clicked', () => {
    const onConfirm = jest.fn()
    render(
      <ConfirmMoveBar visible={true} onConfirm={onConfirm} onCancel={jest.fn()} />
    )
    fireEvent.click(screen.getByText('Confirm Move'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables Confirm button when disabled prop is true', () => {
    render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={jest.fn()} disabled={true} />
    )
    const confirmBtn = screen.getByRole('button', { name: 'Confirm move' })
    expect(confirmBtn).toBeDisabled()
  })

  it('does not disable Cancel button when disabled', () => {
    render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={jest.fn()} disabled={true} />
    )
    const cancelBtn = screen.getByRole('button', { name: 'Cancel move' })
    expect(cancelBtn).not.toBeDisabled()
  })

  it('has fixed positioning classes', () => {
    const { container } = render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={jest.fn()} />
    )
    const outerDiv = container.firstElementChild
    expect(outerDiv?.className).toContain('fixed')
    expect(outerDiv?.className).toContain('z-40')
    expect(outerDiv?.className).toContain('bottom-20')
  })

  it('uses 50/50 split layout for Cancel and Confirm', () => {
    render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={jest.fn()} />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].className).toContain('flex-1')
    expect(buttons[1].className).toContain('flex-1')
  })

  it('shows "Confirm Move" label when disabled is false', () => {
    render(
      <ConfirmMoveBar visible={true} onConfirm={jest.fn()} onCancel={jest.fn()} disabled={false} />
    )
    expect(screen.getByText('Confirm Move')).toBeInTheDocument()
  })

  it('toggles aria-hidden on outer container based on visibility', () => {
    const { container, rerender } = render(
      <ConfirmMoveBar visible={false} onConfirm={jest.fn()} onCancel={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })
})
