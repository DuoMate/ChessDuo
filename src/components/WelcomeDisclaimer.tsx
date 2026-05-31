'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Brain, Zap, Crown, XCircle } from 'lucide-react'

interface WelcomeDisclaimerProps {
  open: boolean
  onDismiss: () => void
  storageKey?: string
  mode?: 'online' | 'offline'
}

const onlineCards = [
  {
    icon: Users,
    title: 'Team Up',
    description: (
      <>
        <span className="text-amber-400/90 font-medium">You &amp; your teammate</span> play as{' '}
        <span className="text-white font-semibold">WHITE</span> against a bot opponent.
      </>
    ),
  },
  {
    icon: Brain,
    title: 'Pick Your Move',
    description: 'Each player picks a move independently. Think carefully and choose your best strategy.',
  },
  {
    icon: Zap,
    title: 'Better Move Wins',
    description: 'Your moves are compared by the engine. The stronger move takes the turn — so bring your A-game!',
  },
]

const offlineCards = [
  {
    icon: Users,
    title: 'Team Up',
    description: (
      <>
        <span className="text-amber-400/90 font-medium">You &amp; a bot teammate</span> play as{' '}
        <span className="text-white font-semibold">WHITE</span> against two bot opponents. Your bot teammate plays at the{' '}
        <span className="text-white font-semibold">ELO level</span> you select.
      </>
    ),
  },
  {
    icon: Brain,
    title: 'Pick Your Move',
    description: 'Each turn, you and your bot teammate each pick a move independently. Think carefully!',
  },
  {
    icon: Zap,
    title: 'Better Move Wins',
    description: 'Your moves are compared by the engine. The stronger move is played on the board.',
  },
]

export function WelcomeDisclaimer({ open, onDismiss, storageKey = 'chessduo_welcome_dismissed', mode = 'online' }: WelcomeDisclaimerProps) {
  const [dontShow, setDontShow] = useState(false)
  const cards = mode === 'offline' ? offlineCards : onlineCards

  const handleDismiss = () => {
    if (dontShow) {
      localStorage.setItem(storageKey, 'true')
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
            className="bg-game-surface rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10 shadow-2xl"
          >
            <div className="text-center mb-5">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <Crown size={40} className="mx-auto text-amber-400 mb-2" />
              </motion.div>
              <h2 className="text-2xl font-bold text-amber-400 mb-1 font-game">ChessDuo</h2>
              <p className="text-xs text-gray-500">Play smarter, together</p>
            </div>

            <div className="space-y-3 mb-5">
              {cards.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                >
                  <card.icon size={20} className="text-amber-400/80 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-white font-semibold text-sm">{card.title}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed mt-0.5">{card.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full font-bold">
                  <Crown size={12} /> Winner
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs bg-rose-500/15 text-rose-400 px-2.5 py-1 rounded-full font-bold">
                  <XCircle size={12} /> Loser
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-400 focus:ring-amber-400"
              />
              <span className="text-xs text-gray-500">Don&apos;t show this again</span>
            </label>

            <button
              onClick={handleDismiss}
              className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-900 font-bold text-sm hover:from-amber-400 hover:to-yellow-300 transition-all shadow-lg shadow-amber-500/20"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
