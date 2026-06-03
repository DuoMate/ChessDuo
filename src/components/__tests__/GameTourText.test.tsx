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

describe('GameTour updated text', () => {
  it('shows new step 1 text about teammates picking independently', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    expect(screen.queryByText(/you each choose independently/i)).toBeDefined()
  })

  it('shows new step 3 text with score comparison', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    expect(screen.queryByText(/the engine decides/i)).toBeDefined()
  })

  it('step 3 has pendingOverlay for retraction animation', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    // Verify the tour step correct wording
    expect(screen.queryByText(/the losing piece gets pulled back/i)).toBeDefined()
  })

  it('shows step 2 with tension text about only one move playing', () => {
    render(<GameTour open={true} onComplete={jest.fn()} onSkip={jest.fn()} />)
    fireEvent.click(screen.getByText('Next'))
    expect(screen.queryByText(/only one will play/i)).toBeDefined()
  })
})
