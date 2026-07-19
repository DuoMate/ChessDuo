'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'

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
          className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-3 pointer-events-none"
        >
          <div className="flex w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 shadow-[0_8px_32px_rgba(2,6,23,0.12)] backdrop-blur-xl dark:border-slate-700/50 dark:bg-[#0a0e1a]/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] pointer-events-auto">
            <button
              type="button"
              onClick={onCancel}
              className="flex flex-1 items-center justify-center gap-2 min-h-[56px] rounded-l-2xl text-rose-600 transition-colors hover:bg-rose-50 active:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:active:bg-rose-500/20"
              aria-label="Cancel move"
            >
              <X size={20} strokeWidth={2.5} />
              <span className="text-sm font-bold">Cancel</span>
            </button>
            <div className="w-px bg-slate-200/60 dark:bg-slate-700/50" />
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className="flex flex-1 items-center justify-center gap-2 min-h-[56px] rounded-r-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-slate-900 font-bold transition-all hover:from-green-400 hover:to-emerald-400 active:from-green-600 active:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Confirm move"
            >
              <Check size={20} strokeWidth={3} />
              <span className="text-sm font-bold">Confirm Move</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
