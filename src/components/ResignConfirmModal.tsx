'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Flag } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'
import { MODAL_SPRING, MODAL_BACKDROP } from './modalConstants'

interface ResignConfirmModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ResignConfirmModal({ open, onConfirm, onCancel }: ResignConfirmModalProps) {
  useEscapeKey(onCancel, open)
  useScrollLock(open)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 ${MODAL_BACKDROP} flex items-center justify-center z-[80] p-4`}
          onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={MODAL_SPRING}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-sm p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                <Flag size={28} className="text-red-500 dark:text-red-400" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Resign Game</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Are you sure you want to resign? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-white font-medium text-sm transition-colors min-h-[44px]">
                Cancel
              </button>
              <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors min-h-[44px]">
                Resign
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
