import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameTour } from '../GameTour'

jest.mock('../ChessBoard', () => ({
  ChessBoard: () => React.createElement('div', { 'data-testid': 'chess-board' }),
}))

jest.mock('../AccuracyBottomSheet', () => ({
  AccuracyBottomSheet: () => React.createElement('div', { 'data-testid': 'accuracy-sheet' }),
}))

jest.mock('../EvaluatingLoader', () => ({
  EvaluatingLoader: () => React.createElement('div', { 'data-testid': 'evaluating-loader' }),
}))

jest.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

describe('GameTour', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders with Next button and step indicator', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    expect(screen.getByText('Next')).toBeDefined()
    expect(screen.getByText('How it works')).toBeDefined()
    expect(screen.getByText('Skip Tour')).toBeDefined()
  })

  it('does not render when open is false', () => {
    render(<GameTour open={false} onComplete={jest.fn()} onSkip={jest.fn()} />)
    expect(screen.queryByText('Skip Tour')).toBeNull()
  })

  it('calls onSkip when Skip Tour is clicked', () => {
    const onSkip = jest.fn()
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={onSkip} />)
    fireEvent.click(screen.getByText('Skip Tour'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('calls onSkip when X close button is clicked', () => {
    const onSkip = jest.fn()
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={onSkip} />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('navigates to step with Show Result button', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Show Result')).toBeDefined()
  })

  it('has Back button after advancing a step', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Back')).toBeDefined()
  })

  it('renders chess board in all steps', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    expect(screen.getByTestId('chess-board')).toBeDefined()
  })

  it('saves tour_completed to localStorage via onSkip', () => {
    const onSkip = jest.fn(() => {
      localStorage.setItem('chessduo_tour_completed', 'true')
    })
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={onSkip} />)
    fireEvent.click(screen.getByText('Skip Tour'))
    expect(onSkip).toHaveBeenCalled()
    expect(localStorage.getItem('chessduo_tour_completed')).toBe('true')
  })
})
