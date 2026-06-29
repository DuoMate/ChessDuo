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
    title: 'Better Move Plays',
    description: 'Each of you picks a move — the engine compares them and the stronger one (yours or your teammate\'s) takes the turn.',
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
    title: 'Better Move Plays',
    description: 'Both you and your bot teammate pick a move — the engine plays the stronger one on the board.',
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="mx-auto max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_90px_rgba(2,6,23,0.25)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/85"
          >
            <div className="text-center mb-5">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <Crown size={40} className="mx-auto mb-2 text-amber-500" />
              </motion.div>
              <h2 className="mb-1 text-2xl font-bold font-game text-amber-600 dark:text-amber-400">ChessDuo</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Play smarter, together</p>
            </div>

            <div className="space-y-3 mb-5">
              {cards.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  className="flex gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70"
                >
                  <card.icon size={20} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{card.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{card.description}</p>
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
                className="w-4 h-4 rounded border-slate-400 bg-slate-600 text-amber-400 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-xs text-slate-500">Don&apos;t show this again</span>
            </label>

            <button
              onClick={handleDismiss}
              className="w-full min-h-[44px] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
