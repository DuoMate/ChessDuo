import { LocalGame, GameStatus } from '../localGame'
import { Team } from '../gameState'

describe('Local Game Flow', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
  })

  test('initializes with correct starting state', () => {
    expect(game.status).toBe(GameStatus.WAITING)
    expect(game.currentTurn).toBe(Team.WHITE)
  })

  test('allows adding players to teams', () => {
    game.addPlayer('w1', Team.WHITE)
    game.addPlayer('w2', Team.WHITE)
    game.addPlayer('b1', Team.BLACK)
    game.addPlayer('b2', Team.BLACK)
    
    expect(game.status).toBe(GameStatus.READY)
  })

  test('starts game when all players are added', () => {
    game.addPlayer('w1', Team.WHITE)
    game.addPlayer('w2', Team.WHITE)
    game.addPlayer('b1', Team.BLACK)
    game.addPlayer('b2', Team.BLACK)
    
    game.start()
    
    expect(game.status).toBe(GameStatus.PLAYING)
  })

  test('allows selecting moves during play', () => {
    setupGame(game)
    
    game.selectMove('w1', 'e4')
    
    expect(game.getSelectedMove('w1')).toBe('e4')
  })

  test('does not reveal opponent move', () => {
    setupGame(game)
    
    game.selectMove('w1', 'e4')
    game.selectMove('w2', 'd4')
    
    expect(game.getSelectedMove('w1')).toBe('e4')
    expect(game.getHiddenMove('w2')).toBeNull()
  })

  test('resolves turn when both players lock in', async () => {
    setupGame(game)
    
    game.selectMove('w1', 'e4')
    game.selectMove('w2', 'd4')
    await game.lockAndResolve()
    
    expect(game.currentTurn).toBe(Team.BLACK)
    expect(game.board.fen()).not.toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  })

  test('tracks sync rate when players choose same move', async () => {
    setupGame(game)
    
    game.selectMove('w1', 'e4')
    game.selectMove('w2', 'e4')
    await game.lockAndResolve()
    
    const stats = game.getStats()
    expect(stats.syncRate).toBe(1)
  })

  test('tracks conflict rate when players disagree', async () => {
    setupGame(game)
    
    game.selectMove('w1', 'e4')
    game.selectMove('w2', 'd4')
    await game.lockAndResolve()
    
    const stats = game.getStats()
    expect(stats.conflicts).toBe(1)
  })

  test('tracks move accuracy', async () => {
    setupGame(game)
    
    game.selectMove('w1', 'e4')
    game.selectMove('w2', 'd4')
    await game.lockAndResolve()
    
    const stats = game.getStats()
    expect(stats.movesPlayed).toBe(1)
  })

  function setupGame(g: LocalGame) {
    g.addPlayer('w1', Team.WHITE)
    g.addPlayer('w2', Team.WHITE)
    g.addPlayer('b1', Team.BLACK)
    g.addPlayer('b2', Team.BLACK)
    g.start()
  }
})
