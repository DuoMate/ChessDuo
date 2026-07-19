'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Crown, Pointer, Scale, Loader2 } from 'lucide-react'
import { ChessBoard } from '@/components/ChessBoard'
import { BackButton } from '@/components/BackButton'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

const TOUR_FEN = 'rnbqkbnr/pppppppp/8/8/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq - 0 1'
const TOUR_HIGHLIGHT = { winnerFrom: 'e2', winnerTo: 'e4', loserFrom: 'c2', loserTo: 'c4' }
const TOUR_LAST_MOVE = { from: 'e2', to: 'e4' }

function PawnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M8 18c0-2.5 1.5-4 4-4s4 1.5 4 4v3H8v-3Z" />
      <path d="M7 14c0-1.5 2-2.5 5-2.5s5 1 5 2.5" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-1 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export default function WelcomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = (searchParams.get('mode') || 'online') as 'online' | 'offline'
  const [dontShow, setDontShow] = useState(false)
  const [navigating, setNavigating] = useState(false)

  const isOffline = mode === 'offline'
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

  useCapacitorBackButton(() => { router.push('/'); return true }, true)

  const handleDismiss = () => {
    if (navigating) return
    setNavigating(true)
    if (dontShow) {
      localStorage.setItem('chessduo_welcome_dismissed', 'true')
    }

    if (mode === 'offline') {
      // Redirect directly to game — no home page detour
      const pending = localStorage.getItem('chessduo_pending_offline_game')
      localStorage.removeItem('chessduo_pending_offline_game')
      if (pending) {
        try {
          const { level, time, color } = JSON.parse(pending)
          const colorParam = color ? `&color=${color}` : ''
          router.push(`/game?level=${level}&time=${time}${colorParam}`)
          return
        } catch { /* fall through */ }
      }
    }
    // For online: keep pending_online_game in localStorage — home page will use it
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col items-center justify-center p-4 pb-20">
      <div className="w-full max-w-md mb-4 flex justify-start">
        <BackButton label="Skip" alwaysFallback />
      </div>

      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="relative w-full max-w-md overflow-y-auto rounded-[32px] border border-slate-700/50 bg-[#0a0e1a] p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="mb-5 text-center">
          <div className="flex items-center justify-center gap-0 text-3xl font-black tracking-tight">
            <span className="text-white">Chess</span>
            <span className="relative text-blue-500">
              Duo
              <Crown size={18} className="absolute -left-0.5 -top-3.5 text-blue-400" fill="currentColor" strokeWidth={0} />
            </span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-400">
            <span className="text-blue-400/70">&#9670;</span>
            <span>How it works</span>
            <span className="text-blue-400/70">&#9670;</span>
          </div>
        </div>

        {/* Board */}
        <div className="mb-5 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div className="relative mx-auto aspect-square w-full max-w-[260px] onboarding-board">
            <ChessBoard fen={TOUR_FEN} onMove={() => {}} enabled={false} orientation="white" highlightSquares={TOUR_HIGHLIGHT} lastMove={TOUR_LAST_MOVE} />
            <div className="pointer-events-none absolute z-10" style={{ left: '56.25%', top: '38%', transform: 'translate(-50%, -50%)' }}>
              <span className="inline-block rounded-full bg-green-500/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(34,197,94,0.5)]">You</span>
            </div>
            <div className="pointer-events-none absolute z-10" style={{ left: '31.25%', top: '38%', transform: 'translate(-50%, -50%)' }}>
              <span className="inline-block rounded-full bg-violet-500/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(139,92,246,0.5)]">{partnerLabel}</span>
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

        {/* Steps */}
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

        {/* Don't show again */}
        <label className="mb-4 flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-0" />
          <span className="text-sm text-slate-400">Don&apos;t show this again</span>
        </label>

        {/* Got it */}
        <button
          type="button"
          onClick={handleDismiss}
          disabled={navigating}
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-base font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {navigating ? <Loader2 size={18} className="animate-spin" /> : 'Got it!'}
        </button>
      </motion.div>
    </div>
  )
}
