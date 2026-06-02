import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { GameOnOverlay } from '../../components/GameOnOverlay'

jest.mock('framer-motion', () => ({
  motion: {
    div: (props: { children?: React.ReactNode }) => React.createElement('div', null, props.children),
    h1: (props: { children?: React.ReactNode }) => React.createElement('h1', null, props.children),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

jest.mock('lucide-react', () => ({
  Crown: () => React.createElement('div', { 'data-testid': 'crown-icon' }),
}))

describe('GameOnOverlay Component', () => {
  test('renders Game On text', () => {
    const onComplete = jest.fn()
    render(<GameOnOverlay onComplete={onComplete} />)
    expect(screen.getByText('Game On!')).toBeDefined()
  })

  test('renders Crown icon', () => {
    const onComplete = jest.fn()
    const { container } = render(<GameOnOverlay onComplete={onComplete} />)
    expect(container.querySelector('[data-testid="crown-icon"]')).toBeTruthy()
  })

  test('calls onComplete after timeout', () => {
    jest.useFakeTimers()
    const onComplete = jest.fn()
    render(<GameOnOverlay onComplete={onComplete} />)
    act(() => {
      jest.advanceTimersByTime(1600)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
