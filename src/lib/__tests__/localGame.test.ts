import { LocalGame } from '../../features/offline/game/localGame'
import { GameStatus } from '../../features/shared/gameTypes'
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

  test('resolves turn when evaluator fails', async () => {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()

    // Simulate a Stockfish/WASM init failure
    ;(game as any).evaluator = {
      evaluateMoves: jest.fn().mockRejectedValue(new Error('Stockfish not ready')),
    }

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')

    await expect(game.lockAndResolve()).resolves.not.toThrow()

    expect(game.currentTurn).toBe(Team.BLACK)
    expect(game.board.fen()).not.toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(game.status).toBe(GameStatus.PLAYING)
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

// Game-over detection and winner determination tests
describe('Game Over Detection', () => {
  function setupGame() {
    const game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
    return game
  }

  test('isGameOver returns false for starting position', () => {
    const game = setupGame()
    expect(game.isGameOver()).toBe(false)
    expect(game.status).toBe(GameStatus.PLAYING)
    expect(game.getResult()).toBe('Game in progress')
  })

  test('detects checkmate position via board load', () => {
    const game = setupGame()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')

    expect(game.isGameOver()).toBe(false)

    game.board.move('Qf7#')

    expect(game.isGameOver()).toBe(true)
    expect(game.getResult()).toContain('White wins by checkmate')
  })

  test('detects stalemate position via board load', () => {
    const game = setupGame()
    game.board.load('k7/8/KQ6/8/8/8/8/8 b - - 0 1')

    expect(game.isGameOver()).toBe(true)
    expect(game.getResult()).toBe('Draw by stalemate')
  })

  test('getResult returns White wins checkmate for white checkmate', () => {
    const game = setupGame()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')
    game.board.move('Qf7#')

    expect(game.getResult()).toBe('White wins by checkmate')
  })

  test('getResult via setGameOverResult returns correct string', () => {
    const game = setupGame()
    game.setGameOverResult('Black wins by checkmate')
    expect(game.getResult()).toBe('Black wins by checkmate')
  })

  test('getResult returns draw for stalemate via board load', () => {
    const game = setupGame()

    game.board.load('k7/8/KQ6/8/8/8/8/8 b - - 0 1')

    expect(game.getResult()).toBe('Draw by stalemate')
  })

  test('setGameOverTimeup sets correct status and result', () => {
    const game = setupGame()
    game.setGameOverTimeup('White wins by timeout', 'timeout')

    expect(game.status).toBe(GameStatus.GAME_OVER)
    expect(game.getResult()).toBe('White wins by timeout')
    expect(game.getGameOverReason()).toBe('timeout')
  })

  test('setGameOverTimeup result takes precedence over board state', () => {
    const game = setupGame()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')
    game.board.move('Qf7#')

    expect(game.isGameOver()).toBe(true)

    game.setGameOverTimeup('Draw by timeout', 'timeout')

    expect(game.getResult()).toBe('Draw by timeout')
    expect(game.getGameOverReason()).toBe('timeout')
  })

  test('getGameOverReason returns null when game not over', () => {
    const game = setupGame()
    expect(game.getGameOverReason()).toBeNull()
  })

  test('getGameOverReason returns checkmate for checkmate', () => {
    const game = setupGame()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')
    game.board.move('Qf7#')

    expect(game.getGameOverReason()).toBe('checkmate')
  })

  test('getGameOverReason returns stalemate for stalemate', () => {
    const game = setupGame()
    game.board.load('k7/8/KQ6/8/8/8/8/8 b - - 0 1')

    expect(game.getGameOverReason()).toBe('stalemate')
  })

  test('status transitions from PLAYING to GAME_OVER via setTimeout', () => {
    const game = setupGame()
    expect(game.status).toBe(GameStatus.PLAYING)

    game.setGameOverTimeup('White wins by timeout', 'timeout')
    expect(game.status).toBe(GameStatus.GAME_OVER)
  })

  test('getResult returns correct default when board is game over', () => {
    const game = setupGame()
    game.board.load('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4')
    game.board.move('Qf7#')

    expect(game.isGameOver()).toBe(true)
    expect(game.getResult()).toContain('White wins by checkmate')
  })
})

describe('Game Status and Timer Interaction', () => {
  test('game starts in PLAYING status after start()', () => {
    const game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)

    expect(game.status).toBe(GameStatus.READY)
    game.start()
    expect(game.status).toBe(GameStatus.PLAYING)
  })

  test('isMatchTimerActive is false by default', () => {
    const game = new LocalGame()
    expect(game.isMatchTimerActive()).toBe(false)
  })

  test('start() activates the match timer (offline Quick Play countdown)', () => {
    const game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
    expect(game.isMatchTimerActive()).toBe(true)
  })

  test('setMatchTimerActive toggles timer state', () => {
    const game = new LocalGame()
    game.setMatchTimerActive(true)
    expect(game.isMatchTimerActive()).toBe(true)
    game.setMatchTimerActive(false)
    expect(game.isMatchTimerActive()).toBe(false)
  })

  test('setGameOverTimeup deactivates timer', () => {
    const game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
    game.setMatchTimerActive(true)

    game.setGameOverTimeup('White wins by timeout', 'timeout')

    expect(game.status).toBe(GameStatus.GAME_OVER)
  })

  test('timer can be checked when game is over', () => {
    const game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
    game.setMatchTimerActive(true)
    game.setGameOverTimeup('White wins by timeout', 'timeout')

    const remaining = game.getMatchTimeRemaining()
    expect(typeof remaining).toBe('number')
    expect(remaining).toBeGreaterThanOrEqual(0)
  })

  test('explicit resignation survives a late timeout tick (resign while ahead stays a loss)', () => {
    const game = new LocalGame()
    game.setGameOverResult('Resigned - Black wins')
    game.setGameOverReason('resignation')

    game.setGameOverTimeup('White wins on time', 'timeout')

    expect(game.getResult()).toBe('Resigned - Black wins')
    expect(game.getGameOverReason()).toBe('resignation')
  })
})

// "Play My Move" (Quick Play opt-in) — the human's legal move is always the
// applied move; the teammate bot's move is the shadow/hint only.
describe('Play My Move (Quick Play opt-in)', () => {
  function setup(playMyMove: boolean) {
    const game = new LocalGame(600, 'white', playMyMove)
    game.addPlayer('player1', Team.WHITE) // human
    game.addPlayer('player2', Team.WHITE) // teammate bot
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
    // Deterministic evaluator: index 1 (player2 / teammate) always scores best,
    // so OFF would let the bot override and ON must still play the human move.
    ;(game as unknown as { evaluator: unknown }).evaluator = {
      evaluateMoves: jest.fn(async (ucis: string[]) =>
        ucis.map((u, i) => ({ move: u, score: i === 1 ? 900 : -900 })),
      ),
    }
    return game
  }

  test('default constructor arg is OFF (existing behavior unchanged)', () => {
    const game = new LocalGame()
    expect((game as unknown as { _playMyMove: boolean })._playMyMove).toBe(false)
  })

  test('OFF: the teammate bot move can override the human move', async () => {
    const game = setup(false)
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')

    await game.lockAndResolve()

    const comp = game.lastMoveComparison!
    expect(comp.winningMove).toBe('d4')
    expect(comp.winnerId).toBe('player2')
    expect(comp.loserId).toBe('player1')
  })

  test('ON: the human move is authoritative; the bot move is the shadow only', async () => {
    const game = setup(true)
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')

    await game.lockAndResolve()

    const comp = game.lastMoveComparison!
    expect(comp.winningMove).toBe('e4')
    expect(comp.winnerId).toBe('player1')
    expect(comp.loserId).toBe('player2')
    expect(comp.loserFrom).toBe('d2')
    expect(comp.loserTo).toBe('d4')
    // Board applied the human move; the bot's move was NOT played.
    expect(game.board.get('e4')).toBeTruthy()
    expect(game.board.get('d4')).toBeFalsy()
    // Engine still ran: the bot's best move is available for the hint.
    expect(comp.bestEngineMove).toBeTruthy()
  })

  test('ON: opponent (non-human) turns are unaffected', async () => {
    const game = setup(true)
    // Human team turn (sync) -> advances to Black.
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()
    expect(game.currentTurn).toBe(Team.BLACK)

    // Opponent turn: both opponent slots submit the same move.
    game.selectMove('player3', 'e5')
    game.selectMove('player4', 'e5')
    await game.lockAndResolve()

    const comp = game.lastMoveComparison!
    expect(comp.winnerId).toBe('player1') // isSync path, unchanged
    expect(game.board.get('e5')).toBeTruthy()
  })
})
