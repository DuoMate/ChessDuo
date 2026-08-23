import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamHexagon } from '../TeamHexagon'
import { BoardTopBar } from '../BoardTopBar'
import { PendingMovesRow } from '../PendingMovesRow'
import { MoveResolvedInline, buildResolutionData, type MoveResolutionData } from '../MoveResolvedInline'
import type { MoveComparison } from '@/features/shared/gameTypes'
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

  it('shows "Both played exactly the same move!" only when isSync', () => {
    const comparison: MoveComparison = {
      player1Move: 'e4',
      player2Move: 'd4',
      player1Score: 50,
      player2Score: 30,
      player1Accuracy: 100,
      player2Accuracy: 85,
      player1Loss: 0,
      player2Loss: 20,
      player1Category: { label: 'Perfect', color: '#22c55e', emoji: '' },
      player2Category: { label: 'Great', color: '#84cc16', emoji: '' },
      winningMove: 'e4',
      winningScore: 50,
      isSync: false,
      bestEngineMove: 'e2e4',
      bestEngineScore: 50,
      turnStartFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      winnerId: 'player1',
      loserId: 'player2',
      loserFrom: 'd2',
      loserTo: 'd4',
      alternatives: [],
      youMatchedEngine: true,
      teammateMatchedEngine: false,
    }
    const syncData = buildResolutionData({ ...comparison, player1Move: 'e4', player2Move: 'e4', isSync: true }, true, 'WHITE')
    const { rerender } = render(<MoveResolvedInline data={syncData} onNext={jest.fn()} />)
    expect(screen.getByText('Both played exactly the same move!')).toBeInTheDocument()

    rerender(<MoveResolvedInline data={buildResolutionData(comparison, true, 'WHITE')} onNext={jest.fn()} />)
    expect(screen.queryByText('Both played exactly the same move!')).not.toBeInTheDocument()
  })
})

describe('buildResolutionData', () => {
  const comparison: MoveComparison = {
    player1Move: 'e4',
    player2Move: 'd4',
    player1Score: 50,
    player2Score: 30,
    player1Accuracy: 100,
    player2Accuracy: 85,
    player1Loss: 0,
    player2Loss: 20,
    player1Category: { label: 'Perfect', color: '#22c55e', emoji: '' },
    player2Category: { label: 'Great', color: '#84cc16', emoji: '' },
    winningMove: 'e4',
    winningScore: 50,
    isSync: false,
    bestEngineMove: 'e2e4',
    bestEngineScore: 50,
    turnStartFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    winnerId: 'player1',
    loserId: 'player2',
    loserFrom: 'd2',
    loserTo: 'd4',
    alternatives: [],
    youMatchedEngine: true,
    teammateMatchedEngine: false,
  }

  it('maps player1 (coordinator) as the viewer', () => {
    const data = buildResolutionData(comparison, true, 'WHITE')
    expect(data.yourMove.san).toBe('e4')
    expect(data.teammateMove.san).toBe('d4')
    expect(data.result).toBe('you_won')
    expect(data.yourAccuracy).toBe(100)
    expect(data.teammateAccuracy).toBe(85)
  })

  it('maps player2 (non-coordinator) as the viewer — reverse perspective', () => {
    const data = buildResolutionData(comparison, false, 'WHITE')
    expect(data.yourMove.san).toBe('d4')
    expect(data.teammateMove.san).toBe('e4')
    expect(data.result).toBe('teammate_won')
    expect(data.yourAccuracy).toBe(85)
    expect(data.teammateAccuracy).toBe(100)
  })

  it('keeps isSync true only when both original submissions are identical', () => {
    const sameMove = { ...comparison, player1Move: 'e4', player2Move: 'e4', isSync: true, loserId: null }
    expect(buildResolutionData(sameMove as MoveComparison, true, 'WHITE').isSync).toBe(true)
    expect(buildResolutionData(comparison, true, 'WHITE').isSync).toBe(false)
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
      <BoardBottomNav activeTab="game" onTabChange={jest.fn()} onForward={jest.fn()} onBackMove={jest.fn()} onForwardMove={jest.fn()} />
    )
    expect(screen.getByText('Moves')).toBeInTheDocument()
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Fwd')).toBeInTheDocument()
  })

  it('calls onTabChange when a tab is tapped', () => {
    const onTabChange = jest.fn()
    render(
      <BoardBottomNav activeTab="game" onTabChange={onTabChange} onForward={jest.fn()} onBackMove={jest.fn()} onForwardMove={jest.fn()} />
    )
    fireEvent.click(screen.getByText('Moves'))
    expect(onTabChange).toHaveBeenCalledWith('moves')
  })

  it('calls onBackMove when Back button is tapped', () => {
    const onBackMove = jest.fn()
    render(
      <BoardBottomNav activeTab="game" onTabChange={jest.fn()} onForward={jest.fn()} onBackMove={onBackMove} onForwardMove={jest.fn()} />
    )
    fireEvent.click(screen.getByText('Back'))
    expect(onBackMove).toHaveBeenCalled()
  })

  it('shows lock badge on Insights tab when insightsLocked is true', () => {
    render(
      <BoardBottomNav activeTab="game" onTabChange={jest.fn()} onForward={jest.fn()} onBackMove={jest.fn()} onForwardMove={jest.fn()} insightsLocked />
    )
    const lockIcons = screen.getAllByLabelText('Insights')[0].querySelectorAll('svg')
    // There should be 2 SVGs: BarChart3 + Lock
    expect(lockIcons.length).toBeGreaterThanOrEqual(2)
  })

  it('does not show lock badge on Insights tab when insightsLocked is false', () => {
    render(
      <BoardBottomNav activeTab="game" onTabChange={jest.fn()} onForward={jest.fn()} onBackMove={jest.fn()} onForwardMove={jest.fn()} insightsLocked={false} />
    )
    const lockIcons = screen.getAllByLabelText('Insights')[0].querySelectorAll('svg')
    // Only BarChart3 SVG, no extra Lock SVG
    expect(lockIcons.length).toBe(1)
  })
})
