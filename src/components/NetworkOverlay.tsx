'use client'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'

export function NetworkOverlay() {
  const { online } = useNetworkStatus()

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-red-500 dark:bg-red-600 text-white py-2 px-4 text-sm font-medium shadow-lg"
        >
          <WifiOff size={16} />
          No internet connection
        </motion.div>
      )}
    </AnimatePresence>
  )
}
