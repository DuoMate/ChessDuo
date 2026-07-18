import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamHexagon } from '../TeamHexagon'
import { BoardTopBar } from '../BoardTopBar'
import { PendingMovesRow } from '../PendingMovesRow'
import { ConfirmMoveButton } from '../ConfirmMoveButton'
import { MoveResolvedInline, type MoveResolutionData } from '../MoveResolvedInline'
import { RoundHistorySidebar } from '../RoundHistorySidebar'
import { BoardBottomNav } from '../BoardBottomNav'

describe('TeamHexagon', () => {
  it('renders the value', () => {
    render(<TeamHexagon value={2} team="WHITE" />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders with a different value and team', () => {
    const { container } = render(<TeamHexagon value={3} team="BLACK" />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('BoardTopBar', () => {
  it('renders team labels and players', () => {
    render(
      <BoardTopBar
        whitePlayers={[
          { id: 'p1', label: 'You', type: 'human', isYou: true },
          { id: 'p2', label: 'Teammate', type: 'human' },
        ]}
        blackPlayers={[
          { id: 'b1', label: 'Bot 1', type: 'bot' },
        ]}
        matchTimeRemaining={120}
        matchTimerActive={true}
        totalMatchSeconds={600}
        currentTurn={'WHITE' as any}
      />
    )
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Teammate')).toBeInTheDocument()
    expect(screen.getByText('Bot 1')).toBeInTheDocument()
    expect(screen.getByText('White')).toBeInTheDocument()
    expect(screen.getByText('Black')).toBeInTheDocument()
  })
})

describe('PendingMovesRow', () => {
  it('shows "Waiting..." when no teammate move', () => {
    render(
      <PendingMovesRow
        yourMove={null}
        teammateMove={null}
      />
    )
    expect(screen.getByText('Waiting...')).toBeInTheDocument()
  })

  it('shows submitted when both moves present', () => {
    render(
      <PendingMovesRow
        yourMove={{ san: 'Nf3', piece: 'N', color: 'white' }}
        teammateMove={{ san: 'e4', piece: 'P', color: 'white' }}
      />
    )
    const submitted = screen.getAllByText(/Submitted/i)
    expect(submitted.length).toBe(2)
  })
})

describe('ConfirmMoveButton', () => {
  it('returns null when not visible', () => {
    const { container } = render(
      <ConfirmMoveButton visible={false} hasPendingMove={true} onConfirm={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the button when visible', () => {
    render(
      <ConfirmMoveButton visible={true} hasPendingMove={true} onConfirm={jest.fn()} />
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onConfirm when clicked', () => {
    const onConfirm = jest.fn()
    render(
      <ConfirmMoveButton visible={true} hasPendingMove={true} onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onConfirm).toHaveBeenCalled()
  })
})

describe('MoveResolvedInline', () => {
  const data: MoveResolutionData = {
    yourMove: { san: 'Nf3', piece: 'N', color: 'white' },
    teammateMove: { san: 'e4', piece: 'P', color: 'black' },
    engineChoseMove: { san: 'e4' },
    yourAccuracy: 86.2,
    teammateAccuracy: 94.7,
    yourLoss: 30,
    teammateLoss: 10,
    isSync: false,
    youMatchedEngine: false,
    teammateMatchedEngine: true,
    result: 'teammate_won',
    scoreDelta: 0.38,
    evaluationAfter: 0.53,
    evaluationImproved: true,
  }

  it('renders the inline card with data', () => {
    render(
      <MoveResolvedInline data={data} onNext={jest.fn()} />
    )
    expect(screen.getByText('Move Resolved')).toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('Your Move')).toBeInTheDocument()
    expect(screen.getByText('Teammate')).toBeInTheDocument()
  })

  it('calls onNext when the Continue button is clicked', () => {
    const onNext = jest.fn()
    render(
      <MoveResolvedInline data={data} onNext={onNext} />
    )
    fireEvent.click(screen.getByText('Continue'))
    expect(onNext).toHaveBeenCalled()
  })
})

describe('RoundHistorySidebar', () => {
  it('renders entries when open', () => {
    render(
      <RoundHistorySidebar
        open={true}
        entries={[
          { round: 1, playerLabel: 'You', moveSan: 'e4', pieceColor: 'white', pieceChar: 'P', evalDelta: 0.2 },
          { round: 2, playerLabel: 'Teammate', moveSan: 'Nf3', pieceColor: 'white', pieceChar: 'N', evalDelta: -0.1, isCurrent: true },
        ]}
        onClose={jest.fn()}
      />
    )
    expect(screen.getByText('Round History')).toBeInTheDocument()
    expect(screen.getByText('e4')).toBeInTheDocument()
    expect(screen.getByText('Nf3')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })
})

describe('BoardBottomNav', () => {
  it('renders all tabs and navigation buttons', () => {
    render(
      <BoardBottomNav activeTab="game" onTabChange={jest.fn()} onBack={jest.fn()} onForward={jest.fn()} />
    )
    expect(screen.getByText('Moves')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Forward')).toBeInTheDocument()
  })

  it('calls onTabChange when a tab is tapped', () => {
    const onTabChange = jest.fn()
    render(
      <BoardBottomNav activeTab="game" onTabChange={onTabChange} onBack={jest.fn()} onForward={jest.fn()} />
    )
    fireEvent.click(screen.getByText('Moves'))
    expect(onTabChange).toHaveBeenCalledWith('moves')
  })

  it('calls onBack when Back button is tapped', () => {
    const onBack = jest.fn()
    render(
      <BoardBottomNav activeTab="game" onTabChange={jest.fn()} onBack={onBack} onForward={jest.fn()} />
    )
    fireEvent.click(screen.getByText('Back'))
    expect(onBack).toHaveBeenCalled()
  })
})
