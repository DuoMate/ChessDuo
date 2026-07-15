'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Crown, Pointer, Scale } from 'lucide-react'
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

function PawnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M8 18c0-2.5 1.5-4 4-4s4 1.5 4 4v3H8v-3Z" />
      <path d="M7 14c0-1.5 2-2.5 5-2.5s5 1 5 2.5" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-1 h-3.5 w-3.5 shrink-0 text-slate-600"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

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

  const partnerLabel = isOffline ? 'Botmate' : 'Teammate'

  const steps = [
    {
      word: 'Pick',
      desc: isOffline ? 'You & bot submit moves' : 'Each player submits a move',
      icon: (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-green-500/30 bg-green-500/15 text-green-400 shadow-[0_0_16px_rgba(34,197,94,0.25)]">
          <Pointer size={22} strokeWidth={2} />
        </div>
      ),
    },
    {
      word: 'Compare',
      desc: 'Engine compares both moves',
      icon: (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-400 shadow-[0_0_16px_rgba(96,165,250,0.25)]">
          <Scale size={22} strokeWidth={2} />
        </div>
      ),
    },
    {
      word: 'Play',
      desc: 'Best move gets played',
      icon: (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/15 text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.25)]">
          <PawnIcon className="h-6 w-6" />
        </div>
      ),
    },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="relative w-full max-w-md overflow-y-auto rounded-[32px] border border-slate-700/50 bg-[#0a0e1a] p-6 shadow-2xl max-h-[calc(100vh-2rem)] dark:border-slate-700/50 dark:bg-[#0a0e1a]"
          >
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close"
            >
              <X size={22} />
            </button>

            <div className="mb-5 text-center">
              <div className="flex items-center justify-center gap-0 text-3xl font-black tracking-tight">
                <span className="text-white">Chess</span>
                <span className="relative text-amber-500">
                  Duo
                  <Crown
                    size={18}
                    className="absolute -left-0.5 -top-3.5 text-amber-400"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-400">
                <span className="text-amber-500/80">&#9670;</span>
                <span>How it works</span>
                <span className="text-amber-500/80">&#9670;</span>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
              <div className="relative mx-auto aspect-square w-full max-w-[260px] onboarding-board">
                <ChessBoard
                  fen={TOUR_FEN}
                  onMove={() => {}}
                  enabled={false}
                  orientation="white"
                  highlightSquares={TOUR_HIGHLIGHT}
                  lastMove={TOUR_LAST_MOVE}
                />
                <div
                  className="pointer-events-none absolute z-10"
                  style={{ left: '56.25%', top: '38%', transform: 'translate(-50%, -50%)' }}
                >
                  <span className="inline-block rounded-full bg-green-500/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(34,197,94,0.5)]">
                    You
                  </span>
                </div>
                <div
                  className="pointer-events-none absolute z-10"
                  style={{ left: '31.25%', top: '38%', transform: 'translate(-50%, -50%)' }}
                >
                  <span className="inline-block rounded-full bg-violet-500/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(139,92,246,0.5)]">
                    {partnerLabel}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]" />
                  <span className="text-xs font-semibold text-slate-200">Your Move</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                  <span className="text-xs font-semibold text-slate-200">{partnerLabel}</span>
                </div>
              </div>

              <p className="mt-3 text-center text-sm font-medium leading-relaxed text-slate-300">
                {isOffline
                  ? <>You and your botmate — <span className="font-semibold text-amber-400">the best move wins.</span></>
                  : <>Two players, one board — <span className="font-semibold text-amber-400">the best move wins.</span></>}
              </p>
            </div>

            <div className="mb-5 flex items-stretch justify-between">
              {steps.map((step, index) => (
                <div key={step.word} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center rounded-2xl border border-slate-700/50 bg-slate-800/30 p-3">
                    {step.icon}
                    <span className="mt-2 text-sm font-bold text-white">{step.word}</span>
                    <span className="mt-0.5 text-center text-[10px] leading-tight text-slate-400">{step.desc}</span>
                  </div>
                  {index < steps.length - 1 && <Chevron />}
                </div>
              ))}
            </div>

            <label className="mb-4 flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-0"
              />
              <span className="text-sm text-slate-400">Don&apos;t show this again</span>
            </label>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-base font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-orange-400 active:scale-[0.98]"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
