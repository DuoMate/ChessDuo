import { LocalGame } from '../localGame'
import { Team } from '../gameState'

describe('End-to-End Move Evaluation', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
  })

  test('complete turn with Stockfish evaluation', async () => {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()

    const initialFen = game.board.fen()
    console.log('Initial FEN:', initialFen)

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'Nf3')

    console.log('Player 1 move:', game.getSelectedMove('player1'))
    console.log('Player 2 move:', game.getSelectedMove('player2'))

    await game.lockAndResolve()

    const finalFen = game.board.fen()
    console.log('Final FEN:', finalFen)
    console.log('Current turn:', game.currentTurn)

    expect(finalFen).not.toBe(initialFen)
    expect(game.currentTurn).toBe(Team.BLACK)

    const comparison = game.lastMoveComparison
    expect(comparison).not.toBeNull()
    expect(comparison!.isSync).toBe(false)

    console.log('Comparison:', JSON.stringify(comparison, null, 2))
    console.log('Stats:', JSON.stringify(game.getStats(), null, 2))
  }, 30000)

  test('synchronized moves when both choose same', async () => {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')

    await game.lockAndResolve()

    const comparison = game.lastMoveComparison
    expect(comparison!.isSync).toBe(true)
    expect(comparison!.player1Accuracy).toBe(comparison!.player2Accuracy)
  }, 30000)
})