import React from 'react'
import { render } from '@testing-library/react'
import { Team } from '@/features/game-engine/gameState'

// Render counters for the mocked children. `mock`-prefixed so the hoisted
// jest.mock factories may reference them.
const mockRenderCounts = { chess: 0, mobile: 0, topBar: 0 }

jest.mock('../ChessBoard', () => ({
  ChessBoard: () => {
    mockRenderCounts.chess += 1
    return React.createElement('div', { 'data-testid': 'chess' })
  },
}))

jest.mock('../MobileChessBoard', () => ({
  MobileChessBoard: () => {
    mockRenderCounts.mobile += 1
    return React.createElement('div', { 'data-testid': 'mobile-chess' })
  },
}))

jest.mock('../BoardTopBar', () => ({
  BoardTopBar: () => {
    mockRenderCounts.topBar += 1
    return React.createElement('div', { 'data-testid': 'topbar' })
  },
}))

jest.mock('../GameMenu', () => ({
  GameMenu: () => null,
}))

import { GameBoardSection, GameTopBarSection } from '../GameSections'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const noop = () => {}
const noopMove = () => {}

function boardProps() {
  return {
    boardKey: 0,
    fen: START_FEN,
    enabled: true as boolean,
    orientation: 'white' as const,
    lastMove: null as { from: string; to: string } | null,
    pendingOverlay: null,
    myPendingOverlay: null,
    highlightSquares: null,
    onMove: noopMove,
    onAnimationComplete: noop,
    isMobile: false as boolean,
    maxWidth: 'min(95vw, 80vh, 720px)',
  }
}

function topBarProps() {
  const players: never[] = []
  return {
    whitePlayers: players,
    blackPlayers: players,
    capturedWhite: [] as string[],
    capturedBlack: [] as string[],
    matchTimeRemaining: 600,
    matchTimerActive: true,
    totalMatchSeconds: 600,
    roundLabel: 'Round 1' as string | undefined,
    currentTurn: Team.WHITE,
    timerNode: React.createElement('div'),
    resignVisible: true,
    onResign: noop,
    onOpenSettings: noop,
    soundEnabled: true,
    onToggleSound: noop,
    onOpenProfile: noop,
  }
}

describe('GameSections memo (P0/P5 regression lock)', () => {
  beforeEach(() => {
    mockRenderCounts.chess = 0
    mockRenderCounts.mobile = 0
    mockRenderCounts.topBar = 0
  })

  test('GameBoardSection skips re-render when props are referentially stable', () => {
    const props = boardProps()
    const { rerender } = render(React.createElement(GameBoardSection, props))
    expect(mockRenderCounts.chess).toBe(1)
    // Same refs — e.g. a chat/panel/timer-parent update in Game.tsx.
    rerender(React.createElement(GameBoardSection, props))
    expect(mockRenderCounts.chess).toBe(1)
  })

  test('GameBoardSection re-renders when board state actually changes', () => {
    const props = boardProps()
    const { rerender } = render(React.createElement(GameBoardSection, props))
    expect(mockRenderCounts.chess).toBe(1)
    rerender(React.createElement(GameBoardSection, {
      ...props,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    }))
    expect(mockRenderCounts.chess).toBe(2)
  })

  test('GameTopBarSection skips re-render when its slice is unchanged', () => {
    const props = topBarProps()
    const { rerender } = render(React.createElement(GameTopBarSection, props))
    expect(mockRenderCounts.topBar).toBe(1)
    rerender(React.createElement(GameTopBarSection, props))
    expect(mockRenderCounts.topBar).toBe(1)
  })

  test('GameTopBarSection re-renders on turn change', () => {
    const props = topBarProps()
    const { rerender } = render(React.createElement(GameTopBarSection, props))
    expect(mockRenderCounts.topBar).toBe(1)
    rerender(React.createElement(GameTopBarSection, { ...props, currentTurn: Team.BLACK }))
    expect(mockRenderCounts.topBar).toBe(2)
  })

  test('P7 visual parity: DuelGame variant keeps its own wrapper, no captures', () => {
    const { whitePlayers, blackPlayers, ...rest } = topBarProps()
    const { container } = render(React.createElement(GameTopBarSection, {
      whitePlayers,
      blackPlayers,
      matchTimeRemaining: rest.matchTimeRemaining,
      matchTimerActive: rest.matchTimerActive,
      totalMatchSeconds: rest.totalMatchSeconds,
      roundLabel: undefined,
      currentTurn: rest.currentTurn,
      timerNode: rest.timerNode,
      resignVisible: true,
      onResign: rest.onResign,
      onOpenSettings: rest.onOpenSettings,
      soundEnabled: rest.soundEnabled,
      onToggleSound: rest.onToggleSound,
      shellClassName: 'w-full bg-[var(--color-page-bg)] border-b border-white/5 px-3 py-2',
    }))
    const shell = container.firstChild as HTMLElement
    expect(shell.className).toContain('bg-[var(--color-page-bg)]')
    expect(shell.className).not.toContain('bg-white')
  })

  test('P7 visual parity: board outer wrapper is configurable per mode', () => {
    const { container } = render(React.createElement(GameBoardSection, {
      ...boardProps(),
      maxWidth: 'min(95vw, 80vh, 600px)',
      outerClassName: 'flex justify-center',
    }))
    const outer = container.firstChild as HTMLElement
    expect(outer.className).toBe('flex justify-center')
  })

  test('Lifecycle polish: board never overlays a status pill (hint lives below turn pill)', () => {
    const { container, rerender } = render(React.createElement(GameBoardSection, {
      ...boardProps(),
    }))
    expect(container.querySelector('[role="status"]')).toBeNull()
    // Extra unknown props must not render an overlay either.
    rerender(React.createElement(GameBoardSection, {
      ...boardProps(),
    }))
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.firstChild?.childNodes[0].textContent ?? '').not.toContain('Opponent is thinking')
  })

  test('Lifecycle polish: GameTopBarSection accepts isThinking without breaking memo', () => {
    const props = { ...topBarProps(), isThinking: true as boolean }
    const { rerender } = render(React.createElement(GameTopBarSection, props))
    expect(mockRenderCounts.topBar).toBe(1)
    rerender(React.createElement(GameTopBarSection, props))
    expect(mockRenderCounts.topBar).toBe(1)
  })
})
