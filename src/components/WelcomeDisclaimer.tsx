'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown } from 'lucide-react'
import { ChessBoard } from './ChessBoard'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'

interface OnboardingOverlayProps {
  open: boolean
  onDismiss: () => void
  storageKey?: string
  mode?: 'online' | 'offline'
}

const TOUR_FEN = 'rnbqkbnr/pppppppp/8/8/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq - 0 1'
const TOUR_HIGHLIGHT = { winnerFrom: 'e2', winnerTo: 'e4', loserFrom: 'c2', loserTo: 'c4' }
const TOUR_LAST_MOVE = { from: 'e2', to: 'e4' }

export function WelcomeDisclaimer({ open, onDismiss, storageKey = 'chessduo_welcome_dismissed', mode = 'online' }: OnboardingOverlayProps) {
  const [dontShow, setDontShow] = useState(false)
  const isOffline = mode === 'offline'

  useEscapeKey(onDismiss, open)
  useScrollLock(open)

  const handleDismiss = () => {
    if (dontShow) {
      localStorage.setItem(storageKey, 'true')
    }
    onDismiss()
  }

  const steps = [
    { emoji: '\uD83D\uDC46', word: 'Pick', desc: isOffline ? 'You & bot' : 'Each player' },
    { emoji: '\u2696', word: 'Compare', desc: 'Engine decides' },
    { emoji: '\u265F', word: 'Play', desc: 'Best move wins' },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="mx-auto max-h-[95vh] w-full max-w-sm overflow-y-auto rounded-[30px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_90px_rgba(2,6,23,0.25)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/85"
          >
            <div className="text-center mb-3">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <Crown size={32} className="mx-auto mb-1 text-amber-500" />
              </motion.div>
              <h2 className="text-xl font-bold font-game text-amber-600 dark:text-amber-400">ChessDuo</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">How it works</p>
            </div>

            <div className="mb-4 flex justify-center">
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <ChessBoard
                  fen={TOUR_FEN}
                  onMove={() => {}}
                  enabled={false}
                  orientation="white"
                  highlightSquares={TOUR_HIGHLIGHT}
                  lastMove={TOUR_LAST_MOVE}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Your Move</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 bg-blue-400/20" />
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{isOffline ? 'Bot' : 'Teammate'}</span>
              </div>
            </div>

            <p className="text-center text-[12px] leading-relaxed font-medium text-slate-600 dark:text-slate-300 mb-4">
              {isOffline
                ? 'You and your botmate each pick a move.\nThe best one plays on the board.'
                : 'Two players, one board \u2014 the best move wins.'}
            </p>

            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {steps.map((step) => (
                <div
                  key={step.word}
                  className="flex flex-col items-center rounded-2xl border border-slate-200/70 bg-slate-50/80 p-2 dark:border-slate-700/70 dark:bg-slate-800/70"
                >
                  <span className="text-lg mb-0.5">{step.emoji}</span>
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white">{step.word}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight text-center">{step.desc}</span>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="w-4 h-4 rounded border-slate-400 bg-slate-600 text-amber-400 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">Don&apos;t show this again</span>
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
