'use client'

import { motion } from 'framer-motion'
import { Flag } from 'lucide-react'

interface ResignConfirmModalProps {
  onConfirm: () => void
  onCancel: () => void
}

export function ResignConfirmModal({ onConfirm, onCancel }: ResignConfirmModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[80] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <Flag size={28} className="text-red-400" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Resign Game</h2>
        <p className="text-sm text-gray-400 mb-6">Are you sure you want to resign? This cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium text-sm transition-colors"
            style={{ minHeight: '44px' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
            style={{ minHeight: '44px' }}
          >
            Resign
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
