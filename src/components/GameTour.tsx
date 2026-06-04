'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react'
import { ChessBoard } from './ChessBoard'
import { AccuracyBottomSheet } from './AccuracyBottomSheet'
import { EvaluatingLoader } from './EvaluatingLoader'
import { useIsMobile } from '@/hooks/useIsMobile'

interface GameTourProps {
  open: boolean
  onComplete: () => void
  onSkip: () => void
}

interface TourStep {
  fen: string
  title: string
  caption: string
  pendingOverlay: any
  myPendingOverlay: any
  highlightSquares: any
  lastMove: any
}

const TOUR_STEPS: TourStep[] = [
  {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    title: 'Your teammate picked a move',
    caption: "Both of you are White. You each choose independently — you don't see each other's choice yet. Here, your teammate moved the knight's pawn from c2 to c4.",
    pendingOverlay: { from: 'c2', to: 'c4', piece: 'p', color: 'white', showTeammateLabel: true },
    myPendingOverlay: null,
    highlightSquares: null,
    lastMove: null,
  },
  {
    fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 1',
    title: 'You picked a move',
    caption: "Now it's your turn. You chose the king's pawn, pushing it two squares from e2 to e4. Two different moves. Two different strategies. Only one will play.",
    pendingOverlay: null,
    myPendingOverlay: { from: 'e2', to: 'e4', piece: 'p', color: 'white' },
    highlightSquares: null,
    lastMove: { from: 'c2', to: 'c4' },
  },
  {
    fen: 'rnbqkbnr/pppppppp/8/8/2P1P3/8/PP1P1PPP/RNBQKBNR w KQkq - 0 1',
    title: 'The engine decides',
    caption: "The engine evaluates both moves blind. Yours (+0.32) beat your teammate's (+0.15). So your move plays on the board, and the losing piece gets pulled back. This is how every turn works.",
    pendingOverlay: null,
    myPendingOverlay: null,
    highlightSquares: { winnerFrom: 'e2', winnerTo: 'e4', loserFrom: 'c2', loserTo: 'c4' },
    lastMove: { from: 'e2', to: 'e4' },
  },
]

const MOCK_COMPARISON = {
  player1Move: 'c4',
  player2Move: 'e4',
  player1Score: 0.15,
  player2Score: 0.32,
  player1Accuracy: 72,
  player2Accuracy: 94,
  player1Loss: 0.17,
  player2Loss: 0,
  player1Category: { label: 'Good', color: '#fbbf24', emoji: '✅' },
  player2Category: { label: 'Best', color: '#34d399', emoji: '👑' },
  winningMove: 'e4',
  winningScore: 0.32,
  isSync: false,
  bestEngineMove: 'e4',
  bestEngineScore: 0.32,
  turnStartFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  winnerId: 'player2',
  loserId: 'player1',
  loserFrom: 'c2',
  loserTo: 'c4',
  alternatives: [],
  youMatchedEngine: true,
  teammateMatchedEngine: false,
}

export function GameTour({ open, onComplete, onSkip }: GameTourProps) {
  const [step, setStep] = useState(0)
  const [showEval, setShowEval] = useState(false)
  const evalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobile = useIsMobile()
  const current = TOUR_STEPS[step]

  useEffect(() => {
    setStep(0)
    setShowEval(false)
    return () => {
      if (evalTimerRef.current) clearTimeout(evalTimerRef.current)
    }
  }, [open])

  const goNext = () => {
    if (step === 2) {
      if (!showEval) {
        setShowEval(true)
        evalTimerRef.current = setTimeout(() => {}, 2000)
        return
      }
      onComplete()
      return
    }
    setShowEval(false)
    setStep(s => s + 1)
  }

  const goPrev = () => {
    if (showEval) {
      setShowEval(false)
      return
    }
    setStep(s => Math.max(0, s - 1))
  }

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-y-auto ${
          isMobile ? 'w-full max-h-[90vh]' : 'max-w-2xl w-full max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-amber-400' : i < step ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 font-medium">
            How it works
          </span>
          <button
            onClick={onSkip}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-4 ${isMobile ? 'p-3' : 'p-4'}`}>
          {/* Board */}
          <div className={`${isMobile ? 'w-full max-w-[300px] mx-auto' : 'w-[320px] flex-shrink-0'} aspect-square`}>
            <ChessBoard
              key={step}
              fen={current.fen}
              onMove={() => {}}
              enabled={false}
              orientation="white"
              pendingOverlay={current.pendingOverlay}
              myPendingOverlay={current.myPendingOverlay}
              highlightSquares={step === 2 && showEval ? current.highlightSquares : null}
              lastMove={current.lastMove}
            />
          </div>

          {/* Content */}
          <div className={`flex-1 flex flex-col justify-center ${isMobile ? 'items-center text-center' : ''}`}>
            {step === 2 && showEval ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full"
                >
                  <AccuracyBottomSheet
                    comparison={MOCK_COMPARISON as any}
                    isVisible={true}
                    playerId="player2"
                    player1Id="player1"
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`step-${step}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {step === 2 && !showEval && (
                    <div className="mb-3">
                      <EvaluatingLoader />
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
                    {current.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {current.caption}
                  </p>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onSkip}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[44px] px-2"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={goPrev}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px]"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
            <button
              onClick={goNext}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-900 text-sm font-bold transition-colors min-h-[44px] shadow-sm"
            >
              {step === 2 && showEval ? (
                <>
                  <CheckCircle2 size={16} />
                  Finish
                </>
              ) : (
                <>
                  {step === 2 ? 'Show Result' : 'Next'}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
