'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Volume2, VolumeX, Flag, Crown } from 'lucide-react'
import { ChessBoard } from '../ChessBoard'
import type { PromotionPiece } from '@/features/shared/gameTypes'
import { CoachGame as CoachGameEngine, coachVoice, saveCoachGame } from '@/features/coach'
import type { CoachGameState } from '@/features/coach'
import { CoachPanel } from './CoachPanel'
import { useGameToast } from '../Toast'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSettings } from '@/hooks/useSettings'
import { playMoveSound, playCaptureSound } from '@/lib/sounds'

interface CoachGameProps {
  playerId: string
  playerColor: 'white' | 'black'
  botLevel?: number
  onLeave: () => void
}

function resultToOutcome(result: string | null): 'win' | 'loss' | 'draw' {
  if (!result) return 'draw'
  if (result.startsWith('Win')) return 'win'
  if (result.startsWith('Loss')) return 'loss'
  return 'draw'
}

export function CoachGame({ playerId, playerColor, botLevel = 3, onLeave }: CoachGameProps) {
  const toast = useGameToast()
  const isMobile = useIsMobile()
  const settings = useSettings()
  const [state, setState] = useState<CoachGameState | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(coachVoice.isEnabled())
  const [showLeave, setShowLeave] = useState(false)
  const gameRef = useRef<CoachGameEngine | null>(null)
  const spokenFeedbackKeyRef = useRef<string | null>(null)
  const savedRef = useRef(false)

  const status = state?.status ?? 'idle'
  const isPlayerTurn = !!state && state.turn === state.playerColor && state.status === 'playing'
  const boardEnabled = isPlayerTurn && !state?.analyzing

  useEffect(() => {
    const game = new CoachGameEngine({ playerColor: playerColor === 'black' ? 'b' : 'w', botLevel })
    gameRef.current = game
    const unsub = game.onStateChange(setState)
    game.start()
    return () => {
      unsub()
      game.destroy()
      coachVoice.stop()
    }
    // Constructed once per mount — color/level are fixed at route entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Speak newly-arrived coaching feedback when voice is enabled.
  useEffect(() => {
    if (!state?.feedback) return
    const key = `${state.feedback.playerMoveSan}-${state.feedback.verdict}-${state.feedback.centipawnLoss ?? ''}`
    if (spokenFeedbackKeyRef.current === key) return
    spokenFeedbackKeyRef.current = key
    if (coachVoice.isEnabled()) {
      coachVoice.speak(state.feedback.explanation)
    }
  }, [state?.feedback])

  // Persist on game over (premium + signed-in; save is a no-op for guests).
  useEffect(() => {
    if (state?.status !== 'game_over' || savedRef.current) return
    savedRef.current = true
    saveCoachGame({
      player_id: playerId,
      result: resultToOutcome(state.result),
      player_color: playerColor,
      bot_level: botLevel,
      fen: state.fen,
      move_history: state.moveHistory,
      blunders: state.blunders,
      mistakes: state.mistakes,
      accuracy: state.accuracy,
    }).catch(() => {
      // Persistence is best-effort; never block the game-over screen.
    })
  }, [state?.status, state?.result, state?.fen, state?.moveHistory, state?.blunders, state?.mistakes, state?.accuracy, playerId, playerColor, botLevel])

  const handleMove = useCallback(
    (move: string, promotion?: PromotionPiece) => {
      const game = gameRef.current
      if (!game) return
      const parts = move.split('-')
      if (parts.length !== 2) return
      game.applyPlayerMove(parts[0], parts[1], promotion).then((feedback) => {
        if (!feedback) return
        if (settings.soundEnabled) {
          if (feedback.playerMoveSan.includes('x')) playCaptureSound()
          else playMoveSound()
        }
      })
    },
    [settings.soundEnabled],
  )

  const toggleVoice = () => {
    if (!coachVoice.isSupported()) {
      toast.warning('Voice coaching is not available on this device')
      return
    }
    const next = !voiceEnabled
    coachVoice.setEnabled(next)
    setVoiceEnabled(next)
  }

  useNavigationGuard({
    enabled: status === 'playing',
    onAttemptLeave: () => setShowLeave(true),
  })

  useCapacitorBackButton(
    () => {
      if (status === 'playing') {
        setShowLeave(true)
      } else {
        onLeave()
      }
      return true
    },
    true,
  )

  const orientation = playerColor === 'black' ? 'black' : 'white'

  return (
    <div className="min-h-dvh bg-[var(--color-page-bg)] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 pt-4">
        <button
          onClick={() => (status === 'playing' ? setShowLeave(true) : onLeave())}
          aria-label="Back to home"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-amber-400" />
          <h1 className="text-base font-black uppercase tracking-[0.15em] text-slate-900 dark:text-white">Coach</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleVoice}
            aria-label="Toggle voice coaching"
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors ${voiceEnabled ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          {status === 'playing' && (
            <button
              onClick={() => gameRef.current?.resign()}
              aria-label="Resign"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-rose-400 transition-colors hover:text-rose-500"
            >
              <Flag size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Board + coach panel */}
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-8 pt-3">
        <div className="mx-auto w-full max-w-[min(95vw,80vh,560px)]">
          <ChessBoard
            fen={state?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
            onMove={handleMove}
            enabled={boardEnabled}
            orientation={orientation}
            lastMove={state?.lastMove}
          />
        </div>

        <CoachPanel
          suggestion={state?.suggestion ?? null}
          feedback={state?.feedback ?? null}
          analyzing={!!state?.analyzing}
          isPlayerTurn={isPlayerTurn}
          onSpeak={(text) => coachVoice.speak(text)}
        />
      </div>

      {/* Leave confirmation */}
      {showLeave && status === 'playing' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900 p-5 text-center">
            <h2 className="text-lg font-bold text-white">Leave the game?</h2>
            <p className="mt-1 text-xs text-slate-400">Your coach session will end.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowLeave(false)}
                className="min-h-[44px] flex-1 rounded-xl bg-slate-800 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700"
              >
                Keep Playing
              </button>
              <button
                onClick={onLeave}
                className="min-h-[44px] flex-1 rounded-xl bg-rose-600 text-sm font-bold text-white transition-colors hover:bg-rose-500"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game over */}
      {status === 'game_over' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/60 bg-slate-900 p-6 text-center">
            <div className="mb-2 text-4xl">{state?.result?.startsWith('Win') ? '🏆' : state?.result?.startsWith('Draw') ? '🤝' : '♟️'}</div>
            <h2 className="text-xl font-black text-white">{state?.result ?? 'Game over'}</h2>
            {state && (
              <p className="mt-2 text-xs text-slate-400">
                Accuracy {state.accuracy}% · Blunders {state.blunders} · Mistakes {state.mistakes}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={onLeave}
                className="min-h-[44px] w-full rounded-xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-500"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile spacer hint — keep layout consistent with board pages */}
      {isMobile && <div className="h-4" />}
    </div>
  )
}
