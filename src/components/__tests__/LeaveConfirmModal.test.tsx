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

  it('calls onConfirm when Leave is clicked', () => {
    const onConfirm = jest.fn()
    render(
      <LeaveConfirmModal open={true} onCancel={jest.fn()} onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByText('Leave'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('shows detail text when provided', () => {
    render(
      <LeaveConfirmModal open={true} onCancel={jest.fn()} onConfirm={jest.fn()} detail="Your teammate will be notified and the match will end." />
    )
    expect(screen.getByText(/teammate will be notified/i)).toBeDefined()
  })

  it('has Cancel and Leave buttons', () => {
    render(
      <LeaveConfirmModal open={true} onCancel={jest.fn()} onConfirm={jest.fn()} />
    )
    expect(screen.getByText('Cancel').closest('button')).toBeDefined()
    expect(screen.getByText('Leave').closest('button')).toBeDefined()
  })
})
