'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface PendingOverlayData {
  from: string
  to: string
  piece: string
  color: string
}

interface PendingMoveOverlayProps {
  overlay: PendingOverlayData | null
}

export function PendingMoveOverlay({ overlay }: PendingMoveOverlayProps) {
  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        >
          <div className={`px-6 py-3 rounded-full backdrop-blur-md border-2 ${
            overlay.color === 'white' 
              ? 'bg-blue-900/80 border-blue-400' 
              : 'bg-red-900/80 border-red-400'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {overlay.color === 'white' ? '🔵' : '🔴'}
              </span>
              <div className="text-white">
                <span className="font-semibold">
                  {overlay.color === 'white' ? 'Teammate' : 'Opponent'}
                </span>
                <span className="text-gray-300 ml-2">
                  moved {overlay.from} → {overlay.to}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}