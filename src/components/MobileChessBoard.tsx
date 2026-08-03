'use client'

import { ChessBoard, PendingOverlay, HighlightSquares } from './ChessBoard'
import type { PromotionPiece } from '@/features/shared/gameTypes'

interface MobileChessBoardProps {
  fen: string
  onMove: (move: string, promotion?: PromotionPiece) => void
  enabled?: boolean
  orientation?: 'white' | 'black'
  lastMove?: { from: string; to: string } | null
  pendingOverlay?: PendingOverlay | null
  myPendingOverlay?: PendingOverlay | null
  highlightSquares?: HighlightSquares | null
  onAnimationComplete?: () => void
}

export function MobileChessBoard(props: MobileChessBoardProps) {
  return (
    <div className="touch-manipulation select-none">
      <ChessBoard {...props} />
    </div>
  )
}
