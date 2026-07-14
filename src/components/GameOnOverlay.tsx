'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown } from 'lucide-react'

interface GameOnOverlayProps {
  onComplete: () => void
}

export function GameOnOverlay({ onComplete }: GameOnOverlayProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete()
    }, 1500)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white/95 dark:bg-gray-900/95 flex items-center justify-center z-[60] pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.15, 1, 1.15, 1],
              }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Crown size={64} className="text-amber-400 drop-shadow-[0_0_16px_rgba(251,191,36,0.5)]" />
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-4xl font-black text-amber-400 tracking-wider drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]"
            >
              Game On!
            </motion.h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
