import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CoachGame } from '../CoachGame'

type Listener = (state: Record<string, unknown>) => void

const mockEngineState = (
  status: 'idle' | 'playing' | 'game_over',
  result: string | null = status === 'game_over' ? 'Loss by resignation' : null,
  gameOverReason: string | null = status === 'game_over' ? 'resignation' : null,
) => ({
  fen: 'start',
  status,
  playerColor: 'w',
  botLevel: 3,
  turn: 'w',
  lastMove: null,
  suggestion: null,
  feedback: null,
  result,
  gameOverReason,
  moveHistory: [],
  blunders: 0,
  mistakes: 0,
  accuracy: 0,
  analyzing: false,
  feedbackHistory: [],
})

let mockActiveListener: Listener | null = null
const mockResign = jest.fn(() => {
  mockActiveListener?.(mockEngineState('game_over'))
  return Promise.resolve()
})
const mockAbandon = jest.fn(() => {
  mockActiveListener?.(mockEngineState('game_over', 'Match abandoned', 'abandoned'))
  return Promise.resolve()
})

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

    resign = mockResign
    abandon = mockAbandon
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

jest.mock('@/components/ChessBoard', () => ({ ChessBoard: () => <div data-testid="chess-board" /> }))
jest.mock('@/components/BoardBottomNav', () => ({ BoardBottomNav: () => null }))
jest.mock('@/components/RoundHistorySidebar', () => ({ RoundHistorySidebar: () => null }))
jest.mock('@/components/SlideOver', () => ({ SlideOver: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@/components/coach/CoachPanel', () => ({ CoachPanel: () => null }))
jest.mock('@/components/coach/CoachInsightsPanel', () => ({ CoachInsightsPanel: () => null }))
jest.mock('@/components/coach/CoachTranscriptPanel', () => ({ CoachTranscriptPanel: () => null }))
jest.mock('../../ResignConfirmModal', () => ({
  ResignConfirmModal: ({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) => (
    open ? (
      <div role="dialog">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>Resign</button>
      </div>
    ) : null
  ),
}))
jest.mock('../../NativeAdSlot', () => ({
  NativeAdSlot: ({ open }: { open: boolean }) => open ? <div data-testid="native-ad-slot" /> : null,
}))
jest.mock('../../AdSenseSlot', () => ({
  AdSenseSlot: ({ open }: { open: boolean }) => open ? <div data-testid="adsense-slot" /> : null,
}))
jest.mock('@/hooks/usePremium', () => ({ usePremium: () => ({ isPremium: false, loading: false }) }))
jest.mock('@/hooks/useNavigationGuard', () => ({ useNavigationGuard: jest.fn() }))
jest.mock('@/hooks/useCapacitorBackButton', () => ({ useCapacitorBackButton: jest.fn() }))
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ soundEnabled: false }) }))
jest.mock('../../Toast', () => ({ useGameToast: () => ({ warning: jest.fn() }) }))
jest.mock('@/lib/sounds', () => ({ playMoveSound: jest.fn(), playCaptureSound: jest.fn() }))

describe('CoachGame resignation flow', () => {
  beforeEach(() => {
    mockActiveListener = null
    mockResign.mockClear()
    mockAbandon.mockClear()
  })

  it('shows the terminal popup and both ad surfaces after confirming resignation', async () => {
    render(<CoachGame playerId="player-1" playerColor="white" onLeave={jest.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Resign' }))
    fireEvent.click(screen.getByRole('dialog').querySelector('button:last-child') as HTMLButtonElement)

    await waitFor(() => expect(mockResign).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Loss by resignation')).toBeInTheDocument()
    expect(screen.getByTestId('native-ad-slot')).toBeInTheDocument()
    expect(screen.getByTestId('adsense-slot')).toBeInTheDocument()
  })

  it('routes active-game Leave through abandon into the terminal popup instead of Home', async () => {
    const onLeave = jest.fn()
    render(<CoachGame playerId="player-1" playerColor="white" onLeave={onLeave} />)

    // Wait for playing state (Resign button only renders while playing).
    fireEvent.click(await screen.findByRole('button', { name: 'Resign' }))
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))

    await waitFor(() => expect(mockAbandon).toHaveBeenCalledTimes(1))
    expect(onLeave).not.toHaveBeenCalled()
    expect(await screen.findByText('Match abandoned')).toBeInTheDocument()
    expect(screen.getByTestId('native-ad-slot')).toBeInTheDocument()
    expect(screen.getByTestId('adsense-slot')).toBeInTheDocument()
  })
})
