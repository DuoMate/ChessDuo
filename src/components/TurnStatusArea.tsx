'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timeline } from 'animejs'

interface TurnStatusAreaProps {
  state: 'idle' | 'resolving' | 'selected' | 'bot_thinking'
  seconds: number
  isActive: boolean
  totalSeconds: number
  selectedMove?: string | null
  isMobile?: boolean
}

const PIECE_UNICODE: Record<string, string> = {
  k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙',
}

function EvaluatingPulse() {
  const leftRef = useRef<HTMLSpanElement>(null)
  const swordRef = useRef<HTMLSpanElement>(null)
  const rightRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const tlRef = useRef<Timeline | null>(null)

  useEffect(() => {
    const tl = new Timeline({ loop: true, autoplay: true })
    tlRef.current = tl
    tl.add(leftRef.current!, { translateY: [0, -3, 0], scale: [1, 1.08, 1], duration: 1000, easing: 'easeInOutSine' }, 0)
    tl.add(rightRef.current!, { translateY: [0, -3, 0], scale: [1, 1.08, 1], duration: 1000, easing: 'easeInOutSine' }, 250)
    tl.add(swordRef.current!, { rotate: [0, 360], duration: 1800, easing: 'linear' }, 0)
    tl.add(textRef.current!, { opacity: [0.6, 1, 0.6], duration: 2400, easing: 'easeInOutSine' }, 0)
    return () => { tl.pause(); tl.seek(0) }
  }, [])

  return (
    <div className="flex items-center gap-1.5">
      <span ref={leftRef} className="inline-block text-lg select-none"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.25))' }}>
        &#9813;
      </span>
      <span ref={swordRef} className="inline-block text-lg select-none"
        style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.35))' }}>
        &#9876;&#65039;
      </span>
      <span ref={rightRef} className="inline-block text-lg select-none"
        style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.4))' }}>
        &#9819;
      </span>
      <span ref={textRef} className="text-yellow-500 dark:text-yellow-400 text-xs font-medium ml-0.5">
        Evaluating whose move was better
      </span>
    </div>
  )
}

function TimerDisplay({ seconds, isActive, totalSeconds }: { seconds: number; isActive: boolean; totalSeconds: number }) {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const display = `${minutes}:${secs.toString().padStart(2, '0')}`
  const isWarning = isActive && seconds <= 60
  const isCritical = isActive && seconds <= 10
  return (
    <motion.span
      className={`text-xs font-bold font-game ${
        !isActive ? 'text-slate-400 dark:text-slate-500' :
        isCritical ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-slate-400 dark:text-slate-300'
      }`}
      animate={isCritical ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.8, repeat: isCritical ? Infinity : 0 }}
    >
      {display}
    </motion.span>
  )
}

function SelectedMoveBadge({ move }: { move: string }) {
  const pieceChar = move.length >= 2 ? PIECE_UNICODE[move[0]?.toLowerCase()] || '♟' : '♟'

  return (
    <motion.div
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 shadow-sm"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <span className="text-base">{pieceChar}</span>
      <span className="font-mono text-sm font-bold text-amber-800 dark:text-amber-300">
        {move}
      </span>
      <span className="hidden text-xs tracking-wide text-amber-700/70 dark:text-amber-400/70 sm:inline">
        Move locked
      </span>
    </motion.div>
  )
}

function BotThinkingIndicator() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 dark:border-indigo-500/20 dark:bg-indigo-500/10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-300"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
        Bot is thinking...
      </span>
    </motion.div>
  )
}

export function TurnStatusArea({ state, seconds, isActive, totalSeconds, selectedMove, isMobile }: TurnStatusAreaProps) {
  return (
    <div className={`flex items-center justify-center ${isMobile ? 'py-1' : 'py-1.5'}`}>
      <AnimatePresence mode="wait">
        {state === 'resolving' && (
          <motion.div
            key="evaluating"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="rounded-[22px] border border-amber-500/20 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-xl dark:border-amber-500/20 dark:bg-slate-900/70"
          >
            <EvaluatingPulse />
          </motion.div>
        )}
        {state === 'selected' && selectedMove && (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            <SelectedMoveBadge move={selectedMove} />
          </motion.div>
        )}
        {state === 'bot_thinking' && (
          <motion.div
            key="bot"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            <BotThinkingIndicator />
          </motion.div>
        )}
        {state === 'idle' && (
          <motion.div
            key="timer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TimerDisplay seconds={seconds} isActive={isActive} totalSeconds={totalSeconds} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
