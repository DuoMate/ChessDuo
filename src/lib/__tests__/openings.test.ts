import {
  OPENING_BOOK,
  getOpeningBookForLevel,
  getBookMove,
  isInOpeningBook
} from '../../features/bots/openings'
import { Chess } from 'chess.js'

describe('Opening Book', () => {
  describe('getOpeningBookForLevel', () => {
    test('level 1 returns basic openings', () => {
      const book = getOpeningBookForLevel(1)
      expect(book.level).toBe(1)
      expect(book.lines.length).toBe(4)
    })

    test('level 2 returns basic openings', () => {
      const book = getOpeningBookForLevel(2)
      expect(book.level).toBe(1)
      expect(book.lines.length).toBe(4)
    })

    test('level 3 returns moderate openings', () => {
      const book = getOpeningBookForLevel(3)
      expect(book.level).toBe(3)
      expect(book.lines.length).toBeGreaterThan(4)
    })

    test('level 4 returns moderate openings', () => {
      const book = getOpeningBookForLevel(4)
      expect(book.level).toBe(3)
    })

    test('level 5 returns sophisticated openings', () => {
      const book = getOpeningBookForLevel(5)
      expect(book.level).toBe(5)
      expect(book.lines.length).toBeGreaterThan(10)
    })

    test('level 6 returns sophisticated openings', () => {
      const book = getOpeningBookForLevel(6)
      expect(book.level).toBe(5)
    })
  })

  describe('getBookMove', () => {
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    test('returns a move from the book at initial position', () => {
      const move = getBookMove(initialFen, 1)
      expect(move).not.toBeNull()
      expect(['e4', 'd4', 'c4', 'Nf3']).toContain(move)
    })

    test('level 1 only returns basic opening moves', () => {
      const move = getBookMove(initialFen, 1)
      expect(['e4', 'd4', 'c4', 'Nf3']).toContain(move)
    })

    test('level 6 can return sophisticated opening moves', () => {
      const move = getBookMove(initialFen, 6)
      expect(move).not.toBeNull()
    })

    test('returns null after any moves have been played', () => {
      const chess = new Chess()
      chess.move('e4')
      const fen = chess.fen()
      const move = getBookMove(fen, 6)
      expect(move).toBeNull()
    })

    test('returns null when halfmove clock > 0', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 1 2'
      const move = getBookMove(fen, 6)
      expect(move).toBeNull()
    })
  })

  describe('isInOpeningBook', () => {
    test('initial position is in opening book for all levels', () => {
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      expect(isInOpeningBook(initialFen, 1)).toBe(true)
      expect(isInOpeningBook(initialFen, 3)).toBe(true)
      expect(isInOpeningBook(initialFen, 6)).toBe(true)
    })

    test('returns false after any moves', () => {
      const chess = new Chess()
      chess.move('e4')
      const fen = chess.fen()
      expect(isInOpeningBook(fen, 6)).toBe(false)
    })
  })

  describe('book structure', () => {
    test('basic openings have 4 lines', () => {
      const basicBook = OPENING_BOOK.find(o => o.level === 1)!
      expect(basicBook.lines.length).toBe(4)
      expect(basicBook.name).toContain('Basic')
    })

    test('moderate openings have more variety', () => {
      const moderateBook = OPENING_BOOK.find(o => o.level === 3)!
      expect(moderateBook.lines.length).toBeGreaterThan(4)
      expect(moderateBook.name).toContain('Moderate')
    })

    test('sophisticated openings have many lines', () => {
      const sophisticatedBook = OPENING_BOOK.find(o => o.level === 5)!
      expect(sophisticatedBook.lines.length).toBeGreaterThan(30)
      expect(sophisticatedBook.name).toContain('Sophisticated')
    })

    test('each opening line has name and moves', () => {
      for (const book of OPENING_BOOK) {
        for (const line of book.lines) {
          expect(line.name).toBeDefined()
          expect(line.moves).toBeDefined()
          expect(line.moves.length).toBeGreaterThan(0)
        }
      }
    })

    test('first moves of each line are valid', () => {
      const chess = new Chess()
      for (const book of OPENING_BOOK) {
        for (const line of book.lines) {
          chess.reset()
          const firstMove = line.moves[0]
          const legalFirstMoves = chess.moves()
          expect(legalFirstMoves).toContain(firstMove)
        }
      }
    })
  })
})