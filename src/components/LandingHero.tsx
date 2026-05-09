'use client'

import { motion } from 'framer-motion'

interface LandingHeroProps {
  onPlayOnline: () => void
  onPlayOffline: () => void
  onGuestPlay: () => void
}

export function LandingHero({ onPlayOnline, onPlayOffline, onGuestPlay }: LandingHeroProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-12 pb-8">
      <div className="mb-6 w-48 h-48 sm:w-56 sm:h-56 bg-gray-800/50 rounded-2xl border border-gray-700/50 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 320 320" className="w-full h-full opacity-80">
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 40}
                y={row * 40}
                width={40}
                height={40}
                fill={(row + col) % 2 === 0 ? '#f0d9b5' : '#b58863'}
              />
            ))
          )}
          <text x="160" y="148" textAnchor="middle" className="text-sm" fill="#f0d9b5" fontSize="48">♟️</text>
          <text x="160" y="190" textAnchor="middle" fill="#b58863" fontSize="48">♞</text>
        </svg>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl font-bold text-center mb-2"
      >
        <span className="text-yellow-400">♟️</span>{' '}
        <span className="text-white">ChessDuo</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-gray-400 text-center mb-2 text-sm sm:text-base"
      >
        2v2 Chess, Reimagined
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-gray-500 text-center text-xs mb-6 max-w-xs"
      >
        Team up. Play together. Win together.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <button
          onClick={onPlayOnline}
          className="px-8 py-3 bg-yellow-500 text-gray-900 font-bold rounded-lg text-base hover:bg-yellow-400 transition-colors shadow-lg shadow-yellow-500/20"
        >
          Play Online
        </button>
        <button
          onClick={onPlayOffline}
          className="px-8 py-3 bg-gray-700 text-white font-bold rounded-lg text-sm hover:bg-gray-600 transition-colors border border-gray-600"
        >
          vs Computer
        </button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onGuestPlay}
        className="mt-3 text-gray-500 hover:text-gray-300 text-xs transition-colors"
      >
        or play as guest →
      </motion.button>
    </div>
  )
}
