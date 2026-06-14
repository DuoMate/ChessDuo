import { StockfishEngine } from '../src/engine'
import { PolyglotBook } from '../src/polyglot'

describe('StockfishEngine', () => {
  describe('book lookup', () => {
    test('book hit returns results instantly without queueing Stockfish', async () => {
      const engine = new StockfishEngine('cat')

      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const key = PolyglotBook.hashFen(fen)

      // e2e4: toFile=4, toRank=3, fromFile=4, fromRank=1
      const moveBits = (4 << 0) | (3 << 3) | (4 << 6) | (1 << 9)
      const weight = 100

      const hi = Number(key >> 32n) >>> 0
      const lo = Number(key & 0xffffffffn) >>> 0
      const buf = Buffer.alloc(16)
      buf.writeUInt32BE(hi, 0)
      buf.writeUInt32BE(lo, 4)
      buf.writeUInt16BE(moveBits, 8)
      buf.writeUInt16BE(weight, 10)

      const book = PolyglotBook.fromBuffer(buf)
      engine.setBook(book)

      // Should resolve instantly from book — no Stockfish needed
      const result = await engine.evaluateMoves(fen, [])
      expect(result).toHaveLength(1)
      expect(result[0].move).toBe('e2e4')
      expect(result[0].score).toBe(10)
    })

    test('no book falls through without crashing', () => {
      const engine = new StockfishEngine('cat')
      const promise = engine.evaluateMoves(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        ['e2e4']
      )
      expect(promise).toBeInstanceOf(Promise)
    })
  })

  describe('cache', () => {
    test('getCacheSize starts at 0', () => {
      const engine = new StockfishEngine('cat')
      expect(engine.getCacheSize()).toBe(0)
    })
  })
})
