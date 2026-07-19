'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'

interface ConfirmMoveBarProps {
  visible: boolean
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
}

export function ConfirmMoveBar({ visible, onConfirm, onCancel, disabled }: ConfirmMoveBarProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed left-0 right-0 z-40 flex justify-center px-3 pointer-events-none"
          style={{ bottom: 'calc(56px + max(12px, env(safe-area-inset-bottom, 12px)))' }}
        >
          <div className="relative flex w-full max-w-md items-center justify-center min-h-[56px] rounded-t-2xl bg-gradient-to-r from-emerald-500 to-green-500 shadow-[0_4px_24px_rgba(16,185,129,0.35)] pointer-events-auto">
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className="flex items-center justify-center gap-2 w-full min-h-[56px] text-white font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Confirm move"
            >
              <Check size={22} strokeWidth={3} />
              <span className="text-base font-bold tracking-tight">Confirm Move</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
              aria-label="Cancel move"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
