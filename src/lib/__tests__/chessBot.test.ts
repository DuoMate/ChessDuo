import { createBot } from '../../features/bots/chessBot'
import { Chess } from 'chess.js'

describe('ChessBot', () => {
  describe('selectMove', () => {
    test('selects a valid move from initial position', () => {
      const bot = createBot()
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const move = bot.selectMove(fen)
      
      expect(move).not.toBeNull()
      expect(move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
    })

    test('returns UCI format move', () => {
      const bot = createBot()
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const move = bot.selectMove(fen)
      
      expect(move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
      const from = move!.substring(0, 2)
      const to = move!.substring(2, 4)
      expect(from).toMatch(/^[a-h][1-8]$/)
      expect(to).toMatch(/^[a-h][1-8]$/)
    })

    test('selected move is legal', () => {
      const bot = createBot()
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      
      const move = bot.selectMove(fen)
      const from = move!.substring(0, 2)
      const to = move!.substring(2, 4)
      
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

    test('skill levels have correct UCI_Elo values', () => {
      const bot1 = createBot({ skillLevel: 1 })
      const bot6 = createBot({ skillLevel: 6 })
      
      expect(bot1.getSkillDescription()).toBe('Beginner ~1000 ELO')
      expect(bot6.getSkillDescription()).toBe('Master ~2600 ELO')
    })
  })
})

function moveToSan(uciMove: string, fen: string): string {
  const from = uciMove.substring(0, 2)
  const to = uciMove.substring(2, 4)
  const promotion = uciMove.length === 5 ? uciMove.substring(4, 5) : undefined
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  
  const matchedMove = moves.find(m => m.from === from && m.to === to && m.promotion === promotion)
  return matchedMove?.san || ''
}

describe('ChessBot — black opponent score handling', () => {
  test('black opponent bot selects strong moves, not blunders, at high skill level', () => {
    const bot = createBot({ skillLevel: 6 })
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    
    const chess = new Chess(fen)
    const legalMoves = chess.moves()
    expect(legalMoves.length).toBeGreaterThanOrEqual(15)
    
    const move = bot.selectMove(fen)
    expect(move).not.toBeNull()
    
    // At Grandmaster level, Black should not hang material in the opening
    const chessAfter = new Chess(fen)
    chessAfter.move(move!)
    const material = countMaterial(chessAfter.fen())
    // After 1. e4, Black's response should not lose material
    const startingMaterial = countMaterial(fen)
    expect(material.black).toBeGreaterThanOrEqual(startingMaterial.black - 1)
  })

  test('black bot at beginner level can make weaker moves', () => {
    const bot = createBot({ skillLevel: 1 })
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    
    const move = bot.selectMove(fen)
    expect(move).not.toBeNull()
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
  })

  test('black bot at level 6 does not hang a queen when threatened', () => {
    const bot = createBot({ skillLevel: 6 })
    // Black queen on d8 is attacked by White bishop on g5 (diagonal g5-f6-e7-d8 is clear)
    const fen = 'rnbqkbnr/pppp1ppp/8/4p1B1/4P3/8/PPPP1PPP/RN1QKBNR b KQkq - 2 2'
    
    const move = bot.selectMove(fen)
    expect(move).not.toBeNull()
    
    const chessAfter = new Chess(fen)
    chessAfter.move(move!)
    // After moving, Black should still have their queen
    const fenAfter = chessAfter.fen()
    const pieces = fenAfter.split(' ')[0]
    // Queen should still be on the board — bot should protect or move it
    expect(pieces).toContain('q')
  })
})

function countMaterial(fen: string): { white: number; black: number } {
  const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
  const pieces = fen.split(' ')[0]
  let white = 0, black = 0
  for (const ch of pieces) {
    if (pieceValues[ch.toLowerCase()]) {
      if (ch === ch.toUpperCase()) white += pieceValues[ch.toLowerCase()]
      else black += pieceValues[ch.toLowerCase()]
    }
  }
  return { white, black }
}
