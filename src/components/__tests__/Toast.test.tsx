import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast, useGameToast } from '../Toast'

describe('ToastProvider', () => {
  it('renders children and tracks toast count via context', () => {
    let capturedToasts: unknown[] = []
    function TestConsumer() {
      const { toasts, addToast } = useToast()
      React.useEffect(() => { capturedToasts = toasts })
      return (
        <div>
          <span data-testid="toast-count">{toasts.length}</span>
          <button data-testid="add-info" onClick={() => addToast('info', 'Test info')}>Add</button>
        </div>
      )
    }

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )
    expect(screen.getByTestId('toast-count')).toHaveTextContent('0')

    act(() => { screen.getByTestId('add-info').click() })
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1')
    expect(capturedToasts.length).toBe(1)
    expect(capturedToasts[0]).toMatchObject({ type: 'info', message: 'Test info' })
  })

  it('handles multiple rapid toast additions gracefully', () => {
    function TestConsumer() {
      const { toasts, addToast } = useToast()
      return (
        <div>
          <span data-testid="toast-count">{toasts.length}</span>
          <button data-testid="add-many" onClick={() => {
            for (let i = 0; i < 20; i++) addToast('warning', `Warning ${i}`)
          }}>Add Many</button>
        </div>
      )
    }

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => { screen.getByTestId('add-many').click() })
    expect(screen.getByTestId('toast-count')).toHaveTextContent('20')
  })
})

describe('useGameToast', () => {
  it('returns stable reference across renders', () => {
    const refs: object[] = []
    function TestGameToast() {
      const toast = useGameToast()
      const [, forceRender] = React.useState(0)
      React.useEffect(() => {
        refs.push(toast)
        if (refs.length < 5) {
          forceRender(n => n + 1)
        }
      })
      return <div data-testid="done">done</div>
    }

    render(
      <ToastProvider>
        <TestGameToast />
      </ToastProvider>
    )

    expect(screen.getByTestId('done')).toBeDefined()
    expect(refs.length).toBe(5)
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i]).toBe(refs[0])
    }
  })

  it('adds gameOver toast with correct message', () => {
    let lastMessage = ''
    function TestGameToast() {
      const toast = useGameToast()
      const { toasts } = useToast()
      React.useEffect(() => {
        if (toasts.length > 0) {
          lastMessage = toasts[toasts.length - 1].message
        }
      })
      return (
        <div>
          <span data-testid="toast-count">{toasts.length}</span>
          <button data-testid="trigger" onClick={() => toast.gameOver('White wins')}>
            Trigger
          </button>
        </div>
      )
    }

    render(
      <ToastProvider>
        <TestGameToast />
      </ToastProvider>
    )

    act(() => { screen.getByTestId('trigger').click() })
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1')
    expect(lastMessage).toBe('Game Over: White wins')
  })

  it('adds warning toast with correct message for abandon', () => {
    let lastMessage = ''
    let lastType = ''
    function TestGameToast() {
      const toast = useGameToast()
      const { toasts } = useToast()
      React.useEffect(() => {
        if (toasts.length > 0) {
          const last = toasts[toasts.length - 1]
          lastMessage = last.message
          lastType = last.type
        }
      })
      return (
        <div>
          <span data-testid="toast-count">{toasts.length}</span>
          <button data-testid="trigger" onClick={() => toast.warning('Match abandoned by teammate')}>
            Trigger
          </button>
        </div>
      )
    }

    render(
      <ToastProvider>
        <TestGameToast />
      </ToastProvider>
    )

    act(() => { screen.getByTestId('trigger').click() })
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1')
    expect(lastMessage).toBe('Match abandoned by teammate')
    expect(lastType).toBe('warning')
  })
})
