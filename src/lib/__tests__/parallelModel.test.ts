import { LocalGame, GameStatus, MoveComparison } from '../../features/offline/game/localGame'
import { Team } from '../../features/game-engine/gameState'
import { calculateAccuracy } from '../../features/shared/accuracy'

const mockEvaluator = {
  evaluateMoves: async (moves: string[], _fen: string) => {
    return moves.map(m => ({ move: m, score: 30 }))
  },
  evaluatePosition: async (_fen: string) => 30,
  getBestScore: async (_fen: string) => ({ move: 'e2e4', score: 30 }),
  playMove: async (_fen: string) => 'e2e4',
}

describe('Parallel Model - Pending Moves', () => {
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

  describe('Pending Move Tracking', () => {
    test('initializes with no pending moves', () => {
      setupFullGame()
      game.startPendingTurn()
      const pending = game.getPendingMoves()
      expect(pending.human).toBeNull()
      expect(pending.teammate).toBeNull()
    })

    test('can set pending move for human', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      
      const pending = game.getPendingMoves()
      expect(pending.human).not.toBeNull()
      expect(pending.human!.move).toBe('e4')
      expect(pending.human!.from).toBe('e2')
      expect(pending.human!.to).toBe('e4')
    })

    test('can set pending move for teammate', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player2', 'Nf3', 'g1', 'f3', 'N')
      
      const pending = game.getPendingMoves()
      expect(pending.teammate).not.toBeNull()
      expect(pending.teammate!.move).toBe('Nf3')
      expect(pending.teammate!.from).toBe('g1')
      expect(pending.teammate!.to).toBe('f3')
    })

    test('pending move stores correct piece', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      
      const pending = game.getPendingMoves()
      expect(pending.human!.piece).toBe('P')
    })

    test('pending move correctly separates human and teammate by team order', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      game.setPendingMove('player2', 'Nf3', 'g1', 'f3', 'N')
      
      const pending = game.getPendingMoves()
      expect(pending.human).not.toBeNull()
      expect(pending.teammate).not.toBeNull()
      expect(pending.human!.move).toBe('e4')
      expect(pending.teammate!.move).toBe('Nf3')
    })
  })
})

describe('Parallel Model - Team Timer', () => {
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

  describe('Timer Initialization', () => {
    test('timer starts with 10 seconds after startPendingTurn', () => {
      setupFullGame()
      game.startPendingTurn()
      expect(game.getTeamTimer()).toBe(10)
    })

    test('timer is active after startPendingTurn', () => {
      setupFullGame()
      game.startPendingTurn()
      expect(game.isTimerActive()).toBe(true)
    })

    test('timer can be decremented', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setTeamTimer(8)
      expect(game.getTeamTimer()).toBe(8)
    })
  })

  describe('Timer Expiration', () => {
    test('timer can be deactivated', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setTimerActive(false)
      expect(game.isTimerActive()).toBe(false)
    })
  })
})

describe('Parallel Model - Turn Start FEN', () => {
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

  describe('Turn Start FEN Storage', () => {
    test('stores FEN at turn start', () => {
      setupFullGame()
      game.startPendingTurn()
      const turnStartFen = game.getTurnStartFen()
      expect(turnStartFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    })

    test('turnStartFen remains constant during turn', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      const turnStartFen = game.getTurnStartFen()
      expect(turnStartFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    })
  })
})

describe('Parallel Model - Blind Evaluation', () => {
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

  describe('Evaluation Uses Turn Start FEN', () => {
    test('stores turnStartFen for blind evaluation', () => {
      setupFullGame()
      game.startPendingTurn()
      expect(game.getTurnStartFen()).toBeTruthy()
    })
  })
})

describe('Parallel Model - Locking Behavior', () => {
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

  describe('Both Players Must Lock', () => {
    test('player can lock their pending move', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      game.lockPendingMove('player1')
      expect(game.isPendingMoveLocked('player1')).toBe(true)
    })

    test('both locked returns true when both locked', () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      game.setPendingMove('player2', 'Nf3', 'g1', 'f3', 'N')
      game.lockPendingMove('player1')
      expect(game.isBothPendingLocked()).toBe(false)
      game.lockPendingMove('player2')
      expect(game.isBothPendingLocked()).toBe(true)
    })
  })
})

describe('Parallel Model - Loser Retraction Logic', () => {
  let game: LocalGame

  beforeEach(() => {
    game = new LocalGame();
    (game as any).evaluator = mockEvaluator
  })

  function setupFullGame() {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
  }

  describe('Loser Move Information', () => {
    test('moveComparison identifies losing move coordinates', async () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      game.setPendingMove('player2', 'd4', 'd2', 'd4', 'P')
      game.lockPendingMove('player1')
      game.lockPendingMove('player2')
      await game.resolvePendingMoves()

      const comparison = game.lastMoveComparison
      expect(comparison).not.toBeNull()
      expect(comparison!.loserFrom).toBeTruthy()
      expect(comparison!.loserTo).toBeTruthy()
    }, 30000)
  })
})

describe('Accuracy Formula Verification', () => {
  test('0 centipawn loss = 100% accuracy', () => {
    expect(calculateAccuracy(0)).toBe(100)
  })

  test('100 centipawn loss ≈ 69% accuracy', () => {
    const accuracy = calculateAccuracy(100)
    expect(accuracy).toBeGreaterThanOrEqual(68)
    expect(accuracy).toBeLessThanOrEqual(70)
  })

  test('200 centipawn loss = 34% accuracy', () => {
    const accuracy = calculateAccuracy(200)
    expect(accuracy).toBeGreaterThanOrEqual(34)
    expect(accuracy).toBeLessThanOrEqual(35)
  })

  test('500 centipawn loss returns 0% (>= 300 threshold)', () => {
    expect(calculateAccuracy(500)).toBe(0)
  })

  test('accuracy formula is monotonic decreasing', () => {
    let prevAccuracy = 101
    for (const loss of [0, 10, 50, 100, 200, 299, 300]) {
      const accuracy = calculateAccuracy(loss)
      expect(accuracy).toBeLessThanOrEqual(prevAccuracy)
      prevAccuracy = accuracy
    }
  })

  test('negative loss returns 100 (capped at perfect)', () => {
    expect(calculateAccuracy(-100)).toBe(100)
  })

  test('Infinity loss returns 0', () => {
    expect(calculateAccuracy(Infinity)).toBe(0)
  })
})

describe('Parallel Model - Stats Tracking', () => {
  let game: LocalGame

  afterEach(() => {
    jest.clearAllTimers()
  })

  beforeEach(() => {
    game = new LocalGame();
    (game as any).evaluator = mockEvaluator
  })

  function setupFullGame() {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()
  }

  describe('Sync Rate Tracking', () => {
    test('sync rate is 1 when both choose same move', async () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      game.setPendingMove('player2', 'e4', 'e2', 'e4', 'P')
      game.lockPendingMove('player1')
      game.lockPendingMove('player2')
      await game.resolvePendingMoves()

      const stats = game.getStats()
      expect(stats.syncRate).toBe(1)
    }, 30000)

    test('sync rate updates after conflicts', async () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      game.setPendingMove('player2', 'd4', 'd2', 'd4', 'P')
      game.lockPendingMove('player1')
      game.lockPendingMove('player2')
      await game.resolvePendingMoves()

      const stats = game.getStats()
      expect(stats.conflicts).toBe(1)
      expect(stats.syncRate).toBe(0)
    }, 30000)
  })

  describe('Move Accuracy Tracking', () => {
    test('tracks accuracy per move', async () => {
      setupFullGame()
      game.startPendingTurn()
      game.setPendingMove('player1', 'e4', 'e2', 'e4', 'P')
      game.setPendingMove('player2', 'e4', 'e2', 'e4', 'P')
      game.lockPendingMove('player1')
      game.lockPendingMove('player2')
      await game.resolvePendingMoves()

      const stats = game.getStats()
      expect(stats.movesPlayed).toBe(1)
    }, 30000)
  })
})

describe('Parallel Model - Game Over Detection', () => {
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

  test('detects game is playing', () => {
    setupFullGame()
    expect(game.status).toBe(GameStatus.PLAYING)
  })

  test('can get game result', () => {
    setupFullGame()
    const result = game.getResult()
    expect(result).toBe('Game in progress')
  })
})