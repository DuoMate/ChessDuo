export interface OpeningMove {
  move: string
  name?: string
}

export interface OpeningLine {
  name: string
  moves: string[]
}

export interface OpeningBook {
  level: number
  name: string
  lines: OpeningLine[]
}

const BASIC_OPENINGS: OpeningLine[] = [
  {
    name: "King's Pawn Opening",
    moves: ["e4"]
  },
  {
    name: "Queen's Pawn Opening",
    moves: ["d4"]
  },
  {
    name: "English Opening",
    moves: ["c4"]
  },
  {
    name: "Reti Opening",
    moves: ["Nf3"]
  }
]

const MODERATE_OPENINGS: OpeningLine[] = [
  {
    name: "King's Pawn Opening",
    moves: ["e4"]
  },
  {
    name: "Queen's Pawn Opening",
    moves: ["d4"]
  },
  {
    name: "English Opening",
    moves: ["c4"]
  },
  {
    name: "Reti Opening",
    moves: ["Nf3"]
  },
  {
    name: "Sicilian Defense",
    moves: ["e4", "c5"]
  },
  {
    name: "Caro-Kann Defense",
    moves: ["e4", "c6"]
  },
  {
    name: "French Defense",
    moves: ["e4", "e6"]
  },
  {
    name: "Queen's Gambit",
    moves: ["d4", "d5", "c4"]
  },
  {
    name: "Slav Defense",
    moves: ["d4", "d5", "c4", "c6"]
  },
  {
    name: "Grunfeld Defense",
    moves: ["d4", "Nf6", "c4", "g6"]
  },
  {
    name: "King's Indian Defense",
    moves: ["d4", "Nf6", "c4", "g6"]
  },
  {
    name: "Nimzo-Indian Defense",
    moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]
  },
  {
    name: "Bogo-Indian Defense",
    moves: ["d4", "Nf6", "c4", "e6", "Nf3", "Bb4+"]
  }
]

const SOPHISTICATED_OPENINGS: OpeningLine[] = [
  {
    name: "Italian Game",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"]
  },
  {
    name: "Ruy Lopez",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]
  },
  {
    name: "Scotch Game",
    moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4"]
  },
  {
    name: "Petrov Defense",
    moves: ["e4", "e5", "Nf3", "Nf6"]
  },
  {
    name: "Two Knights Defense",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"]
  },
  {
    name: "Latvian Gambit",
    moves: ["e4", "e5", "Nf3", "e4"]
  },
  {
    name: "King's Gambit",
    moves: ["e4", "e5", "f4"]
  },
  {
    name: "Philidor Defense",
    moves: ["e4", "e5", "Nf3", "d6"]
  },
  {
    name: "Pirc Defense",
    moves: ["e4", "d6", "d4", "Nd7"]
  },
  {
    name: "Modern Defense",
    moves: ["e4", "g6"]
  },
  {
    name: "Modern Defense with d6",
    moves: ["e4", "d6", "d4", "g6"]
  },
  {
    name: "King's Indian Defense",
    moves: ["e4", "g6", "d4", "Bg7", "Nf3", "d6", "Bc4"]
  },
  {
    name: "Dutch Defense",
    moves: ["d4", "f5"]
  },
  {
    name: "Old Indian Defense",
    moves: ["d4", "d6", "c4", "Nd7"]
  },
  {
    name: "Alekhine Defense",
    moves: ["e4", "Nf6"]
  },
  {
    name: "Sicilian Najdorf",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nf3", "cxd4", "Nc3", "a6"]
  },
  {
    name: "Sicilian Dragon",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nf3", "cxd4", "Nc3", "g6"]
  },
  {
    name: "Sicilian Scheveningen",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nf3", "cxd4", "Nc3", "e6"]
  },
  {
    name: "Sicilian Kalashnikov",
    moves: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4"]
  },
  {
    name: "Caro-Kann Exchange",
    moves: ["e4", "c6", "d4", "d5", "exd5", "cxd5"]
  },
  {
    name: "Caro-Kann Advance",
    moves: ["e4", "c6", "d4", "c5"]
  },
  {
    name: "French Tarrasch",
    moves: ["e4", "e6", "d4", "d5", "Nd2"]
  },
  {
    name: "French Winawer",
    moves: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"]
  },
  {
    name: "Queen'e Gambit Declined",
    moves: ["d4", "d5", "c4", "e6"]
  },
  {
    name: "QGD Cambridge Springs",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Nbd7"]
  },
  {
    name: "QGD Tarrasch Defense",
    moves: ["d4", "d5", "c4", "e6", "Nf3", "c5"]
  },
  {
    name: "Slav Defense",
    moves: ["d4", "d5", "c4", "c6"]
  },
  {
    name: "Semi-Slav Defense",
    moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "e6"]
  },
  {
    name: "Grunfeld Defense",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"]
  },
  {
    name: "King's Indian Defense",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4"]
  },
  {
    name: "King's Indian Samisch",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f3"]
  },
  {
    name: "Nimzo-Indian Defense",
    moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]
  },
  {
    name: "Nimzo-Indian Samisch",
    moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "f3"]
  },
  {
    name: "Bogo-Indian Defense",
    moves: ["d4", "Nf6", "c4", "e6", "Nf3", "Bb4+", "Bd2"]
  },
  {
    name: "Benoni Defense",
    moves: ["d4", "Nf6", "c4", "c5"]
  },
  {
    name: "Benko Gambit",
    moves: ["d4", "Nf6", "c4", "c5", "d5", "b5"]
  },
  {
    name: "Dutch Defense",
    moves: ["d4", "f5"]
  },
  {
    name: "Leningrad Dutch",
    moves: ["d4", "f5", "Nf3", "g6", "Bg5", "Bg7"]
  },
  {
    name: "Old Indian Defense",
    moves: ["d4", "Nf6", "c4", "d6"]
  },
  {
    name: "Budapest Gambit",
    moves: ["d4", "Nf6", "c4", "e5"]
  },
  {
    name: "Trompowsky Attack",
    moves: ["d4", "Nf6", "Bg5"]
  },
  {
    name: "London System",
    moves: ["d4", "Nf6", "Bf4", "d5", "e3", "e6", "Nd2"]
  },
  {
    name: "Catalan Opening",
    moves: ["d4", "Nf6", "c4", "e6", "g3", "d5"]
  },
  {
    name: "Reti Opening",
    moves: ["Nf3", "d5", "c4"]
  },
  {
    name: "English Symmetrical",
    moves: ["Nf3", "c5", "c4", "Nc6", "c3"]
  }
]

export const OPENING_BOOK: OpeningBook[] = [
  {
    level: 1,
    name: "Basic Openings (~1500 ELO)",
    lines: BASIC_OPENINGS
  },
  {
    level: 2,
    name: "Basic Openings (~1600 ELO)",
    lines: BASIC_OPENINGS
  },
  {
    level: 3,
    name: "Moderate Openings (~1700 ELO)",
    lines: MODERATE_OPENINGS
  },
  {
    level: 4,
    name: "Moderate Openings (~1800 ELO)",
    lines: MODERATE_OPENINGS
  },
  {
    level: 5,
    name: "Sophisticated Openings (~1900 ELO)",
    lines: SOPHISTICATED_OPENINGS
  },
  {
    level: 6,
    name: "Sophisticated Openings (~2000+ ELO)",
    lines: SOPHISTICATED_OPENINGS
  }
]

export function getOpeningBookForLevel(level: number): OpeningBook {
  if (level <= 2) {
    return OPENING_BOOK.find(o => o.level === 1)!
  } else if (level <= 4) {
    return OPENING_BOOK.find(o => o.level === 3)!
  } else {
    return OPENING_BOOK.find(o => o.level === 5)!
  }
}

function getMoveNumberFromFen(fen: string): number {
  const parts = fen.split(' ')
  return parseInt(parts[5], 10) || 1
}

function getHalfMoveClockFromFen(fen: string): number {
  const parts = fen.split(' ')
  return parseInt(parts[4], 10) || 0
}

const INITIAL_PIECE_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

function isInitialPosition(fen: string): boolean {
  const piecePlacement = fen.split(' ')[0]
  return piecePlacement === INITIAL_PIECE_PLACEMENT
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function getBookMove(fen: string, skillLevel: number): string | null {
  if (fen !== INITIAL_FEN) {
    return null
  }
  
  const book = getOpeningBookForLevel(skillLevel)
  const randomLine = book.lines[Math.floor(Math.random() * book.lines.length)]
  return randomLine.moves[0]
}

export function isInOpeningBook(fen: string, skillLevel: number): boolean {
  return getBookMove(fen, skillLevel) !== null
}
