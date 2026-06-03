import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeDisclaimer } from '../WelcomeDisclaimer'

describe('WelcomeDisclaimer tour button', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders Take a Tour button when onTour is provided', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} onTour={jest.fn()} />)
    expect(screen.getByText('Take a Tour')).toBeDefined()
  })

  it('does not render Take a Tour button when onTour is not provided', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} />)
    expect(screen.queryByText('Take a Tour')).toBeNull()
  })

  it('calls onTour when Take a Tour is clicked', () => {
    const onTour = jest.fn()
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} onTour={onTour} />)
    fireEvent.click(screen.getByText('Take a Tour'))
    expect(onTour).toHaveBeenCalled()
  })

  it('still shows Got it button alongside tour button', () => {
    render(<WelcomeDisclaimer open={true} onDismiss={jest.fn()} onTour={jest.fn()} />)
    expect(screen.getByText('Got it!')).toBeDefined()
    expect(screen.getByText('Take a Tour')).toBeDefined()
  })
})
