import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { LeaveConfirmModal } from '../LeaveConfirmModal'

describe('LeaveConfirmModal', () => {
  it('renders when open is true', () => {
    render(
      <LeaveConfirmModal
        open={true}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    )
    expect(screen.getByText('Abort Match')).toBeDefined()
    expect(screen.getByText('Are you sure?')).toBeDefined()
  })

  it('does not render when open is false', () => {
    render(
      <LeaveConfirmModal
        open={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    )
    expect(screen.queryByText('Abort Match')).toBeNull()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn()
    render(
      <LeaveConfirmModal open={true} onCancel={onCancel} onConfirm={jest.fn()} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onConfirm when OK is clicked', () => {
    const onConfirm = jest.fn()
    render(
      <LeaveConfirmModal open={true} onCancel={jest.fn()} onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByText('OK'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('shows warning message about teammate being notified', () => {
    render(
      <LeaveConfirmModal open={true} onCancel={jest.fn()} onConfirm={jest.fn()} />
    )
    expect(screen.getByText(/teammate will be notified/i)).toBeDefined()
  })

  it('has Cancel and OK buttons', () => {
    render(
      <LeaveConfirmModal open={true} onCancel={jest.fn()} onConfirm={jest.fn()} />
    )
    expect(screen.getByText('Cancel').closest('button')).toBeDefined()
    expect(screen.getByText('OK').closest('button')).toBeDefined()
  })
})
