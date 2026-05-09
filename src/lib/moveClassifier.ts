export interface MoveClassification {
  type: string
  description: string
  icon: string
}

export function classifyMove(san: string, _fen?: string): MoveClassification {
  if (!san) return { type: 'unknown', description: 'Move played', icon: '?' }

  if (san === 'O-O' || san === 'O-O-O') {
    const side = san === 'O-O' ? 'kingside' : 'queenside'
    return { type: 'castle', description: `Castles ${side} — improves king safety`, icon: '🏰' }
  }

  if (san.includes('+') || san.includes('#')) {
    const isMate = san.includes('#')
    return {
      type: 'check',
      description: isMate ? 'Checkmate!' : 'Puts opponent in check',
      icon: isMate ? '👑' : '⚠️',
    }
  }

  if (san.includes('x')) {
    return { type: 'capture', description: 'Wins material — captures a piece', icon: '⚔️' }
  }

  if (san.startsWith('=')) {
    return { type: 'promotion', description: 'Promotes a pawn', icon: '⭐' }
  }

  if (san.length >= 2 && san[0] >= 'A' && san[0] <= 'Z') {
    if (san[0] === 'N') {
      if (san.includes('c3') || san.includes('f3') || san.includes('c6') || san.includes('f6')) {
        return { type: 'development', description: 'Develops knight to a natural square', icon: '🐴' }
      }
      return { type: 'development', description: 'Moves knight', icon: '🐴' }
    }
    if (san[0] === 'B') {
      if (san.includes('c4') || san.includes('f4') || san.includes('c5') || san.includes('f5')) {
        return { type: 'development', description: 'Develops bishop — controls the center', icon: '🧭' }
      }
      if (san.includes('b5') || san.includes('g5') || san.includes('b4') || san.includes('g4')) {
        return { type: 'development', description: 'Develops bishop with active aim', icon: '🧭' }
      }
      return { type: 'development', description: 'Moves bishop', icon: '🧭' }
    }
    if (san[0] === 'Q') {
      return { type: 'queen_move', description: 'Moves the queen', icon: '👸' }
    }
    if (san[0] === 'K') {
      return { type: 'king_move', description: 'Moves the king', icon: '👑' }
    }
    if (san[0] === 'R') {
      return { type: 'rook_move', description: 'Moves rook', icon: '🏰' }
    }
  }

  const file = san[0]
  if (file >= 'a' && file <= 'h') {
    if (san.includes('4')) {
      return {
        type: 'development',
        description: 'Advances pawn — fights for the center',
        icon: '♟️',
      }
    }
    if (file === 'g' || file === 'b' || file === 'f' || file === 'c') {
      return {
        type: 'development',
        description: 'Pawn move',
        icon: '♟️',
      }
    }
    return { type: 'pawn_push', description: 'Pawn move', icon: '♟️' }
  }

  return { type: 'unknown', description: 'Move played', icon: '?' }
}
