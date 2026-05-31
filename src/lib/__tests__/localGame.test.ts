import { LocalGame, GameStatus } from '../../features/offline/game/localGame'
import { Team } from '../../features/game-engine/gameState'

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
    game.addPlayer('w1', Team.WHITE)
    game.addPlayer('w2', Team.WHITE)
    game.addPlayer('b1', Team.BLACK)
    game.addPlayer('b2', Team.BLACK)
    game.start()
    
    game.selectMove('w1', 'e4')
    
    expect(game.getSelectedMove('w1')).toBe('e4')
  })

  test('does not reveal opponent move', () => {
    game.addPlayer('w1', Team.WHITE)
    game.addPlayer('w2', Team.WHITE)
    game.addPlayer('b1', Team.BLACK)
    game.addPlayer('b2', Team.BLACK)
    game.start()
    
    game.selectMove('w1', 'e4')
    game.selectMove('w2', 'd4')
    
    expect(game.getSelectedMove('w1')).toBe('e4')
    expect(game.getHiddenMove('w2')).toBeNull()
  })
})

// Stockfish-dependent tests - require browser environment
describe.skip('Local Game Flow (Stockfish-dependent)', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
  })

  function setupGame(g: LocalGame) {
    g.addPlayer('w1', Team.WHITE)
    g.addPlayer('w2', Team.WHITE)
    g.addPlayer('b1', Team.BLACK)
    g.addPlayer('b2', Team.BLACK)
    g.start()
  }

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
})

// Unit tests for move evaluation selection logic (no Stockfish needed)
describe('Move evaluation selection', () => {
  function buildMovesToEvaluate(
    player1Uci: string,
    player2Uci: string,
    allLegalUci: string[],
    limit = 6
  ): string[] {
    const playerMoves = [player1Uci, player2Uci].filter(Boolean)
    const supplementalMoves = allLegalUci
      .filter(uci => !playerMoves.includes(uci))
      .slice(0, limit - playerMoves.length)
    return [...playerMoves, ...supplementalMoves]
  }

  test('includes both player moves in evaluation set', () => {
    const legalMoves = ['a2a3', 'a2a4', 'b1a3', 'b1c3', 'c2c3', 'c2c4', 'd1c5', 'e1e5', 'h5f7']
    const result = buildMovesToEvaluate('h5f7', 'b1c3', legalMoves)
    expect(result).toContain('h5f7')
    expect(result).toContain('b1c3')
    expect(result.length).toBe(6)
  })

  test('handles both players picking same move (isSync)', () => {
    const legalMoves = ['a2a3', 'a2a4', 'b1a3', 'b1c3', 'c2c3', 'c2c4']
    const result = buildMovesToEvaluate('e4e5', 'e4e5', legalMoves)
    expect(result).toContain('e4e5')
    expect(result.length).toBeLessThanOrEqual(6)
  })

  test('works with fewer than 6 legal moves (endgame)', () => {
    const legalMoves = ['e1e2', 'e1f1', 'e1g1']
    const result = buildMovesToEvaluate('e1g1', 'e1e2', legalMoves)
    expect(result).toContain('e1g1')
    expect(result).toContain('e1e2')
    expect(result.length).toBeLessThanOrEqual(3)
  })

  test('promotion move from late-alphabet square is included', () => {
    const legalMoves = ['a7a8q', 'a7a8r', 'b7b8q', 'c7c8q', 'd7d8q', 'e7e8q', 'f7f8q', 'g7g8q', 'h7h8q']
    const result = buildMovesToEvaluate('h7h8q', 'a7a8q', legalMoves)
    expect(result).toContain('h7h8q')
    expect(result).toContain('a7a8q')
  })
})
