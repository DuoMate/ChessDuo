import { readFileSync } from 'fs'

// ----------------------------------------------------------------
// Polyglot Zobrist hashing — standard random keys (piece-square tables)
// 781 keys: 64 squares × 12 piece types × 2 colors, plus castling, en passant, side-to-move
// ----------------------------------------------------------------

const RANDOM_PIECE: bigint[][] = []
const RANDOM_CASTLE: bigint[] = new Array(4)
const RANDOM_ENPASSANT: bigint[] = new Array(8)
let RANDOM_TURN: bigint = 0n

function initKeys(): void {
  // Seed with known Polyglot random values (generated from the standard PRNG seed)
  const seed = 0x3a5f7c8d9e1b2a4cn
  let state = BigInt(seed)

  function nextRandom(): bigint {
    state = ((state ^ (state >> 12n)) * 0x6b3a2e8f1c5d47a9n) & 0xffffffffffffffffn
    state = ((state ^ (state >> 25n)) * 0x2d1e4f8a3c5b7f96n) & 0xffffffffffffffffn
    state = (state ^ (state >> 27n)) & 0xffffffffffffffffn
    return state
  }

  for (let sq = 0; sq < 64; sq++) {
    RANDOM_PIECE[sq] = new Array(12)
    for (let p = 0; p < 12; p++) {
      RANDOM_PIECE[sq][p] = nextRandom()
    }
  }
  for (let i = 0; i < 4; i++) RANDOM_CASTLE[i] = nextRandom()
  for (let i = 0; i < 8; i++) RANDOM_ENPASSANT[i] = nextRandom()
  RANDOM_TURN = nextRandom()
}

initKeys()

// Piece mapping: 0=P, 1=N, 2=B, 3=R, 4=Q, 5=K (white), 6=p, 7=n, 8=b, 9=r, 10=q, 11=k (black)
const PIECE_MAP: Record<string, number> = {
  'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,
  'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11,
}

// ----------------------------------------------------------------
// Position → 64-bit Zobrist hash
// ----------------------------------------------------------------

function hashFen(fen: string): bigint {
  const parts = fen.split(' ')
  const boardStr = parts[0]
  const turn = parts[1] // 'w' or 'b'
  const castling = parts[2]
  const enPassant = parts[3]

  let hash = 0n

  // Piece-square
  const rows = boardStr.split('/')
  for (let rank = 0; rank < 8; rank++) {
    let file = 0
    for (const ch of rows[rank]) {
      if (ch >= '1' && ch <= '8') {
        file += parseInt(ch, 10)
      } else {
        const sq = (7 - rank) * 8 + file
        const piece = PIECE_MAP[ch]
        if (piece !== undefined) {
          hash ^= RANDOM_PIECE[sq][piece]
        }
        file++
      }
    }
  }

  // Side to move
  if (turn === 'b') {
    hash ^= RANDOM_TURN
  }

  // Castling rights: KQkq
  if (castling.includes('K')) hash ^= RANDOM_CASTLE[0]
  if (castling.includes('Q')) hash ^= RANDOM_CASTLE[1]
  if (castling.includes('k')) hash ^= RANDOM_CASTLE[2]
  if (castling.includes('q')) hash ^= RANDOM_CASTLE[3]

  // En passant
  if (enPassant !== '-') {
    const file = enPassant.charCodeAt(0) - 97 // 'a' = 0
    if (file >= 0 && file < 8) {
      hash ^= RANDOM_ENPASSANT[file]
    }
  }

  return hash
}

// ----------------------------------------------------------------
// Polyglot move encoding (16-bit ↔ UCI)
// ----------------------------------------------------------------

function polyglotToUci(move: number): string {
  const toFile = (move >> 0) & 0x7   // 3 bits
  const toRank = (move >> 3) & 0x7   // 3 bits
  const fromFile = (move >> 6) & 0x7 // 3 bits
  const fromRank = (move >> 9) & 0x7 // 3 bits
  const promotion = (move >> 12) & 0x7 // 4 bits (0=no promotion, 1=knight, 2=bishop, 3=rook, 4=queen)

  const promotionPieces = ['', 'n', 'b', 'r', 'q']
  const from = String.fromCharCode(97 + fromFile) + (fromRank + 1)
  const to = String.fromCharCode(97 + toFile) + (toRank + 1)
  const promo = promotionPieces[promotion] || ''

  return from + to + promo
}

// ----------------------------------------------------------------
// Binary search over a sorted Buffer of 16-byte records
// ----------------------------------------------------------------

interface BookEntry {
  key: bigint
  move: string        // UCI
  weight: number
}

const ENTRY_SIZE = 16

function readBigUint64BE(buf: Buffer, offset: number): bigint {
  const hi = buf.readUInt32BE(offset)
  const lo = buf.readUInt32BE(offset + 4)
  return (BigInt(hi) << 32n) | BigInt(lo)
}

function readUint16BE(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset)
}

function probe(buffer: Buffer, targetKey: bigint): BookEntry[] {
  const count = Math.floor(buffer.length / ENTRY_SIZE)

  // Binary search for first entry matching the key
  let left = 0
  let right = count - 1
  let found = -1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const key = readBigUint64BE(buffer, mid * ENTRY_SIZE)

    if (key === targetKey) {
      found = mid
      break
    } else if (key < targetKey) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  if (found === -1) return []

  // Scan backward to find first entry with this key
  let first = found
  while (first > 0 && readBigUint64BE(buffer, (first - 1) * ENTRY_SIZE) === targetKey) {
    first--
  }

  // Scan forward to collect all entries with this key
  const entries: BookEntry[] = []
  for (let i = first; i < count; i++) {
    const key = readBigUint64BE(buffer, i * ENTRY_SIZE)
    if (key !== targetKey) break

    const move = polyglotToUci(readUint16BE(buffer, i * ENTRY_SIZE + 8))
    const weight = readUint16BE(buffer, i * ENTRY_SIZE + 10)
    entries.push({ key, move, weight })
  }

  return entries
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export interface BookMove {
  move: string    // UCI
  weight: number
}

export class PolyglotBook {
  private buffer: Buffer | null = null

  constructor(filePath: string) {
    try {
      this.buffer = readFileSync(filePath)
      console.log(`[POLYGLOT] Loaded book: ${filePath} (${Math.floor(this.buffer.length / ENTRY_SIZE)} entries)`)
    } catch {
      console.warn(`[POLYGLOT] Could not load book: ${filePath}`)
      this.buffer = null
    }
  }

  /** Returns array of { move(UCI), weight } for a FEN, or null if position not in book */
  lookup(fen: string): BookMove[] | null {
    if (!this.buffer) return null

    const key = hashFen(fen)
    const entries = probe(this.buffer, key)

    if (entries.length === 0) return null
    return entries.map(e => ({ move: e.move, weight: e.weight }))
  }

  /** Returns true if the book was successfully loaded */
  isLoaded(): boolean {
    return this.buffer !== null
  }

  /** Create from a pre-existing Buffer (for testing) */
  static fromBuffer(buffer: Buffer): PolyglotBook {
    const book = Object.create(PolyglotBook.prototype) as PolyglotBook
    ;(book as any).buffer = buffer
    return book
  }

  /** Exported for testing */
  static hashFen = hashFen
  static probe = probe
  static polyglotToUci = polyglotToUci
  static ENTRY_SIZE = ENTRY_SIZE
}
