'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface LeaveConfirmModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function LeaveConfirmModal({ open, onCancel, onConfirm }: LeaveConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-xs w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-2xl"
          >
            <div className="text-center mb-5">
              <div className="text-3xl mb-3">⚠</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Abort Match</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Are you sure?</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Your teammate will be notified and the match will end for both players.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-500 transition-colors"
              >
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
