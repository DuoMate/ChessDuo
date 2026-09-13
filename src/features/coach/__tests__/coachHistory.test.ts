/**
 * Coach history tests — the Insights/transcript data layer.
 *
 * Covers: snapshot per analyzed move, moveNumber ordinals, illegal moves and
 * resignations record nothing, fresh games start empty (no cross-game leak).
 */
import { CoachGame } from '../coachGame'
import type { CoachEngine, EngineMove } from '../coachEngine'
import type { ChessBot } from '../../bots/chessBot'

function mockEngine() {
  const top: EngineMove[] = [
    { uci: 'e2e4', san: 'e4', cp: 30, mate: null, pv: ['e2e4'] },
    { uci: 'd2d4', san: 'd4', cp: 20, mate: null, pv: ['d2d4'] },
    { uci: 'g1f3', san: 'Nf3', cp: 10, mate: null, pv: ['g1f3'] },
  ]
  return {
    analyzeTopMoves: jest.fn().mockResolvedValue(top),
    scoreMove: jest.fn().mockResolvedValue({ uci: 'e2e4', san: 'e4', cp: 30, mate: null, pv: ['e2e4'] }),
    evaluatePosition: jest.fn().mockResolvedValue({ uci: 'e7e5', san: 'e5', cp: -20, mate: null, pv: ['e7e5'] }),
    terminate: jest.fn(),
  } as unknown as CoachEngine
}

function mockBot(moves: string[] = ['e7e5']) {
  let i = 0
  return {
    selectMoveAsync: jest.fn().mockImplementation(() => Promise.resolve(moves[Math.min(i++, moves.length - 1)])),
  } as unknown as ChessBot
}

describe('CoachGame feedbackHistory', () => {
  it('starts empty and records one snapshot per analyzed player move', async () => {
    const game = new CoachGame({ playerColor: 'w', botLevel: 3, engine: mockEngine(), bot: mockBot(['e7e5', 'b8c6']) })
    await game.start()
    expect(game.getState().feedbackHistory).toEqual([])

    await game.applyPlayerMove('e2', 'e4')
    await game.applyPlayerMove('g1', 'f3')

    const history = game.getState().feedbackHistory
    expect(history).toHaveLength(2)
    expect(history[0].moveNumber).toBe(1)
    expect(history[1].moveNumber).toBe(2)
    expect(history[0].feedback.playerMoveSan).toBe('e4')
    expect(history[0].feedback.bestMoveSan).toBe('e4')
    expect(history[0].feedback.verdict).toBe('best')
    expect(history[0].feedback.explanation).toContain('e4')
  })

  it('records nothing for illegal moves or resignations', async () => {
    const game = new CoachGame({ playerColor: 'w', botLevel: 3, engine: mockEngine(), bot: mockBot() })
    await game.start()

    expect(await game.applyPlayerMove('e2', 'e5')).toBeNull()
    expect(game.getState().feedbackHistory).toHaveLength(0)

    await game.resign()
    expect(game.getState().status).toBe('game_over')
    expect(game.getState().feedbackHistory).toHaveLength(0)
  })

  it('does not leak history into a new game session', async () => {
    const first = new CoachGame({ playerColor: 'w', botLevel: 3, engine: mockEngine(), bot: mockBot() })
    await first.start()
    await first.applyPlayerMove('e2', 'e4')
    expect(first.getState().feedbackHistory).toHaveLength(1)

    const second = new CoachGame({ playerColor: 'w', botLevel: 3, engine: mockEngine(), bot: mockBot() })
    await second.start()
    expect(second.getState().feedbackHistory).toEqual([])
  })
})
