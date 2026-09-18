import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { CoachPanel } from '../CoachPanel'
import type { CoachFeedback, Suggestion } from '@/features/coach'

jest.mock('lucide-react', () => ({
  Sparkles: () => null,
  Volume2: () => null,
  Trophy: () => null,
  Eye: () => null,
  EyeOff: () => null,
}))

const suggestion: Suggestion = {
  topMoves: [
    { san: 'e4', uci: 'e2e4', display: '+0.2' },
    { san: 'Nf3', uci: 'g1f3', display: '+0.1' },
    { san: 'd4', uci: 'd2d4', display: '+0.0' },
  ],
  bestMoveSan: 'e4',
  evaluationDisplay: '+0.2',
}

const feedback: CoachFeedback = {
  playerMoveSan: 'a3',
  bestMoveSan: 'e4',
  topMoves: [],
  centipawnLoss: 100,
  verdict: 'inaccuracy',
  isBlunder: false,
  missedBetterMove: true,
  explanation: 'a3 is a little inaccurate — consider e4 instead.',
  evaluationDisplay: '+0.1',
}

describe('CoachPanel top-3 presentation', () => {
  test('hides the action when only stale feedback is available', () => {
    render(
      <CoachPanel
        suggestion={null}
        feedback={feedback}
        analyzing={false}
        isPlayerTurn={false}
        onSpeak={jest.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /best move/i })).not.toBeInTheDocument()
  })

  test('hides top-3 cards by default behind Show 3 Best Moves', () => {
    render(
      <CoachPanel
        suggestion={suggestion}
        feedback={null}
        analyzing={false}
        isPlayerTurn={true}
        onSpeak={jest.fn()}
        showBestMoves={false}
        onToggleBestMoves={jest.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Show 3 Best Moves/ })).toBeInTheDocument()
    // SANs must not leak before opt-in
    expect(screen.queryByText('e4')).not.toBeInTheDocument()
    expect(screen.queryByText('Nf3')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/legend/i)).not.toBeInTheDocument()
  })

  test('toggles the top-3 cards + legend without changing move data', () => {
    const TestPanel = () => {
      const [showBestMoves, setShowBestMoves] = React.useState(false)
      return (
        <CoachPanel
          suggestion={suggestion}
          feedback={null}
          analyzing={false}
          isPlayerTurn={true}
          onSpeak={jest.fn()}
          showBestMoves={showBestMoves}
          onToggleBestMoves={() => setShowBestMoves((visible) => !visible)}
        />
      )
    }

    render(<TestPanel />)

    expect(screen.getByRole('button', { name: /Show 3 Best Moves/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show 3 Best Moves/ }))
    expect(screen.getByRole('button', { name: 'Hide 3 Best Moves' })).toBeInTheDocument()
    // All 3 ranked cards with number + text labels
    expect(screen.getByRole('listitem', { name: /Option 1: e4.*Best/ })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /Option 2: Nf3/ })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /Option 3: d4/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/legend/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide 3 Best Moves' }))
    expect(screen.getByRole('button', { name: /Show 3 Best Moves/ })).toBeInTheDocument()
    expect(screen.queryByText('Nf3')).not.toBeInTheDocument()
  })

  test('supports legacy singular toggle props', () => {
    render(
      <CoachPanel
        suggestion={suggestion}
        feedback={null}
        analyzing={false}
        isPlayerTurn={true}
        onSpeak={jest.fn()}
        showBestMove={false}
        onToggleBestMove={jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Show 3 Best Moves/ })).toBeInTheDocument()
  })
})
