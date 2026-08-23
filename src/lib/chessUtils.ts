import { Chess } from 'chess.js'
import type { PromotionPiece } from '@/features/shared/gameTypes'

export function normalizeUci(uci: string): string {
  return uci.replace(/-/g, '')
}

export function uciToSan(uciMove: string, fen: string, promotion?: PromotionPiece): string {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  
  const normalized = normalizeUci(uciMove)
  const from = normalized.substring(0, 2)
  const to = normalized.substring(2, 4)
  
  for (const move of moves) {
    if (move.from === from && move.to === to) {
      if (promotion) {
        return `${from}${to}=${promotion.toUpperCase()}`
      }
      return move.san
    }
  }
  
  throw new Error(`uciToSan: Move ${uciMove} not found in legal moves from position ${fen}`)
}

export function getMoveFromUci(uciMove: string, fen: string): { from: string; to: string; piece: string } | null {
  const normalized = normalizeUci(uciMove)
  const from = normalized.substring(0, 2)
  const to = normalized.substring(2, 4)
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  const move = moves.find(m => m.from === from && m.to === to)
  
  if (move) {
    const piece = move.piece || chess.get(from as any)?.type || ''
    return { from, to, piece }
  }
  return null
}

/**
 * Probe whether a SAN move is legal in the given position WITHOUT mutating any
 * shared game state (uses a throwaway Chess instance). This is the divergence
 * detector for the resolution pipeline: a pending submission that is illegal at
 * the current turn-start FEN proves client state has diverged and must trigger
 * an authoritative re-sync instead of an engine-level throw.
 */
export function isMoveLegalAt(fen: string, san: string): boolean {
  try {
    new Chess(fen).move(san)
    return true
  } catch {
    // Illegal SAN for this position is a valid probe result, not an error.
    return false
  }
}
