import { PolyglotBook } from '../src/polyglot'

describe('PolyglotBook', () => {
  // ----------------------------------------------------------------
  // Zobrist hashing
  // ----------------------------------------------------------------
  describe('hashFen', () => {
    test('initial position produces a consistent hash', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const hash1 = PolyglotBook.hashFen(fen)
      const hash2 = PolyglotBook.hashFen(fen)
      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('bigint')
    })

    test('different positions produce different hashes', () => {
      const fen1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
      expect(PolyglotBook.hashFen(fen1)).not.toBe(PolyglotBook.hashFen(fen2))
    })

    test('black to move differs from white to move', () => {
      const fenWhite = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1'
      const fenBlack = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
      expect(PolyglotBook.hashFen(fenWhite)).not.toBe(PolyglotBook.hashFen(fenBlack))
    })

    test('mirrored positions produce different hashes', () => {
      const white = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const black = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1'
      expect(PolyglotBook.hashFen(white)).not.toBe(PolyglotBook.hashFen(black))
    })

    test('castling rights affect hash', () => {
      const withCastle = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const noCastle = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
      expect(PolyglotBook.hashFen(withCastle)).not.toBe(PolyglotBook.hashFen(noCastle))
    })

    test('en passant square affects hash', () => {
      const withEP = 'rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq e6 0 2'
      const noEP = 'rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq - 0 2'
      expect(PolyglotBook.hashFen(withEP)).not.toBe(PolyglotBook.hashFen(noEP))
    })
  })

  // ----------------------------------------------------------------
  // Polyglot move encoding
  // ----------------------------------------------------------------
  describe('polyglotToUci', () => {
    test('converts Pawn e2e4 correctly', () => {
      // Polyglot: toFile(3) | toRank(3) | fromFile(3) | fromRank(3) = 16 bits
      // e2e4: from=4,1 to=4,3
      const toFile = 4, toRank = 3, fromFile = 4, fromRank = 1
      const move = (toFile << 0) | (toRank << 3) | (fromFile << 6) | (fromRank << 9)
      expect(PolyglotBook.polyglotToUci(move)).toBe('e2e4')
    })

    test('converts promotion move correctly', () => {
      // a7a8q: from=0,6 to=0,7 promotion=4(queen)
      const toFile = 0, toRank = 7, fromFile = 0, fromRank = 6, promo = 4
      const move = (toFile << 0) | (toRank << 3) | (fromFile << 6) | (fromRank << 9) | (promo << 12)
      expect(PolyglotBook.polyglotToUci(move)).toBe('a7a8q')
    })

    test('converts knight move correctly', () => {
      // g1f3: from=g=6,0 to=f=5,2
      const fromFile = 6, fromRank = 0, toFile = 5, toRank = 2
      const move = (toFile << 0) | (toRank << 3) | (fromFile << 6) | (fromRank << 9)
      expect(PolyglotBook.polyglotToUci(move)).toBe('g1f3')
    })
  })

  // ----------------------------------------------------------------
  // Binary search / probe
  // ----------------------------------------------------------------
  describe('probe', () => {
    function createEntry(key: bigint, moveBits: number, weight: number): Buffer {
      const buf = Buffer.alloc(16)
      const keyHi = Number(key >> 32n) >>> 0
      const keyLo = Number(key & 0xffffffffn) >>> 0
      buf.writeUInt32BE(keyHi, 0)
      buf.writeUInt32BE(keyLo, 4)
      buf.writeUInt16BE(moveBits, 8)
      buf.writeUInt16BE(weight, 10)
      return buf
    }

    test('finds matching entries in sorted buffer', () => {
      const keyA = 0x463b96181691fc9cn
      const keyB = 0x823c9b50fd114196n
      const keyC = 0xd4d28b3b9c0e47a2n

      // e2e4: fromFile=4, fromRank=1, toFile=4, toRank=3
      const moveBits = (4 << 0) | (3 << 3) | (4 << 6) | (1 << 9)
      // d2d4: fromFile=3, fromRank=1, toFile=3, toRank=3
      const moveBits2 = (3 << 0) | (3 << 3) | (3 << 6) | (1 << 9)

      const buffer = Buffer.concat([
        createEntry(keyA, moveBits, 100),
        createEntry(keyB, moveBits, 200),
        createEntry(keyB, moveBits2, 50),
        createEntry(keyC, moveBits, 300),
      ])

      const results = PolyglotBook.probe(buffer, keyB)
      expect(results).toHaveLength(2)
      expect(results[0].move).toBe(PolyglotBook.polyglotToUci(moveBits))
      expect(results[1].move).toBe(PolyglotBook.polyglotToUci(moveBits2))
    })

    test('returns empty for missing key', () => {
      const keyA = 0x463b96181691fc9cn
      const moveBits = (4 << 0) | (3 << 3) | (4 << 6) | (1 << 9)
      const buffer = createEntry(keyA, moveBits, 100)
      const results = PolyglotBook.probe(buffer, 0x9999999999999999n)
      expect(results).toHaveLength(0)
    })
  })

  // ----------------------------------------------------------------
  // Book loading
  // ----------------------------------------------------------------
  describe('fromBuffer', () => {
    test('creates a book from a pre-existing buffer', () => {
      const keyA = 0x463b96181691fc9cn
      // e2e4: toFile=4, toRank=3, fromFile=4, fromRank=1
      const moveBits = (4 << 0) | (3 << 3) | (4 << 6) | (1 << 9)
      const weight = 100

      const hi = Number(keyA >> 32n) >>> 0
      const lo = Number(keyA & 0xffffffffn) >>> 0
      const buf = Buffer.alloc(16)
      buf.writeUInt32BE(hi, 0)
      buf.writeUInt32BE(lo, 4)
      buf.writeUInt16BE(moveBits, 8)
      buf.writeUInt16BE(weight, 10)

      const book = PolyglotBook.fromBuffer(buf)
      expect(book.isLoaded()).toBe(true)
    })
  })
})
