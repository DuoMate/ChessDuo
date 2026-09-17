import React from 'react'
import { render } from '@testing-library/react'
import { BoardTopBar } from '@/components/BoardTopBar'
import { Team } from '@/features/game-engine/gameState'

jest.mock('framer-motion', () => {
  const ReactActual = jest.requireActual('react')
  return {
    motion: {
      div: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) =>
        ReactActual.createElement('div', props, children),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  }
})

function baseProps() {
  return {
    whitePlayers: [],
    blackPlayers: [],
    matchTimeRemaining: 600,
    matchTimerActive: false,
    totalMatchSeconds: 600,
    currentTurn: Team.WHITE,
  }
}

describe('BoardTopBar thinking hint (in-flow, below turn pill)', () => {
  it('renders no status hint by default', () => {
    const { container } = render(<BoardTopBar {...baseProps()} />)
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('renders themed in-flow hint when isThinking', () => {
    const { container } = render(<BoardTopBar {...baseProps()} isThinking />)
    const pill = container.querySelector('[role="status"]')
    expect(pill?.textContent).toContain('Opponent is thinking')
    // Themed via CSS vars + explicit dark: variants, text-xs (not 11px), truncates.
    expect(pill?.className).toContain('bg-[var(--color-surface)]')
    expect(pill?.className).toContain('dark:bg-[var(--color-muted-bg)]')
    expect(pill?.className).toContain('dark:text-slate-300')
    expect(pill?.className).toContain('text-xs')
    expect(pill?.className).not.toContain('absolute')
    expect(pill?.className).not.toContain('whitespace-nowrap')
  })

  it('reserves layout space so show/hide does not shift the board', () => {
    const { container } = render(<BoardTopBar {...baseProps()} />)
    const reserved = container.querySelector('.min-h-\\[28px\\]')
    expect(reserved).not.toBeNull()
  })
})
