'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface WelcomeDisclaimerProps {
  open: boolean
  onDismiss: () => void
}

export function WelcomeDisclaimer({ open, onDismiss }: WelcomeDisclaimerProps) {
  const [dontShow, setDontShow] = useState(false)

  const handleDismiss = () => {
    if (dontShow) {
      localStorage.setItem('chessduo_welcome_dismissed', 'true')
    }
    onDismiss()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 border border-gray-700 shadow-2xl"
          >
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">&#9813;</div>
              <h2 className="text-xl font-bold text-yellow-400 mb-3">ChessDuo</h2>

              <div className="space-y-2 text-sm text-gray-300 text-left bg-gray-900/50 rounded-xl p-4 mb-4">
                <p>
                  <span className="text-yellow-400/80 font-medium">You &amp; your teammate</span> play as{' '}
                  <span className="text-white font-semibold">WHITE</span> against a bot opponent.
                </p>
                <p>
                  Each player picks a move independently. The better move wins the turn.
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    Winner
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Loser
                  </span>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-yellow-400 focus:ring-yellow-400"
              />
              <span className="text-xs text-gray-400">Don&apos;t show this again</span>
            </label>

            <button
              onClick={handleDismiss}
              className="w-full min-h-[44px] rounded-xl bg-yellow-500 text-gray-900 font-bold text-sm hover:bg-yellow-400 transition-colors"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
