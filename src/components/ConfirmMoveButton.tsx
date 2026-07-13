'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface ConfirmMoveButtonProps {
  visible: boolean
  hasPendingMove: boolean
  onConfirm: () => void
  onCancel?: () => void
  disabled?: boolean
  label?: string
}

export function ConfirmMoveButton({
  visible,
  hasPendingMove,
  onConfirm,
  onCancel,
  disabled,
  label,
}: ConfirmMoveButtonProps) {
  if (!visible) return null

  return (
    <div className="w-full px-3">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        {onCancel && hasPendingMove && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-semibold hover:bg-slate-700/60 transition-colors"
          >
            Cancel
          </button>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onConfirm}
          disabled={disabled || !hasPendingMove}
          className={`flex-1 min-h-[48px] rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
            hasPendingMove && !disabled
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-slate-900 shadow-[var(--shadow-glow-emerald)] hover:from-green-400 hover:to-emerald-400'
              : 'bg-slate-700/40 text-slate-500 border border-slate-700/60 cursor-not-allowed'
          }`}
        >
          <Check size={18} strokeWidth={3} />
          {label || (hasPendingMove ? 'Confirm Move' : 'Make a move first')}
        </motion.button>
      </div>
    </div>
  )
}
