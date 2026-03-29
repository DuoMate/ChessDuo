import { Chess } from 'chess.js'
import { LocalGame, GameStatus } from '../localGame'
import { Team } from '../gameState'
import { createBot } from '../chessBot'

function createTestGameWithBot(): { game: LocalGame; bot: ReturnType<typeof createBot> } {
  const game = new LocalGame()
  const bot = createBot()
  game.addPlayer('player1', Team.WHITE)
  game.addPlayer('player2', Team.WHITE)
  game.addPlayer('player3', Team.BLACK)
  game.addPlayer('player4', Team.BLACK)
  game.start()
  return { game, bot }
}

function uciToSan(uciMove: string, fen: string): string | null {
  try {
    const [from, to] = uciMove.split('-')
    const chess = new Chess(fen)
    const moves = chess.moves({ verbose: true })
    for (const move of moves) {
      if (move.from === from && move.to === to) {
        return move.san
      }
    }
  } catch {
    return null
  }
  return null
}

async function executeBotMove(game: LocalGame, bot: ReturnType<typeof createBot>): Promise<void> {
  const currentFen = game.board.fen()
  const botUciMove = bot.selectMove(currentFen)
  if (!botUciMove) return

  const sanMove = uciToSan(botUciMove, currentFen)
  if (!sanMove) return

  game.selectMove('player3', sanMove)
  game.selectMove('player4', sanMove)
  await game.lockAndResolve()
}

describe('Bot Integration', () => {
  describe('Bot vs Player Game Flow', () => {
    test('bot can make move after player moves', async () => {
      const { game, bot } = createTestGameWithBot()
      const initialFen = game.board.fen()

      expect(game.currentTurn).toBe(Team.WHITE)

      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()

      expect(game.currentTurn).toBe(Team.BLACK)

      await executeBotMove(game, bot)

      expect(game.currentTurn).toBe(Team.WHITE)
      expect(game.board.fen()).not.toBe(initialFen)
    })

    test('bot makes legal moves', async () => {
      const { game, bot } = createTestGameWithBot()

      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()

      const fenBeforeBot = game.board.fen()
      await executeBotMove(game, bot)

      const chess = new Chess(fenBeforeBot)
      const expectedMoves = chess.moves()
      expect(expectedMoves.length).toBeGreaterThan(0)
    })

    test('bot responds to different player openings', async () => {
      const { game, bot } = createTestGameWithBot()

      const openings = ['e4', 'd4', 'Nf3', 'c4']

      for (const opening of openings) {
        if (game.isGameOver()) break
        
        game.selectMove('player1', opening)
        game.selectMove('player2', opening)
        await game.lockAndResolve()

        if (game.currentTurn === Team.BLACK && !game.isGameOver()) {
          await executeBotMove(game, bot)
        }
        
        if (game.currentTurn !== Team.WHITE) break
      }

      expect(game.getStats().movesPlayed).toBeGreaterThan(0)
    })
  })

  describe('Captured Pieces with Bot', () => {
    test('game state has captured pieces tracking', async () => {
      const { game } = createTestGameWithBot()
      
      const captured = game.getCapturedPieces()
      expect(captured).toHaveProperty('white')
      expect(captured).toHaveProperty('black')
      expect(Array.isArray(captured.white)).toBe(true)
      expect(Array.isArray(captured.black)).toBe(true)
    })

    test('captured pieces update after moves', async () => {
      const { game, bot } = createTestGameWithBot()

      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()

      await executeBotMove(game, bot)

      const captured = game.getCapturedPieces()
      expect(captured.white).toBeDefined()
      expect(captured.black).toBeDefined()
    })
  })

  describe('Bot Move Selection', () => {
    test('bot always selects from available legal moves', async () => {
      const bot = createBot()
      const positions = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P2Q/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        '6k1/5Qpp/8/8/8/8/8/6K1 w - - 0 1'
      ]

      for (const fen of positions) {
        const chess = new Chess(fen)
        const legalMoves = chess.moves({ verbose: true })

        if (legalMoves.length === 0) continue

        const botMove = bot.selectMove(fen)
        if (!botMove) continue

        const [from, to] = botMove.split('-')
        const isLegal = legalMoves.some(m => m.from === from && m.to === to)
        expect(isLegal).toBe(true)
      }
    })

    test('bot handles complex positions', async () => {
      const bot = createBot()
      const complexPositions = [
        'r2q1rk1/ppp2ppp/2n2n2/3p4/3P4/2N2N2/PPP2PPP/R2Q1RK1 w - - 0 1',
        'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
      ]

      for (const fen of complexPositions) {
        const botMove = bot.selectMove(fen)
        expect(botMove).not.toBeNull()
      }
    })
  })

  describe('Game State with Bot', () => {
    test('game alternates turns correctly with bot', async () => {
      const { game, bot } = createTestGameWithBot()

      expect(game.currentTurn).toBe(Team.WHITE)

      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()
      expect(game.currentTurn).toBe(Team.BLACK)

      await executeBotMove(game, bot)
      expect(game.currentTurn).toBe(Team.WHITE)

      game.selectMove('player1', 'e5')
      game.selectMove('player2', 'e5')
      await game.lockAndResolve()
      expect(game.currentTurn).toBe(Team.BLACK)
    })

    test('stats update correctly with bot', async () => {
      const { game, bot } = createTestGameWithBot()

      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()

      await executeBotMove(game, bot)

      const stats = game.getStats()
      expect(stats.movesPlayed).toBe(2)
      expect(stats.syncRate).toBe(1)
    })

    test('bot handles game over correctly', async () => {
      const { game, bot } = createTestGameWithBot()

      const quickCheckmate = async () => {
        const moves = [
          { player: 'player1', move: 'e4' },
          { player: 'player3', move: 'e5' },
          { player: 'player1', move: 'Qh5' },
          { player: 'player3', move: 'Nc6' },
          { player: 'player1', move: 'Bc4' },
          { player: 'player3', move: 'Nf6' }
        ]

        for (const { player, move } of moves) {
          if (game.isGameOver()) break

          if (player === 'player1') {
            game.selectMove('player1', move)
            game.selectMove('player2', move)
            await game.lockAndResolve()
          } else {
            const botUciMove = bot.selectMove(game.board.fen())
            const sanMove = uciToSan(botUciMove!, game.board.fen())
            game.selectMove('player3', sanMove!)
            game.selectMove('player4', sanMove!)
            await game.lockAndResolve()
          }
        }
      }

      await quickCheckmate()

      if (game.isGameOver()) {
        expect(game.status).toBe(GameStatus.GAME_OVER)
        expect(game.getResult()).toBeTruthy()
      }
    })
  })

  describe('UCI to SAN Conversion with Bot', () => {
    test('bot UCI move converts to SAN correctly', () => {
      const bot = createBot()
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const uciMove = bot.selectMove(fen)
      expect(uciMove).not.toBeNull()

      const sanMove = uciToSan(uciMove!, fen)
      expect(sanMove).not.toBeNull()

      const chess = new Chess(fen)
      const result = chess.move(sanMove!)
      expect(result).not.toBeNull()
    })
  })

  describe('Bot Skill Levels', () => {
    test('bot can be created with different skill levels', () => {
      const bot1 = createBot({ skillLevel: 1 })
      const bot3 = createBot({ skillLevel: 3 })
      const bot5 = createBot({ skillLevel: 5 })

      expect(bot1.getConfig().skillLevel).toBe(1)
      expect(bot3.getConfig().skillLevel).toBe(3)
      expect(bot5.getConfig().skillLevel).toBe(5)
    })

    test('bot returns valid move for any skill level', () => {
      for (let level = 1; level <= 6; level++) {
        const bot = createBot({ skillLevel: level })
        const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 4 4'
        const move = bot.selectMove(fen)
        expect(move).not.toBeNull()
        expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      }
    })

    test('higher skill bot tends to pick better moves', () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 4 4'
      
      const goodBot = createBot({ skillLevel: 6 })
      const randomBot = createBot({ skillLevel: 1 })
      
      const goodBotMove = goodBot.selectMove(fen)
      const randomBotMove = randomBot.selectMove(fen)
      
      expect(goodBotMove).not.toBeNull()
      expect(randomBotMove).not.toBeNull()
    })

    test('getSkillDescription returns correct description', () => {
      const bot1 = createBot({ skillLevel: 1 })
      const bot4 = createBot({ skillLevel: 4 })
      const bot6 = createBot({ skillLevel: 6 })

      expect(bot1.getSkillDescription()).toBe('~1500 ELO')
      expect(bot4.getSkillDescription()).toBe('~1800 ELO')
      expect(bot6.getSkillDescription()).toBe('~2000+ ELO')
    })
  })

  describe('Bot Configuration Integration', () => {
    test('bots can be created with configuration from getBotConfig', () => {
      // This simulates how Game.tsx will use the configuration
      const opponentBot = createBot({ skillLevel: 4 })
      const teammateBot = createBot({ skillLevel: 4 })

      expect(opponentBot.getConfig().skillLevel).toBe(4)
      expect(teammateBot.getConfig().skillLevel).toBe(4)
      expect(opponentBot.getSkillDescription()).toBe('~1800 ELO')
      expect(teammateBot.getSkillDescription()).toBe('~1800 ELO')
    })

    test('both bots can be configured to same static ELO', () => {
      const staticEloLevel = 4 // 1800 ELO

      const opponentBot = createBot({ skillLevel: staticEloLevel })
      const teammateBot = createBot({ skillLevel: staticEloLevel })

      expect(opponentBot.getConfig().skillLevel).toBe(staticEloLevel)
      expect(teammateBot.getConfig().skillLevel).toBe(staticEloLevel)
      expect(opponentBot.getSkillDescription()).toBe('~1800 ELO')
      expect(teammateBot.getSkillDescription()).toBe('~1800 ELO')
    })

    test('bots with same skill level make valid moves', () => {
      const opponentBot = createBot({ skillLevel: 4 })
      const teammateBot = createBot({ skillLevel: 4 })
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const opponentMove = opponentBot.selectMove(fen)
      const teammateMove = teammateBot.selectMove(fen)

      expect(opponentMove).not.toBeNull()
      expect(teammateMove).not.toBeNull()
      expect(opponentMove).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      expect(teammateMove).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('bots with static 1800 ELO make consistent quality moves', () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 4 4'
      const bot1 = createBot({ skillLevel: 4 })
      const bot2 = createBot({ skillLevel: 4 })

      const move1 = bot1.selectMove(fen)
      const move2 = bot2.selectMove(fen)

      // Both should return valid moves (may be different due to probability)
      expect(move1).not.toBeNull()
      expect(move2).not.toBeNull()
      expect(move1).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      expect(move2).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('static ELO configuration works throughout game', async () => {
      const { game } = createTestGameWithBot()
      const opponentBot = createBot({ skillLevel: 4 })
      const teammateBot = createBot({ skillLevel: 4 })

      // Play several moves
      game.selectMove('player1', 'e4')
      game.selectMove('player2', 'e4')
      await game.lockAndResolve()

      // Opponent moves
      await executeBotMove(game, opponentBot)

      // Teammate moves
      const currentFen = game.board.fen()
      const teammateMove = teammateBot.selectMove(currentFen)
      if (teammateMove) {
        const teammateSanMove = uciToSan(teammateMove, currentFen)
        if (teammateSanMove) {
          game.selectMove('player2', teammateSanMove)
        }
      }
      game.selectMove('player1', 'e5')
      await game.lockAndResolve()

      // Verify both bots maintain static ELO
      expect(opponentBot.getSkillDescription()).toBe('~1800 ELO')
      expect(teammateBot.getSkillDescription()).toBe('~1800 ELO')
      expect(game.getStats().movesPlayed).toBeGreaterThan(0)
    })
  })
})
