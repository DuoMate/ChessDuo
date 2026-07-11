'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChessBoard, PromotionPiece } from './ChessBoard'
import { MobileChessBoard } from './MobileChessBoard'
import { DuelGame as DuelGameEngine } from '@/lib/duelGame'
import { MatchTimer } from './MatchTimer'
import { GameOverModal } from './GameOverModal'
import { useIsMobile } from '@/hooks/useIsMobile'
import { BottomNav } from './BottomNav'
import { Team } from '@/features/game-engine/gameState'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords } from 'lucide-react'
import { GameMenu } from './GameMenu'

const duelBoardStyle = { maxWidth: 'min(100vw - 2rem, calc(100vh - 7rem), 650px)' } as const
import { SettingsPanel } from './SettingsPanel'
import { ResignConfirmModal } from './ResignConfirmModal'
import { LeaveConfirmModal } from './LeaveConfirmModal'
import { useSettings } from '@/lib/settings'
import { saveCompletedGame } from '@/lib/matchHistory'
import { supabase } from '@/lib/supabase'
import { useGameToast } from './Toast'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'

interface DuelGameProps {
  roomId: string
  roomCode: string
  playerId: string
  team: 'WHITE' | 'BLACK'
  timeLimit: number
  onLeave: () => void
}

export function DuelGame({ roomId, roomCode, playerId, team, timeLimit, onLeave }: DuelGameProps) {
  const isMobile = useIsMobile()
  const router = useRouter()
  const settings = useSettings()
  const toast = useGameToast()
  const [showSettings, setShowSettings] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showGameOverDismissed, setShowGameOverDismissed] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('soundEnabled') !== 'false'
  })
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [status, setStatus] = useState<'waiting' | 'playing' | 'game_over'>('waiting')
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w')
  const [whiteTime, setWhiteTime] = useState(timeLimit)
  const [blackTime, setBlackTime] = useState(timeLimit)
  const [timerActive, setTimerActive] = useState(false)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [winner, setWinner] = useState<'white' | 'black' | 'draw' | null>(null)
  const [gameResult, setGameResult] = useState<string | null>(null)
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [moveAccuracy, setMoveAccuracy] = useState<number | null>(null)
  const [opponentAccuracy, setOpponentAccuracy] = useState<number | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [waiting, setWaiting] = useState(true)
  const [opponentUsername, setOpponentUsername] = useState('Opponent')
  const gameRef = useRef<DuelGameEngine | null>(null)
  const accuracyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const moveEntriesRef = useRef<Array<{ accuracy: number; fenAfter: string }>>([])
  const moveAccuracyRef = useRef<number | null>(null)
  const opponentAccuracyRef = useRef<number | null>(null)

  const showAccuracy = moveAccuracy !== null || opponentAccuracy !== null

  const { confirmLeave: confirmNavLeave } = useNavigationGuard({
    enabled: status === 'playing',
    onAttemptLeave: () => setShowLeaveModal(true),
  })

  useEffect(() => {
    const game = new DuelGameEngine(roomId, playerId, team, timeLimit)
    gameRef.current = game

    game.setOnStateChange((state) => {
      setFen(state.fen)
      setStatus(state.status)
      setCurrentTurn(state.currentTurn)
      setWhiteTime(state.whiteTimeRemaining)
      setBlackTime(state.blackTimeRemaining)
      setTimerActive(state.matchTimerActive)
      setLastMove(state.lastMove)
      setWinner(state.winner)
      setGameResult(state.gameResult)
      setMoveHistory(state.moveHistory)
      if (state.moveAccuracy !== null) {
        setMoveAccuracy(state.moveAccuracy)
        moveAccuracyRef.current = state.moveAccuracy
      }
      if (state.opponentAccuracy !== null) {
        setOpponentAccuracy(state.opponentAccuracy)
        opponentAccuracyRef.current = state.opponentAccuracy
      }
      if (state.status === 'playing') setWaiting(false)
    })

    game.join()

    return () => { game.destroy() }
  }, [roomId, playerId, team, timeLimit])

  const clearAccuracyTimer = useCallback(() => {
    if (accuracyTimeoutRef.current) {
      clearTimeout(accuracyTimeoutRef.current)
      accuracyTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (showAccuracy) {
      clearAccuracyTimer()
      accuracyTimeoutRef.current = setTimeout(() => {
        setMoveAccuracy(null)
        setOpponentAccuracy(null)
      }, 3000)
    }
    return () => clearAccuracyTimer()
  }, [showAccuracy, clearAccuracyTimer])

  useEffect(() => {
    if (status !== 'playing') return
    const game = gameRef.current
    if (!game) return
    const opp = team === 'WHITE' ? game.blackPlayer : game.whitePlayer
    if (!opp?.id) return
    supabase
      .from('profiles')
      .select('username')
      .eq('id', opp.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username) setOpponentUsername(data.username)
      }).catch(() => {})
  }, [status, team])

  // Save completed duel games to history
  const gameSavedRef = useRef(false)
  useEffect(() => {
    if (status !== 'game_over' || !winner || gameSavedRef.current) return
    gameSavedRef.current = true
    setShowGameOverDismissed(false)

    const winningSide = winner === 'white' ? 'WHITE' : winner === 'black' ? 'BLACK' : 'DRAW'
    saveCompletedGame({
      winner: winningSide,
      gameResult: gameResult || 'Game Over',
      gameOverReason: gameResult || null,
      stats: {
        whiteMovesPlayed: moveHistory.length,
        whiteSyncRate: 1.0,
        whiteConflicts: 0,
        player1Accuracy: moveAccuracyRef.current ?? 0,
        player2Accuracy: opponentAccuracyRef.current ?? 0,
        totalMoves: moveHistory.length,
      },
      isOnline: true,
      roomId,
      moveComparisons: moveHistory.map((move, i) => {
        const entry = moveEntriesRef.current[i]
        return {
          turn: i + 1,
          team: i % 2 === 0 ? 'WHITE' : 'BLACK',
          winningMove: move,
          winningMoveUci: move,
          isSync: true,
          player1Accuracy: entry?.accuracy ?? 0,
          player2Accuracy: 0,
          fenAfter: entry?.fenAfter ?? '',
        }
      }),
    }, playerId)
    toast.gameOver(gameResult || 'Game Over')
  }, [status, winner, gameResult, moveHistory, moveAccuracy, opponentAccuracy, roomId])

  const captureMoveEntry = useCallback((accuracy: number) => {
    const fenAfter = gameRef.current?.fen
    if (fenAfter) {
      moveEntriesRef.current = [...moveEntriesRef.current, { accuracy, fenAfter }]
    }
  }, [])

  const handleMove = useCallback(async (uci: string, promotion?: PromotionPiece) => {
    const game = gameRef.current
    if (!game) return

    if (promotion) {
      if (settings.autoQueen) {
        const result = await game.makeMove(uci.replace('-', '') + 'q')
        if (result.success && result.accuracy !== undefined) {
          setMoveAccuracy(result.accuracy)
          captureMoveEntry(result.accuracy)
        }
        return
      }
      const [from, to] = uci.split('-')
      setPendingPromotion({ from, to })
      return
    }

    const result = await game.makeMove(uci.replace('-', ''))
    if (result.success && result.accuracy !== undefined) {
      setMoveAccuracy(result.accuracy)
      captureMoveEntry(result.accuracy)
    }
  }, [settings.autoQueen, captureMoveEntry])

  const handlePromotionSelect = useCallback(async (piece: PromotionPiece) => {
    if (!pendingPromotion) return
    const { from, to } = pendingPromotion
    setPendingPromotion(null)
    const uci = from + to + piece
    const game = gameRef.current
    if (!game) return
    const result = await game.makeMove(uci)
    if (result.success && result.accuracy !== undefined) {
      setMoveAccuracy(result.accuracy)
      captureMoveEntry(result.accuracy)
    }
  }, [pendingPromotion, captureMoveEntry])

  const isMyTurn = status === 'playing' && ((currentTurn === 'w' && team === 'WHITE') || (currentTurn === 'b' && team === 'BLACK'))

  if (waiting) {
    return (
      <div className={`min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 ${isMobile ? 'pb-16' : ''}`}>
        {/* Mobile status bar removed - redundant */}
        <div className="text-center space-y-4">
          <div className="animate-pulse text-5xl flex justify-center">
            <Swords size={48} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Waiting for opponent...</h1>
          <p className="text-gray-500 dark:text-gray-400">Share this room code with your friend:</p>
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl p-4">
            <p className="text-3xl font-bold tracking-widest font-mono text-amber-500 dark:text-amber-400">{roomCode}</p>
          </div>
          <p className="text-gray-500 text-sm">The game starts when your opponent joins</p>
          <button
            onClick={onLeave}
            className="mt-4 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col p-4 ${isMobile ? 'pb-16 pt-14' : ''}`}>
      <div className="max-w-xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold flex items-center gap-1.5">
            <Swords size={18} className="text-amber-600 dark:text-amber-400" /> Duel
          </h1>
          <GameMenu
            onResign={status !== 'game_over' ? () => setShowResignConfirm(true) : undefined}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>

        <div className="flex items-center justify-between mb-2">
            <span className={`text-xs md:text-sm font-semibold ${team === 'WHITE' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              {team === 'WHITE' ? 'You (White)' : `${opponentUsername} (White)`}
            </span>
            <div className="flex items-center gap-3">
              <span className={`font-mono font-bold ${currentTurn === 'w' && timerActive ? 'text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {Math.floor(whiteTime / 60)}:{(whiteTime % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-gray-400 dark:text-gray-500">vs</span>
              <span className={`font-mono font-bold ${currentTurn === 'b' && timerActive ? 'text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {Math.floor(blackTime / 60)}:{(blackTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <span className={`text-xs md:text-sm font-semibold ${team === 'BLACK' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              {team === 'BLACK' ? 'You (Black)' : `${opponentUsername} (Black)`}
          </span>
        </div>

        <div className="relative w-full mx-auto aspect-square mb-2" style={duelBoardStyle}>
          <div className="absolute inset-0">
            {isMobile ? (
              <MobileChessBoard
                fen={fen}
                onMove={handleMove}
                enabled={isMyTurn && !pendingPromotion}
                orientation={team === 'WHITE' ? 'white' : 'black'}
                lastMove={lastMove}
              />
            ) : (
              <ChessBoard
                fen={fen}
                onMove={handleMove}
                enabled={isMyTurn && !pendingPromotion}
                orientation={team === 'WHITE' ? 'white' : 'black'}
                lastMove={lastMove}
              />
            )}
          </div>
        </div>

        <AnimatePresence>
          {showAccuracy && (
            <motion.div
              key={moveAccuracy !== null ? 'my' : 'opp'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mb-2"
            >
              <span className={`text-sm font-semibold ${moveAccuracy !== null ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}>
                {moveAccuracy !== null ? `Your move: ${moveAccuracy}% accuracy` : `Opponent move: ${opponentAccuracy}% accuracy`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {pendingPromotion && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-game-surface p-6 rounded-lg border border-gray-200 dark:border-white/10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">Promote Pawn</h3>
              <div className="flex gap-3 md:gap-4">
                {(['q', 'r', 'b', 'n'] as PromotionPiece[]).map((piece) => (
                  <button
                    key={piece}
                    onClick={() => handlePromotionSelect(piece)}
                    className="flex flex-col items-center p-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg border border-gray-200 dark:border-white/10 transition-colors min-h-[44px] min-w-[44px]"
                  >
                    <span className="text-3xl md:text-4xl text-gray-900 dark:text-white mb-1">
                      {{ q: '♛', r: '♜', b: '♝', n: '♞' }[piece]}
                    </span>
                    <span className="text-xs md:text-xs text-gray-400">
                      {{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[piece]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
          <span>{moveHistory.length} move{moveHistory.length !== 1 ? 's' : ''}</span>
          <div className="text-center">
            {status === 'playing' && (
              isMyTurn ? (
                <span className="text-amber-500 dark:text-amber-400 font-semibold">Your turn</span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">Waiting for opponent...</span>
              )
            )}
          </div>
          <button onClick={onLeave} className="text-rose-400 hover:text-rose-300 transition-colors min-h-[44px] min-w-[44px]">
            Leave
          </button>
        </div>

        {moveHistory.length > 0 && (
          <div className="mt-3 max-h-24 overflow-y-auto bg-gray-100/50 dark:bg-white/[0.02] rounded-lg border border-gray-200 dark:border-white/5 p-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {moveHistory.map((move, i) => (
                <span key={i} className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="text-gray-400 dark:text-gray-500">{Math.floor(i / 2) + 1}.{i % 2 === 0 ? '' : '..'}</span>
                  {move}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {status === 'game_over' && winner && gameResult && !showGameOverDismissed && (
        <GameOverModal
          winner={winner === 'white' ? 'WHITE' : winner === 'black' ? 'BLACK' : 'DRAW'}
          onPlayAgain={() => router.push('/')}
          onClose={() => setShowGameOverDismissed(true)}
          gameResult={gameResult}
        />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {showResignConfirm && (
        <ResignConfirmModal
          onConfirm={() => {
            setShowResignConfirm(false)
            gameRef.current?.resign()
            onLeave()
          }}
          onCancel={() => setShowResignConfirm(false)}
        />
      )}
      {showLeaveModal && (
        <LeaveConfirmModal
          open={showLeaveModal}
          onConfirm={() => {
            setShowLeaveModal(false)
            confirmNavLeave()
            onLeave()
          }}
          onCancel={() => setShowLeaveModal(false)}
          title="Abort Match"
          message="Are you sure you want to leave?"
          detail="You will forfeit this duel."
        />
      )}
      {isMobile && (
        <BottomNav
          activeOverlay="none"
          onProfileClick={() => router.push('/profile')}
          onHistoryClick={() => router.push('/history')}
          onSoundToggle={() => setSoundEnabled(!soundEnabled)}
          soundEnabled={soundEnabled}
        />
      )}
    </div>
  )
}
