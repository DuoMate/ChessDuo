import { GameState, GamePhase, Team } from '../gameState'
import { LocalGame, GameStatus } from '../localGame'

function uciToSan(uciMove: string, fen: string): string | null {
  try {
    const { Chess } = require('chess.js')
    const [from, to] = uciMove.split('-')
    const chess = new Chess(fen)
    const moves = chess.moves({ verbose: true })
    
    for (const move of moves) {
      if (move.from === from && move.to === to) {
        return move.san
      }
    }
  } catch (e) {
    console.warn('Error converting UCI to SAN:', e)
  }
  return null
}

describe('Game State Machine', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState()
  })

  describe('Initial State', () => {
    test('starts in WAITING phase', () => {
      expect(gameState.phase).toBe(GamePhase.WAITING)
    })

    test('has white team turn initially', () => {
      expect(gameState.currentTeam).toBe(Team.WHITE)
    })

    test('has no players initially', () => {
      expect(gameState.getPlayers(Team.WHITE)).toHaveLength(0)
      expect(gameState.getPlayers(Team.BLACK)).toHaveLength(0)
    })

    test('starts with initial chess position', () => {
      const fen = gameState.fen
      expect(fen).toContain('rnbqkbnr')
      expect(fen).toContain('PPPPPPPP')
      expect(fen).toContain('8/8/8/8')
    })

    test('has no captured pieces initially', () => {
      const captured = gameState.capturedPieces
      expect(captured.white).toEqual([])
      expect(captured.black).toEqual([])
    })
  })

  describe('Player Management', () => {
    test('adds player to white team', () => {
      gameState.addPlayer('player1', Team.WHITE)
      expect(gameState.getPlayers(Team.WHITE)).toContain('player1')
    })

    test('adds player to black team', () => {
      gameState.addPlayer('player2', Team.BLACK)
      expect(gameState.getPlayers(Team.BLACK)).toContain('player2')
    })

    test('prevents adding more than 2 players per team', () => {
      gameState.addPlayer('p1', Team.WHITE)
      gameState.addPlayer('p2', Team.WHITE)
      expect(() => gameState.addPlayer('p3', Team.WHITE)).toThrow('Team WHITE already has 2 players')
    })
  })

  describe('Phase Transitions', () => {
    test('transitions from WAITING to SELECTING when both teams have 2 players', () => {
      gameState.addPlayer('w1', Team.WHITE)
      gameState.addPlayer('w2', Team.WHITE)
      gameState.addPlayer('b1', Team.BLACK)
      gameState.addPlayer('b2', Team.BLACK)
      
      gameState.startMatch()
      
      expect(gameState.phase).toBe(GamePhase.SELECTING)
    })

    test('throws error when starting match with incomplete teams', () => {
      gameState.addPlayer('w1', Team.WHITE)
      gameState.addPlayer('w2', Team.WHITE)
      
      expect(() => gameState.startMatch()).toThrow()
    })

    test('transitions to LOCKED when both players lock in moves', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      gameState.selectMove('w2', 'e4')
      gameState.lockMove('w1')
      gameState.lockMove('w2')
      
      expect(gameState.phase).toBe(GamePhase.LOCKED)
    })
  })

  describe('Move Selection', () => {
    test('allows player to select a move', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      
      expect(gameState.getSelectedMove('w1')).toBe('e4')
    })

    test('allows player to change selection before locking', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      gameState.selectMove('w1', 'd4')
      
      expect(gameState.getSelectedMove('w1')).toBe('d4')
    })

    test('does not reveal move to other player until locked', () => {
      setupFullGame()
      gameState.selectMove('w1', 'e4')
      
      expect(gameState.getSelectedMove('w2')).toBeNull()
    })

    test('allows move selection for current team only', () => {
      setupFullGame()
      expect(() => gameState.selectMove('b1', 'e5')).toThrow()
    })
  })

  describe('Turn Management', () => {
    test('switches teams after resolution', () => {
      setupFullGame()
      completeTurn(gameState, 'w1', 'w2', 'e4', 'd4')
      
      expect(gameState.currentTeam).toBe(Team.BLACK)
    })

    test('updates board state after move', () => {
      setupFullGame()
      const initialFen = gameState.fen
      
      completeTurn(gameState, 'w1', 'w2', 'e4', 'e4')
      
      expect(gameState.fen).not.toBe(initialFen)
    })
  })

  describe('Captured Pieces Tracking', () => {
    test('tracks captured pieces after pawn capture', async () => {
      const game = new LocalGame()
      game.addPlayer('w1', Team.WHITE)
      game.addPlayer('w2', Team.WHITE)
      game.addPlayer('b1', Team.BLACK)
      game.addPlayer('b2', Team.BLACK)
      game.start()
      
      game.selectMove('w1', 'e4')
      game.selectMove('w2', 'e4')
      await game.lockAndResolve()
      
      game.selectMove('b1', 'e5')
      game.selectMove('b2', 'e5')
      await game.lockAndResolve()
      
      game.selectMove('w1', 'd4')
      game.selectMove('w2', 'd4')
      await game.lockAndResolve()
      
      game.selectMove('b1', 'exd4')
      game.selectMove('b2', 'exd4')
      await game.lockAndResolve()
      
      const captured = game.getCapturedPieces()
      expect(captured.black).toContain('p')
    })

    test('returns independent copy of captured pieces', () => {
      const captured1 = gameState.capturedPieces
      const captured2 = gameState.capturedPieces
      
      expect(captured1).not.toBe(captured2)
      expect(captured1.white).not.toBe(captured2.white)
      expect(captured1.black).not.toBe(captured2.black)
    })
  })

  function setupFullGame() {
    gameState.addPlayer('w1', Team.WHITE)
    gameState.addPlayer('w2', Team.WHITE)
    gameState.addPlayer('b1', Team.BLACK)
    gameState.addPlayer('b2', Team.BLACK)
    gameState.startMatch()
  }

  function completeTurn(
    state: GameState,
    p1: string,
    p2: string,
    m1: string,
    m2: string
  ) {
    state.selectMove(p1, m1)
    state.selectMove(p2, m2)
    state.lockMove(p1)
    state.lockMove(p2)
    state.resolve()
  }
})

describe('LocalGame Integration', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
  })

  function setupFullGame() {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
  }

  describe('Game Lifecycle', () => {
    test('starts in WAITING status', () => {
      expect(game.status).toBe(GameStatus.WAITING)
    })

    test('transitions to READY when all players join', () => {
      game.addPlayer('player1', Team.WHITE)
      game.addPlayer('player2', Team.WHITE)
      expect(game.status).toBe(GameStatus.WAITING)
      
      game.addPlayer('player3', Team.BLACK)
      expect(game.status).toBe(GameStatus.WAITING)
      
      game.addPlayer('player4', Team.BLACK)
      expect(game.status).toBe(GameStatus.READY)
    })

    test('transitions to PLAYING after start', () => {
      setupFullGame()
      expect(game.status).toBe(GameStatus.PLAYING)
    })
  })

  describe('Move Execution', () => {
    test('executes moves and updates board', async () => {
      setupFullGame()
      const initialFen = game.board.fen()
      
      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()
      
      const newFen = game.board.fen()
      expect(newFen).not.toBe(initialFen)
      expect(newFen).toContain('4P3')
    })

    test('alternates turns after each move', async () => {
      setupFullGame()
      expect(game.currentTurn).toBe(Team.WHITE)
      
      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()
      
      expect(game.currentTurn).toBe(Team.BLACK)
      
      game.selectMove('player3', 'e5')
      game.selectMove('player4', 'e5')
      await game.lockAndResolve()
      
      expect(game.currentTurn).toBe(Team.WHITE)
    })

    test('tracks selected moves for players', () => {
      setupFullGame()
      game.selectMove('player1', 'd4')
      expect(game.getSelectedMove('player1')).toBe('d4')
      expect(game.getSelectedMove('player2')).toBeNull()
    })
  })

  describe('Captured Pieces Integration', () => {
    test('returns empty captured pieces initially', () => {
      setupFullGame()
      const captured = game.getCapturedPieces()
      expect(captured.white).toEqual([])
      expect(captured.black).toEqual([])
    })

    test('returns independent copy of captured pieces', () => {
      setupFullGame()
      const captured1 = game.getCapturedPieces()
      const captured2 = game.getCapturedPieces()
      
      expect(captured1).not.toBe(captured2)
      captured1.white.push('test')
      expect(captured2.white).toEqual([])
    })
  })

  describe('Stats Tracking', () => {
    test('tracks moves played', async () => {
      setupFullGame()
      expect(game.getStats().movesPlayed).toBe(0)
      
      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()
      
      expect(game.getStats().movesPlayed).toBe(1)
    })

    test('tracks conflicts when moves differ', async () => {
      setupFullGame()
      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'd4')
      await game.lockAndResolve()
      
      expect(game.getStats().conflicts).toBe(1)
    })

    test('tracks sync rate correctly', async () => {
      setupFullGame()
      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()
      
      expect(game.getStats().syncRate).toBe(1)
    })
  })
})

describe('UCI to SAN Conversion', () => {
  test('converts e2-e4 correctly', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = uciToSan('e2-e4', fen)
    expect(result).toBe('e4')
  })

  test('converts g1-f3 correctly', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = uciToSan('g1-f3', fen)
    expect(result).toBe('Nf3')
  })

  test('returns null for invalid UCI format', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = uciToSan('invalid', fen)
    expect(result).toBeNull()
  })

  test('returns null for move not in position', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const result = uciToSan('h7-h8', fen)
    expect(result).toBeNull()
  })
})
