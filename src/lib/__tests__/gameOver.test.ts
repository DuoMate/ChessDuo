import { LocalGame, GameStatus } from '../../features/offline/game/localGame'
import { Team } from '../../features/game-engine/gameState'

// These tests require Stockfish which is only available in browser environment
// They are skipped in test environment but work in browser
describe.skip('Win/Lose/Draw Detection', () => {
  test('detects checkmate after move is applied', async () => {
    const game = new LocalGame()
    game.addPlayer('w1', Team.WHITE)
    game.addPlayer('w2', Team.WHITE)
    game.addPlayer('b1', Team.BLACK)
    game.addPlayer('b2', Team.BLACK)
    game.start()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')

    game.selectMove('w1', 'Qf7#')
    game.selectMove('w2', 'Qf7#')
    await game.lockAndResolve()

    expect(game.isGameOver()).toBe(true)
    expect(game.getResult()).toContain('White wins by checkmate')
    expect(game.status).toBe(GameStatus.GAME_OVER)
  })

  test('detects game over status after checkmate', async () => {
    const game = new LocalGame()
    game.addPlayer('w1', Team.WHITE)
    game.addPlayer('w2', Team.WHITE)
    game.addPlayer('b1', Team.BLACK)
    game.addPlayer('b2', Team.BLACK)
    game.start()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')

    game.selectMove('w1', 'Qf7#')
    game.selectMove('w2', 'Qf7#')
    await game.lockAndResolve()

    expect(game.isGameOver()).toBe(true)
    expect(game.status).toBe(GameStatus.GAME_OVER)
  })

  test('returns correct winner for checkmate', async () => {
    const game = new LocalGame()
    game.addPlayer('w1', Team.WHITE)
    game.addPlayer('w2', Team.WHITE)
    game.addPlayer('b1', Team.BLACK)
    game.addPlayer('b2', Team.BLACK)
    game.start()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')

    game.selectMove('w1', 'Qf7#')
    game.selectMove('w2', 'Qf7#')
    await game.lockAndResolve()

    expect(game.getResult()).toContain('White wins by checkmate')
  })
})
