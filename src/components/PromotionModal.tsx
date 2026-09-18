'use client'

import { motion } from 'framer-motion'
import type { PromotionPiece } from '@/features/shared/gameTypes'
import { MODAL_SPRING, MODAL_BACKDROP } from './modalConstants'

export interface PromotionOption {
  piece: PromotionPiece
  symbol: string
  label: string
}

export const PROMOTION_OPTIONS: PromotionOption[] = [
  { piece: 'q', symbol: '♛', label: 'Queen' },
  { piece: 'r', symbol: '♜', label: 'Rook' },
  { piece: 'b', symbol: '♝', label: 'Bishop' },
  { piece: 'n', symbol: '♞', label: 'Knight' },
]

interface PromotionModalProps {
  options?: PromotionOption[]
  onSelect: (piece: PromotionPiece) => void
}

/**
 * Shared pawn-promotion picker (2v2 + duel).
 * Single source of truth — previously duplicated inline in Game/DuelGame.
 * Presentation only: promotion legality + move application stay with callers.
 */
export function PromotionModal({ options = PROMOTION_OPTIONS, onSelect }: PromotionModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 ${MODAL_BACKDROP} flex items-center justify-center z-50 p-4`}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={MODAL_SPRING}
        className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg border-2 border-yellow-500 shadow-xl max-w-[calc(100vw-2rem)]"
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">Promote Pawn</h3>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
          {options.map(({ piece, symbol, label }) => (
            <button
              key={piece}
              onClick={() => onSelect(piece)}
              aria-label={`Promote to ${label}`}
              className="focus-ring flex flex-col items-center px-2 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg border border-gray-300 dark:border-gray-500 transition-colors min-h-[44px] min-w-[44px]"
            >
              <span className="text-4xl text-gray-900 dark:text-white mb-1">{symbol}</span>
              <span className="text-xs text-gray-500 dark:text-gray-300">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
