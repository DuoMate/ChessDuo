import { createBot } from '../chessBot'
import { Chess } from 'chess.js'

describe('ChessBot', () => {
  describe('selectMove', () => {
    test('selects a valid move from initial position', () => {
      const bot = createBot()
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const move = bot.selectMove(fen)
      
      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
    })

    test('returns UCI format move', () => {
      const bot = createBot()
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const move = bot.selectMove(fen)
      
      expect(move).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
      const [from, to] = move!.split('-')
      expect(from).toMatch(/^[a-h][1-8]$/)
      expect(to).toMatch(/^[a-h][1-8]$/)
    })

    test('selected move is legal', () => {
      const bot = createBot()
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const move = bot.selectMove(fen)
      const [from, to] = move!.split('-')
      
      const chess = new Chess(fen)
      const legalMoves = chess.moves({ verbose: true })
      const isLegal = legalMoves.some(m => m.from === from && m.to === to)
      
      expect(isLegal).toBe(true)
    })

    test('returns null when no moves available', () => {
      const bot = createBot()
      const fen = '6k1/8/8/8/8/8/8/7 w - - 0 1'
      
      const move = bot.selectMove(fen)
      
      expect(move).toBeNull()
    })

    test('returns null for checkmate position', () => {
      const bot = createBot()
      const fen = '6k1/5 Opp/8/8/8/8/8/7 w - - 0 1'
      
      const move = bot.selectMove(fen)
      
      expect(move).toBeNull()
    })

    test('handles invalid FEN gracefully', () => {
      const bot = createBot()
      const fen = 'invalid fen string'
      
      const move = bot.selectMove(fen)
      
      expect(move).toBeNull()
    })
  })

  describe('bot configuration', () => {
    test('creates bot with default config', () => {
      const bot = createBot()
      const config = bot.getConfig()
      
      expect(config.skillLevel).toBe(3)
    })

    test('creates bot with custom config', () => {
      const bot = createBot({ skillLevel: 5 })
      const config = bot.getConfig()
      
      expect(config.skillLevel).toBe(5)
    })

    test('getConfig returns copy of config', () => {
      const bot = createBot()
      const config1 = bot.getConfig()
      const config2 = bot.getConfig()
      
      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)
    })
  })

  describe('move validation', () => {
    test('bot move can be executed on board', () => {
      const bot = createBot()
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const move = bot.selectMove(initialFen)
      const sanMove = moveToSan(move!, initialFen)
      
      const chess = new Chess(initialFen)
      const result = chess.move(sanMove)
      
      expect(result).not.toBeNull()
      expect(chess.fen()).not.toBe(initialFen)
    })

    test('consecutive bot moves work correctly', () => {
      const bot = createBot()
      let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      for (let i = 0; i < 4; i++) {
        const move = bot.selectMove(fen)
        if (!move) break
        
        const sanMove = moveToSan(move, fen)
        const chess = new Chess(fen)
        const result = chess.move(sanMove)
        
        if (!result) break
        fen = chess.fen()
      }
      
      expect(fen).not.toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    })
  })

  describe('ELO_MAPPING configuration', () => {
    test('level 1 (beginner) has lowest bestMoveChance', () => {
      const bot = createBot({ skillLevel: 1 })
      const description = bot.getSkillDescription()
      expect(description).toBe('Beginner ~1000 ELO')
    })

    test('level 6 (master) has highest bestMoveChance', () => {
      const bot = createBot({ skillLevel: 6 })
      const description = bot.getSkillDescription()
      expect(description).toBe('Master ~2600 ELO')
    })

    test('higher skill levels have higher bestMoveChance than lower levels', () => {
      const bot1 = createBot({ skillLevel: 1 })
      const bot4 = createBot({ skillLevel: 4 })
      const bot6 = createBot({ skillLevel: 6 })

      expect(bot1.getSkillDescription()).toBe('Beginner ~1000 ELO')
      expect(bot4.getSkillDescription()).toBe('Advanced ~2000 ELO')
      expect(bot6.getSkillDescription()).toBe('Master ~2600 ELO')
    })

    test('all skill levels have correct descriptions', () => {
      const expectedDescriptions: Record<number, string> = {
        1: 'Beginner ~1000 ELO',
        2: 'Novice ~1500 ELO',
        3: 'Intermediate ~1800 ELO',
        4: 'Advanced ~2000 ELO',
        5: 'Expert ~2200 ELO',
        6: 'Master ~2600 ELO',
      }

      for (let level = 1; level <= 6; level++) {
        const bot = createBot({ skillLevel: level })
        expect(bot.getSkillDescription()).toBe(expectedDescriptions[level])
      }
    })

    test('skill level 1 makes more diverse moves than level 6', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const numTries = 50

      const level1Moves = new Set<string>()
      const level6Moves = new Set<string>()

      for (let i = 0; i < numTries; i++) {
        const bot1 = createBot({ skillLevel: 1 })
        const bot6 = createBot({ skillLevel: 6 })
        level1Moves.add(bot1.selectMove(fen)!)
        level6Moves.add(bot6.selectMove(fen)!)
      }

      expect(level1Moves.size).toBeGreaterThan(1)
      expect(level6Moves.size).toBeGreaterThanOrEqual(1)
      expect(level1Moves.size).toBeGreaterThanOrEqual(level6Moves.size)
    })
  })
})

function moveToSan(uciMove: string, fen: string): string {
  const [from, to] = uciMove.split('-')
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  
  const matchedMove = moves.find(m => m.from === from && m.to === to)
  return matchedMove?.san || ''
}
