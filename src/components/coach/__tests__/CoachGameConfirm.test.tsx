import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CoachGame } from '../CoachGame'

type Listener = (state: Record<string, unknown>) => void

let mockConfirmMove = true

const mockEngineState = (status: 'idle' | 'playing' | 'game_over') => ({
  fen: 'start',
  status,
  playerColor: 'w',
  botLevel: 3,
  turn: 'w',
  lastMove: null,
  suggestion: null,
  feedback: null,
  result: null,
  gameOverReason: null,
  moveHistory: [],
  blunders: 0,
  mistakes: 0,
  accuracy: 0,
  analyzing: false,
  feedbackHistory: [],
})

let mockActiveListener: Listener | null = null
const mockApplyPlayerMove = jest.fn(() =>
  Promise.resolve({ playerMoveSan: 'e4' }),
)

jest.mock('@/features/coach', () => ({
  CoachGame: class MockCoachGame {
    onStateChange(listener: Listener) {
      mockActiveListener = listener
      listener(mockEngineState('idle'))
      return () => { mockActiveListener = null }
    }

    start() {
      mockActiveListener?.(mockEngineState('playing'))
      return Promise.resolve()
    }

    applyPlayerMove = mockApplyPlayerMove
    resign = jest.fn(() => Promise.resolve())
    abandon = jest.fn(() => Promise.resolve())
    destroy() {}
  },
  coachVoice: {
    isEnabled: () => false,
    isSupported: () => false,
    setEnabled: jest.fn(),
    speak: jest.fn(),
    stop: jest.fn(),
  },
  saveCoachGame: jest.fn(() => Promise.resolve()),
  claimCoachDailyTrial: jest.fn(() => Promise.resolve({ claimed: false, persisted: true, state: { isPremium: false } })),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

// Passthrough AnimatePresence so ConfirmMoveBar exit-removal is synchronous
// in jsdom (same pattern as GameOnOverlay/ConfirmMoveFlow suites).
jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  }
})

jest.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ onMove }: { onMove: (move: string) => void }) => (
    <button data-testid="mock-drop" onClick={() => onMove('e2-e4')}>
      drop
    </button>
  ),
}))
jest.mock('@/components/BoardBottomNav', () => ({ BoardBottomNav: () => null }))
jest.mock('@/components/RoundHistorySidebar', () => ({ RoundHistorySidebar: () => null }))
jest.mock('@/components/SlideOver', () => ({ SlideOver: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@/components/coach/CoachPanel', () => ({ CoachPanel: () => null }))
jest.mock('@/components/coach/CoachInsightsPanel', () => ({ CoachInsightsPanel: () => null }))
jest.mock('@/components/coach/CoachTranscriptPanel', () => ({ CoachTranscriptPanel: () => null }))
jest.mock('../../ResignConfirmModal', () => ({ ResignConfirmModal: () => null }))
jest.mock('../../NativeAdSlot', () => ({ NativeAdSlot: () => null }))
jest.mock('../../AdSenseSlot', () => ({ AdSenseSlot: () => null }))
jest.mock('@/hooks/usePremium', () => ({ usePremium: () => ({ isPremium: false, loading: false }) }))
jest.mock('@/hooks/useGameOverAdPreload', () => ({ useGameOverAdPreload: jest.fn() }))
jest.mock('@/hooks/useNavigationGuard', () => ({ useNavigationGuard: jest.fn() }))
jest.mock('@/hooks/useCapacitorBackButton', () => ({ useCapacitorBackButton: jest.fn() }))
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ soundEnabled: false, confirmMove: mockConfirmMove }),
}))
jest.mock('../../Toast', () => ({ useGameToast: () => ({ warning: jest.fn() }) }))
jest.mock('@/lib/sounds', () => ({ playMoveSound: jest.fn(), playCaptureSound: jest.fn() }))

describe('CoachGame confirm-move flow', () => {
  beforeEach(() => {
    mockActiveListener = null
    mockApplyPlayerMove.mockClear()
    mockConfirmMove = true
  })

  it('stages the drop without submitting when confirmMove is on', async () => {
    render(<CoachGame playerId="player-1" playerColor="white" onLeave={jest.fn()} />)
    fireEvent.click(await screen.findByTestId('mock-drop'))

    expect(mockApplyPlayerMove).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Confirm move' })).toBeInTheDocument()
  })

  it('submits the staged move on Confirm', async () => {
    render(<CoachGame playerId="player-1" playerColor="white" onLeave={jest.fn()} />)
    fireEvent.click(await screen.findByTestId('mock-drop'))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm move' }))

    await waitFor(() => expect(mockApplyPlayerMove).toHaveBeenCalledTimes(1))
    expect(mockApplyPlayerMove).toHaveBeenCalledWith('e2', 'e4', undefined)
    expect(screen.queryByRole('button', { name: 'Confirm move' })).not.toBeInTheDocument()
  })

  it('never touches the engine on Cancel', async () => {
    render(<CoachGame playerId="player-1" playerColor="white" onLeave={jest.fn()} />)
    fireEvent.click(await screen.findByTestId('mock-drop'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel move' }))

    expect(mockApplyPlayerMove).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Confirm move' })).not.toBeInTheDocument()
  })

  it('submits immediately with no bar when confirmMove is off', async () => {
    mockConfirmMove = false
    render(<CoachGame playerId="player-1" playerColor="white" onLeave={jest.fn()} />)
    fireEvent.click(await screen.findByTestId('mock-drop'))

    await waitFor(() => expect(mockApplyPlayerMove).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Confirm move' })).not.toBeInTheDocument()
  })
})
