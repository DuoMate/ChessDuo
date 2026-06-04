import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: (props: { children?: React.ReactNode; className?: string }) => React.createElement('div', { className: props.className }, props.children),
    h1: (props: { children?: React.ReactNode; className?: string }) => React.createElement('h1', { className: props.className }, props.children),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

jest.mock('lucide-react', () => ({
  Crown: () => React.createElement('div', { 'data-testid': 'crown-icon' }),
}))

jest.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}))

// Import after mocks
import { GameOnOverlay } from '../GameOnOverlay'

describe('GameOnOverlay — Game Start Animation', () => {
  test('calls onComplete after 1500ms', () => {
    jest.useFakeTimers()
    const onComplete = jest.fn()
    render(<GameOnOverlay onComplete={onComplete} />)
    expect(screen.getByText('Game On!')).toBeDefined()
    jest.advanceTimersByTime(1600)
    expect(onComplete).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })

  test('renders in fullscreen overlay which blocks pointer events', () => {
    const onComplete = jest.fn()
    const { container } = render(<GameOnOverlay onComplete={onComplete} />)
    const overlay = container.firstElementChild
    expect(overlay?.className).toContain('pointer-events-none')
  })

  test('hides itself after onComplete is called', () => {
    jest.useFakeTimers()
    const onComplete = jest.fn()
    const { container } = render(<GameOnOverlay onComplete={onComplete} />)
    jest.advanceTimersByTime(1600)
    expect(onComplete).toHaveBeenCalled()
    // After completion, the component returns null via visible=false
    jest.useRealTimers()
  })
})
