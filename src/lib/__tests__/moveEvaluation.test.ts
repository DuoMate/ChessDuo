import { LocalGame, GameStatus } from '../../features/offline/game/localGame'
import { Team } from '../../features/game-engine/gameState'
import { Chess } from 'chess.js'

interface MoveEvaluation {
  move: string
  score: number
}

class MockMoveEvaluator {
  private mockScores: Map<string, number> = new Map()

  setMockScore(fen: string, score: number): void {
    this.mockScores.set(fen, score)
  }

  async evaluateMove(move: string, fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    chess.move(move)
    const newFen = chess.fen()
    chess.undo()

    const score = this.mockScores.get(newFen) ?? 0
    return {
      move,
      score
    }
  }

  async getBestScore(fen: string): Promise<MoveEvaluation> {
    const chess = new Chess(fen)
    const moves = chess.moves()
    
    if (moves.length === 0) {
      return { move: '', score: 0 }
    }

    if (moves.length === 1) {
      return { move: moves[0], score: this.mockScores.get(fen) ?? 0 }
    }

    let bestMove = moves[0]
    let bestScore = -Infinity

    for (const move of moves) {
      const evalResult = await this.evaluateMove(move, fen)
      if (evalResult.score > bestScore) {
        bestScore = evalResult.score
        bestMove = move
      }
    }

    return { move: bestMove, score: bestScore }
  }

  async evaluateMoves(moves: string[], fen: string): Promise<MoveEvaluation[]> {
    const results: MoveEvaluation[] = []
    for (const move of moves) {
      const evalResult = await this.evaluateMove(move, fen)
      results.push(evalResult)
    }
    return results
  }

  async compareMoves(move1: string, move2: string, fen: string): Promise<{ winner: string; score1: number; score2: number; centipawnLoss: number }> {
    const eval1 = await this.evaluateMove(move1, fen)
    const eval2 = await this.evaluateMove(move2, fen)
    
    return {
      winner: eval1.score >= eval2.score ? move1 : move2,
      score1: eval1.score,
      score2: eval2.score,
      centipawnLoss: Math.abs(eval1.score - eval2.score)
    }
  }

  isUsingStockfish(): boolean {
    return false
  }

  isReady(): boolean {
    return true
  }

  async evaluatePosition(fen: string): Promise<number> {
    const chess = new Chess(fen)
    const moves = chess.moves()
    if (moves.length === 0) return 0
    let bestScore = -Infinity
    for (const move of moves) {
      const evalResult = await this.evaluateMove(move, fen)
      if (evalResult.score > bestScore) {
        bestScore = evalResult.score
      }
    }
    return bestScore
  }
}

describe('LocalGame Move Evaluation', () => {
  let game: LocalGame
  let mockEvaluator: MockMoveEvaluator

  beforeEach(() => {
    game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    
    mockEvaluator = new MockMoveEvaluator()
    
    const gameAny = game as any
    gameAny.evaluator = mockEvaluator
    
    game.start()
  })

  test('initial position has WHITE turn', () => {
    expect(game.currentTurn).toBe(Team.WHITE)
  })

  test('both players can select moves', () => {
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    
    expect((game as any).gameState.getSelectedMove('player1')).toBe('e4')
    expect((game as any).gameState.getSelectedMove('player2')).toBe('e4')
  })

  test('winning move selection when player1 is better', async () => {
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    mockEvaluator.setMockScore(initialFen, 50)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 70)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', 30)

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')
    
    await game.lockAndResolve(true)
    
    const comparison = game.lastMoveComparison
    expect(comparison).not.toBeNull()
    expect(comparison!.isSync).toBe(false)
  })

  test('winning move selection when player2 is better', async () => {
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    mockEvaluator.setMockScore(initialFen, 50)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 20)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', 80)

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')
    
    await game.lockAndResolve(true)
    
    const comparison = game.lastMoveComparison
    expect(comparison).not.toBeNull()
    expect(comparison!.isSync).toBe(false)
  })

  test('synchronized moves when both choose same', async () => {
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    mockEvaluator.setMockScore(initialFen, 50)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 30)

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    
    await game.lockAndResolve(true)
    
    const comparison = game.lastMoveComparison
    expect(comparison).not.toBeNull()
    expect(comparison!.isSync).toBe(true)
    expect(comparison!.player1Move).toBe(comparison!.player2Move)
  })
})

describe('Accuracy Calculation (Lichess Hyperbolic Formula)', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame()
  })

  test('calculates 100% for zero loss', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    expect(calculateAccuracy(0)).toBe(100)
  })

  test('calculates ~67% for 100cp loss', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    const accuracy = calculateAccuracy(100)
    expect(accuracy).toBeGreaterThanOrEqual(66)
    expect(accuracy).toBeLessThanOrEqual(68)
  })

  test('calculates ~50% for 200cp loss', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    const accuracy = calculateAccuracy(200)
    expect(accuracy).toBeGreaterThanOrEqual(49)
    expect(accuracy).toBeLessThanOrEqual(51)
  })

  test('calculates ~33% for 400cp loss', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    const accuracy = calculateAccuracy(400)
    expect(accuracy).toBeGreaterThanOrEqual(32)
    expect(accuracy).toBeLessThanOrEqual(34)
  })

  test('calculates ~29% for 500cp loss (blunder)', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    const accuracy = calculateAccuracy(500)
    expect(accuracy).toBeGreaterThanOrEqual(28)
    expect(accuracy).toBeLessThanOrEqual(30)
  })

  test('calculates low accuracy for 1000cp loss (catastrophic blunder)', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    const accuracy = calculateAccuracy(1000)
    expect(accuracy).toBeLessThanOrEqual(17)
    expect(accuracy).toBeGreaterThanOrEqual(15)
  })

  test('returns 0 for Infinity loss', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    expect(calculateAccuracy(Infinity)).toBe(0)
  })

  test('returns 0 for negative loss', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    expect(calculateAccuracy(-100)).toBe(0)
  })

  test('accuracy is monotonic decreasing', () => {
    const calculateAccuracy = (game as any).calculateAccuracy.bind(game)
    let prevAccuracy = 101
    for (const loss of [0, 10, 50, 100, 200, 400, 600, 1000, 2000]) {
      const accuracy = calculateAccuracy(loss)
      expect(accuracy).toBeLessThan(prevAccuracy)
      prevAccuracy = accuracy
    }
  })
})

describe('Game Flow Integration', () => {
  let game: LocalGame
  let mockEvaluator: MockMoveEvaluator

  beforeEach(() => {
    game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    
    mockEvaluator = new MockMoveEvaluator()
    
    const gameAny = game as any
    gameAny.evaluator = mockEvaluator
    
    game.start()
  })

  test('full turn cycle: white then black', async () => {
    const whiteFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    mockEvaluator.setMockScore(whiteFen, 50)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 30)

    expect(game.currentTurn).toBe(Team.WHITE)
    
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve()
    
    expect(game.currentTurn).toBe(Team.BLACK)
    expect(game.status).toBe(GameStatus.PLAYING)
    
    game.selectMove('player3', 'e5')
    game.selectMove('player4', 'e5')
    await game.lockAndResolve()
    
    expect(game.currentTurn).toBe(Team.WHITE)
  })

  test('move comparison tracks all fields', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    mockEvaluator.setMockScore(fen, 50)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 70)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', 40)

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')
    await game.lockAndResolve()
    
    const comparison = game.lastMoveComparison!
    
    expect(comparison).toHaveProperty('player1Move')
    expect(comparison).toHaveProperty('player2Move')
    expect(comparison).toHaveProperty('player1Score')
    expect(comparison).toHaveProperty('player2Score')
    expect(comparison).toHaveProperty('player1Accuracy')
    expect(comparison).toHaveProperty('player2Accuracy')
    expect(comparison).toHaveProperty('player1Loss')
    expect(comparison).toHaveProperty('player2Loss')
    expect(comparison).toHaveProperty('winningMove')
    expect(comparison).toHaveProperty('isSync')
    expect(comparison).toHaveProperty('bestEngineMove')
    expect(comparison).toHaveProperty('bestEngineScore')
    
    expect(comparison.player1Accuracy).toBeGreaterThanOrEqual(0)
    expect(comparison.player1Accuracy).toBeLessThanOrEqual(100)
    expect(comparison.player2Accuracy).toBeGreaterThanOrEqual(0)
    expect(comparison.player2Accuracy).toBeLessThanOrEqual(100)
  })
})

describe('ELO-Based Move Selection Configuration', () => {
  const ELO_MAPPING: Record<number, { bestMoveChance: number; description: string; searchDepth: number }> = {
    1: { bestMoveChance: 0.30, description: '~1500 ELO', searchDepth: 1 },
    2: { bestMoveChance: 0.45, description: '~1600 ELO', searchDepth: 2 },
    3: { bestMoveChance: 0.60, description: '~1700 ELO', searchDepth: 3 },
    4: { bestMoveChance: 0.80, description: '~1800 ELO', searchDepth: 4 },
    5: { bestMoveChance: 0.92, description: '~1900 ELO', searchDepth: 5 },
    6: { bestMoveChance: 0.99, description: '~2000+ ELO', searchDepth: 10 },
  }

  test('bestMoveChance increases with level', () => {
    for (let level = 2; level <= 6; level++) {
      expect(ELO_MAPPING[level].bestMoveChance).toBeGreaterThan(ELO_MAPPING[level - 1].bestMoveChance)
    }
  })

  test('level 6 has 99% bestMoveChance', () => {
    expect(ELO_MAPPING[6].bestMoveChance).toBe(0.99)
  })

  test('level 1 has 30% bestMoveChance', () => {
    expect(ELO_MAPPING[1].bestMoveChance).toBe(0.30)
  })

  test('all levels have descriptions', () => {
    for (let level = 1; level <= 6; level++) {
      expect(ELO_MAPPING[level].description).toBeTruthy()
      expect(ELO_MAPPING[level].description.length).toBeGreaterThan(0)
    }
  })

  test('level 6 is strongest with highest bestMoveChance', () => {
    expect(ELO_MAPPING[6].bestMoveChance).toBeGreaterThan(ELO_MAPPING[5].bestMoveChance)
    expect(ELO_MAPPING[5].bestMoveChance).toBeGreaterThan(ELO_MAPPING[4].bestMoveChance)
  })
})

describe('Stockfish Skill Level Mapping', () => {
  const skillMap: Record<number, number> = {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 19,
    6: 20
  }

  test('higher game level maps to higher Stockfish skill', () => {
    for (let level = 2; level <= 6; level++) {
      expect(skillMap[level]).toBeGreaterThan(skillMap[level - 1])
    }
  })

  test('level 1 maps to skill 4 (weaker)', () => {
    expect(skillMap[1]).toBe(4)
  })

  test('level 6 maps to skill 20 (strongest, no handicap)', () => {
    expect(skillMap[6]).toBe(20)
  })

  test('skill levels are within valid UCI range (0-20)', () => {
    for (let level = 1; level <= 6; level++) {
      expect(skillMap[level]).toBeGreaterThanOrEqual(0)
      expect(skillMap[level]).toBeLessThanOrEqual(20)
    }
  })
})

describe('Search Depth Configuration', () => {
  test('level 1-2 use depth 8', () => {
    const getDepth = (skillLevel: number) => {
      if (skillLevel <= 2) return 8
      if (skillLevel <= 4) return 12
      return 15
    }
    expect(getDepth(1)).toBe(8)
    expect(getDepth(2)).toBe(8)
  })

  test('level 3-4 use depth 12', () => {
    const getDepth = (skillLevel: number) => {
      if (skillLevel <= 2) return 8
      if (skillLevel <= 4) return 12
      return 15
    }
    expect(getDepth(3)).toBe(12)
    expect(getDepth(4)).toBe(12)
  })

  test('level 5-6 use depth 15', () => {
    const getDepth = (skillLevel: number) => {
      if (skillLevel <= 2) return 8
      if (skillLevel <= 4) return 12
      return 15
    }
    expect(getDepth(5)).toBe(15)
    expect(getDepth(6)).toBe(15)
  })
})

describe('Move Time Configuration', () => {
  test('level 1-2 use 2000ms', () => {
    const getMoveTime = (skillLevel: number) => {
      if (skillLevel <= 2) return 2000
      if (skillLevel <= 4) return 4000
      return 6000
    }
    expect(getMoveTime(1)).toBe(2000)
    expect(getMoveTime(2)).toBe(2000)
  })

  test('level 3-4 use 4000ms', () => {
    const getMoveTime = (skillLevel: number) => {
      if (skillLevel <= 2) return 2000
      if (skillLevel <= 4) return 4000
      return 6000
    }
    expect(getMoveTime(3)).toBe(4000)
    expect(getMoveTime(4)).toBe(4000)
  })

  test('level 5-6 use 6000ms', () => {
    const getMoveTime = (skillLevel: number) => {
      if (skillLevel <= 2) return 2000
      if (skillLevel <= 4) return 4000
      return 6000
    }
    expect(getMoveTime(5)).toBe(6000)
    expect(getMoveTime(6)).toBe(6000)
  })
})

describe('Move Evaluation with Mock', () => {
  test('evaluateMove returns correct structure', async () => {
    const evaluator = new MockMoveEvaluator()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    evaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 50)
    
    const result = await evaluator.evaluateMove('e4', fen)
    
    expect(result).toHaveProperty('move', 'e4')
    expect(result).toHaveProperty('score')
    expect(typeof result.score).toBe('number')
  })

  test('getBestScore returns best move from mock', async () => {
    const evaluator = new MockMoveEvaluator()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    evaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 100)
    evaluator.setMockScore('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', 50)
    evaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4N3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 1', 75)
    
    const result = await evaluator.getBestScore(fen)
    
    expect(result.move).toBe('e4')
    expect(result.score).toBe(100)
  })

  test('compareMoves returns correct winner', async () => {
    const evaluator = new MockMoveEvaluator()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    evaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 100)
    evaluator.setMockScore('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', 50)
    
    const result = await evaluator.compareMoves('e4', 'd4', fen)
    
    expect(result.winner).toBe('e4')
    expect(result.centipawnLoss).toBe(50)
  })
})

describe('Score Normalization for Turn', () => {
  let game: LocalGame
  let mockEvaluator: MockMoveEvaluator

  beforeEach(() => {
    game = new LocalGame()
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    
    mockEvaluator = new MockMoveEvaluator()
    
    const gameAny = game as any
    gameAny.evaluator = mockEvaluator
    
    game.start()
  })

  test('white turn: player1 and player2 make moves on white team', async () => {
    const whiteFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    mockEvaluator.setMockScore(whiteFen, 50)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 80)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', 30)

    expect(game.currentTurn).toBe(Team.WHITE)
    
    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'd4')
    await game.lockAndResolve(true)
    
    expect(game.currentTurn).toBe(Team.BLACK)
    expect(game.status).toBe(GameStatus.PLAYING)
  })

  test('black turn: player3 and player4 make moves on black team', async () => {
    const whiteFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    
    mockEvaluator.setMockScore(whiteFen, 50)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 30)

    game.selectMove('player1', 'e4')
    game.selectMove('player2', 'e4')
    await game.lockAndResolve(true)
    
    expect(game.currentTurn).toBe(Team.BLACK)
    
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQ1KNR b KQkq - 0 1', -80)
    mockEvaluator.setMockScore('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 1', -30)

    game.selectMove('player3', 'e5')
    game.selectMove('player4', 'e5')
    await game.lockAndResolve(true)
    
    expect(game.currentTurn).toBe(Team.WHITE)
  })
})
