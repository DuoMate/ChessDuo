import { Chess } from 'chess.js'
import { GameState, Team } from '../gameState'
import { LocalGame, GameStatus } from '../localGame'

function createTestGame(): LocalGame {
  const game = new LocalGame()
  game.addPlayer('player1', Team.WHITE)
  game.addPlayer('player2', Team.WHITE)
  game.addPlayer('player3', Team.BLACK)
  game.addPlayer('player4', Team.BLACK)
  game.start()
  return game
}

describe('Move Validation', () => {
  let chess: Chess

  beforeEach(() => {
    chess = new Chess()
  })

  describe('Basic Chess Move Validation', () => {
    test('accepts legal pawn move', () => {
      const result = chess.move('e4')
      expect(result).not.toBeNull()
      expect(chess.turn()).toBe('b')
    })

    test('accepts legal knight move', () => {
      const result = chess.move('Nf3')
      expect(result).not.toBeNull()
      expect(chess.turn()).toBe('b')
    })

    test('accepts legal bishop move', () => {
      chess.move('e4')
      const result = chess.move('e5')
      expect(result).not.toBeNull()
      const bishopResult = chess.move('Bc4')
      expect(bishopResult).not.toBeNull()
    })

    test('rejects moving to occupied square by own piece', () => {
      chess.move('e4')
      expect(() => chess.move('Na3')).toThrow()
    })

    test('rejects moving to square occupied by own piece', () => {
      expect(() => chess.move('e1')).toThrow()
    })

    test('accepts valid capture', () => {
      chess.move('e4')
      chess.move('e5')
      chess.move('d4')
      const result = chess.move('exd4')
      expect(result).not.toBeNull()
      expect(result?.captured).toBe('p')
    })
  })

  describe('Move Format Validation', () => {
    test('validates UCI format moves', () => {
      const moves = chess.moves({ verbose: true })
      const e4Move = moves.find(m => m.san === 'e4')
      expect(e4Move).toBeDefined()
      expect(e4Move?.from).toBe('e2')
      expect(e4Move?.to).toBe('e4')
    })

    test('finds valid move from specific square', () => {
      const moves = chess.moves({ square: 'g1', verbose: true })
      expect(moves.some(m => m.to === 'f3')).toBe(true)
      expect(moves.some(m => m.to === 'h3')).toBe(true)
    })

    test('returns empty moves for blocked piece', () => {
      chess.move('d4')
      const moves = chess.moves({ square: 'd1', verbose: true })
      expect(moves.length).toBe(0)
    })
  })

  describe('Special Moves', () => {
    test('handles castling kingside', () => {
      chess.move('e4')
      chess.move('e5')
      chess.move('Nf3')
      chess.move('Nc6')
      chess.move('Bc4')
      chess.move('Bc5')
      const result = chess.move('O-O')
      expect(result).not.toBeNull()
      expect(chess.fen()).toContain('K')
    })

    test('handles en passant capture', () => {
      chess.move('e4')
      chess.move('a6')
      chess.move('e5')
      chess.move('d5')
      const result = chess.move('exd6')
      expect(result).not.toBeNull()
      expect(result?.captured).toBe('p')
    })
  })

  describe('Check and Checkmate', () => {
    test('detects checkmate - scholar\'s mate', () => {
      chess.move('e4')
      chess.move('e5')
      chess.move('Qh5')
      chess.move('Nc6')
      chess.move('Bc4')
      chess.move('Nf6')
      const result = chess.move('Qxf7#')
      expect(result).not.toBeNull()
      expect(chess.isCheckmate()).toBe(true)
    })
  })
})

describe('GameState Move Selection', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState()
    gameState.addPlayer('player1', Team.WHITE)
    gameState.addPlayer('player2', Team.WHITE)
    gameState.addPlayer('player3', Team.BLACK)
    gameState.addPlayer('player4', Team.BLACK)
    gameState.startMatch()
  })

  test('allows move selection for current team', () => {
    expect(() => gameState.selectMove('player1', 'e4')).not.toThrow()
    expect(gameState.getSelectedMove('player1')).toBe('e4')
  })

  test('rejects move selection for opposite team', () => {
    expect(() => gameState.selectMove('player3', 'e5')).toThrow()
  })

  test('rejects move selection after phase changes', () => {
    gameState.selectMove('player1', 'e4')
    gameState.selectMove('player2', 'e4')
    gameState.lockMove('player1')
    gameState.lockMove('player2')
    gameState.resolve()
    
    expect(gameState.currentTeam).toBe(Team.BLACK)
    expect(() => gameState.selectMove('player1', 'e4')).toThrow()
  })
})

describe('Captured Pieces Tracking', () => {
  test('starts with empty captured pieces', () => {
    const game = createTestGame()
    expect(game.getCapturedPieces().white).toEqual([])
    expect(game.getCapturedPieces().black).toEqual([])
  })

  test('tracks pawn capture', async () => {
    const game = createTestGame()
    
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()
    
    game.selectMove('player3', 'e5')
    game.selectMove('player4', 'e5')
    await game.lockAndResolve()
    
    game.selectMove('player1', 'd4')
    game.selectMove('player2', 'd4')
    await game.lockAndResolve()
    
    game.selectMove('player3', 'exd4')
    game.selectMove('player4', 'exd4')
    await game.lockAndResolve()
    
    const captured = game.getCapturedPieces()
    expect(captured.black).toContain('p')
  })

  test('captured pieces array is independent copy', () => {
    const game = createTestGame()
    const captured1 = game.getCapturedPieces()
    const captured2 = game.getCapturedPieces()
    
    expect(captured1).not.toBe(captured2)
    expect(captured1.white).not.toBe(captured2.white)
    expect(captured1.black).not.toBe(captured2.black)
  })
})

describe('LocalGame Integration', () => {
  test('game starts in PLAYING status after start', () => {
    const game = createTestGame()
    expect(game.status).toBe(GameStatus.PLAYING)
  })

  test('game correctly alternates turns', async () => {
    const game = createTestGame()
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

  test('handles sequential moves correctly', async () => {
    const game = createTestGame()
    
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()
    
    expect(game.board.fen()).toContain('4P3')
  })
})
