'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'

interface ErrorDetailModalProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  details?: string
}

export function ErrorDetailModal({ open, onClose, title, message, details }: ErrorDetailModalProps) {
  const [showDetails, setShowDetails] = useState(false)

  useEscapeKey(onClose, open)
  useScrollLock(open)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 max-h-[90svh] overflow-y-auto border border-gray-200 dark:border-slate-700 shadow-2xl"
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-red-500 dark:text-red-400 font-bold">×</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">{message}</p>
            </div>

            {details && (
              <div className="mb-4">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition-colors min-h-[44px] flex items-center justify-center gap-1 font-medium"
                >
                  <span>{showDetails ? '▾' : '▸'}</span>
                  Technical Details
                </button>
                {showDetails && (
                  <pre className="mt-2 p-3 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 text-xs text-gray-600 dark:text-slate-400 font-mono overflow-auto max-h-32 whitespace-pre-wrap break-all">
                    {details}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
