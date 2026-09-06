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
  topMoves: [{ san: 'e4', uci: 'e2e4', display: '+0.2' }],
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

describe('CoachPanel best move presentation', () => {
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

  test('toggles the current suggestion highlight without changing its move data', () => {
    const TestPanel = () => {
      const [showBestMove, setShowBestMove] = React.useState(false)
      return (
        <CoachPanel
          suggestion={suggestion}
          feedback={null}
          analyzing={false}
          isPlayerTurn={true}
          onSpeak={jest.fn()}
          showBestMove={showBestMove}
          onToggleBestMove={() => setShowBestMove((visible) => !visible)}
        />
      )
    }

    render(
      <TestPanel />,
    )

    expect(screen.getByRole('button', { name: 'Show Best Move' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show Best Move' }))
    expect(screen.getByRole('button', { name: 'Hide Best Move' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide Best Move' }))
    expect(screen.getByRole('button', { name: 'Show Best Move' })).toBeInTheDocument()
  })
})