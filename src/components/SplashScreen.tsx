'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface SplashScreenProps {
  isVisible: boolean
  onComplete?: () => void
}

export function SplashScreen({ isVisible, onComplete }: SplashScreenProps) {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 overflow-hidden"
        >
          <div className="absolute inset-0 z-0 opacity-20">
            <div className="w-full h-full bg-gradient-to-b from-yellow-500/10 via-transparent to-yellow-500/5" />
          </div>

          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-[120px]" />

          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl">
            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-5xl font-extrabold italic text-yellow-400 tracking-tighter"
                style={{ textShadow: '0 0 15px rgba(234,179,8,0.4)' }}
              >
                ChessDuo
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-[0.2em]"
              >
                Team Chess. Simultaneous Moves. One Winner.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="text-6xl text-yellow-400 mb-2 animate-pulse">♟️</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-8 w-64 flex flex-col items-center"
            >
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-yellow-400 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeOut' }}
                  style={{ filter: 'drop-shadow(0 0 6px rgba(234,179,8,0.5))' }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Initializing Game...
              </span>
            </motion.div>
          </div>

          <div className="absolute bottom-4 left-0 right-0 flex justify-between items-center px-6 opacity-30">
            <span className="text-[10px] font-bold text-gray-500 tracking-wider">ChessDuo</span>
            <span className="material-symbols-outlined text-yellow-400/50 text-sm">verified</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
