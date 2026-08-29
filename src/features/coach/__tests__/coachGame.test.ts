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

function mockBot() {
  return {
    selectMoveAsync: jest.fn().mockResolvedValue('e7e5'),
  } as unknown as ChessBot
}

describe('CoachGame', () => {
  it('starts a white-player game and computes a suggestion', async () => {
    const engine = mockEngine()
    const game = new CoachGame({ playerColor: 'w', botLevel: 3, engine, bot: mockBot() })
    await game.start()

    const state = game.getState()
    expect(state.status).toBe('playing')
    expect(state.turn).toBe('w')
    expect(engine.analyzeTopMoves).toHaveBeenCalled()
    expect(state.suggestion?.bestMoveSan).toBe('e4')
  })

  it('starts a black-player game with the bot opening first', async () => {
    const bot = mockBot()
    ;(bot.selectMoveAsync as jest.Mock).mockResolvedValue('e2e4')
    const game = new CoachGame({ playerColor: 'b', botLevel: 3, engine: mockEngine(), bot })
    await game.start()

    const state = game.getState()
    expect(bot.selectMoveAsync).toHaveBeenCalled()
    expect(state.turn).toBe('b')
    expect(state.moveHistory).toContain('e4')
  })

  it('applies a legal player move, produces feedback, and triggers the bot reply', async () => {
    const engine = mockEngine()
    const bot = mockBot()
    const game = new CoachGame({ playerColor: 'w', botLevel: 3, engine, bot })
    await game.start()

    const feedback = await game.applyPlayerMove('e2', 'e4')
    expect(feedback).not.toBeNull()
    expect(feedback?.playerMoveSan).toBe('e4')
    expect(feedback?.verdict).toBe('best')

    const state = game.getState()
    expect(state.moveHistory).toContain('e4')
    expect(state.moveHistory).toContain('e5')
  })

  it('rejects an illegal move', async () => {
    const game = new CoachGame({ playerColor: 'w', botLevel: 3, engine: mockEngine(), bot: mockBot() })
    await game.start()

    const feedback = await game.applyPlayerMove('e2', 'e5')
    expect(feedback).toBeNull()
  })

  it('resigns the game', async () => {
    const game = new CoachGame({ playerColor: 'w', botLevel: 3, engine: mockEngine(), bot: mockBot() })
    await game.start()
    await game.resign()

    expect(game.getState().status).toBe('game_over')
    expect(game.getState().result).toBe('Loss by resignation')
  })

  it('destroys the engine on destroy()', () => {
    const engine = mockEngine()
    const game = new CoachGame({ playerColor: 'w', botLevel: 3, engine, bot: mockBot() })
    game.destroy()
    expect(engine.terminate).toHaveBeenCalled()
  })
})
