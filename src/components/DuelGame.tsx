'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChessBoard, PromotionPiece } from './ChessBoard'
import { MobileChessBoard } from './MobileChessBoard'
import { DuelGame as DuelGameEngine } from '@/lib/duelGame'
import { GameOverModal } from './GameOverModal'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Team } from '@/features/game-engine/gameState'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords } from 'lucide-react'
import { GameMenu } from './GameMenu'
import { BoardBottomNav, type BoardTab } from './BoardBottomNav'
import { BoardTopBar, type BoardTopBarPlayer } from './BoardTopBar'
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
  const [opponentAvatar, setOpponentAvatar] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ username: string | null; avatarUrl: string | null }>({ username: null, avatarUrl: null })
  const [activeBoardTab, setActiveBoardTab] = useState<BoardTab>('game')
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

  // Fetch current user profile (for BoardTopBar You tile)
  useEffect(() => {
    if (!playerId) {
      setUserProfile({ username: null, avatarUrl: null })
      return
    }
    let active = true
    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', playerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data) return
        setUserProfile({ username: data.username || null, avatarUrl: data.avatar_url || null })
      })
      .catch(() => {})
    return () => { active = false }
  }, [playerId])

  // Fetch opponent profile (username + avatar)
  useEffect(() => {
    if (status !== 'playing') return
    const game = gameRef.current
    if (!game) return
    const opp = team === 'WHITE' ? game.blackPlayer : game.whitePlayer
    if (!opp?.id) return
    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', opp.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username) setOpponentUsername(data.username)
        if (data?.avatar_url) setOpponentAvatar(data.avatar_url)
      }).catch(() => {})
  }, [status, team])

  // BoardTopBar players (1v1: one player per team)
  const whitePlayers: BoardTopBarPlayer[] = useMemo(() => {
    if (team === 'WHITE') {
      return [{
        id: playerId,
        label: userProfile.username || 'You',
        type: 'human',
        profileImageUrl: userProfile.avatarUrl,
        isYou: true,
        online: true,
      }]
    }
    return [{
      id: 'opponent-white',
      label: opponentUsername,
      type: 'human',
      profileImageUrl: opponentAvatar,
      isYou: false,
      online: true,
    }]
  }, [team, playerId, userProfile, opponentUsername, opponentAvatar])

  const blackPlayers: BoardTopBarPlayer[] = useMemo(() => {
    if (team === 'BLACK') {
      return [{
        id: playerId,
        label: userProfile.username || 'You',
        type: 'human',
        profileImageUrl: userProfile.avatarUrl,
        isYou: true,
        online: true,
      }]
    }
    return [{
      id: 'opponent-black',
      label: opponentUsername,
      type: 'human',
      profileImageUrl: opponentAvatar,
      isYou: false,
      online: true,
    }]
  }, [team, playerId, userProfile, opponentUsername, opponentAvatar])

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

  // For 1v1, render the timer text inside the BoardTopBar so the
  // single-shot 5:00 / 4:59 is visible.
  const totalSeconds = timeLimit || 600
  const remainingSeconds = team === 'WHITE' ? whiteTime : blackTime

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a] text-slate-100">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col px-3">
        <div className="w-full bg-[#0a0e1a] border-b border-white/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
            <div className="min-w-0 flex-1">
              <BoardTopBar
                whitePlayers={whitePlayers}
                blackPlayers={blackPlayers}
                matchTimeRemaining={remainingSeconds}
                matchTimerActive={timerActive}
                totalMatchSeconds={totalSeconds}
                roundLabel={undefined}
                currentTurn={currentTurn === 'w' ? Team.WHITE : Team.BLACK}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <GameMenu
                onResign={status !== 'game_over' ? () => setShowResignConfirm(true) : undefined}
                onOpenSettings={() => setShowSettings(true)}
                soundEnabled={soundEnabled}
                onToggleSound={() => setSoundEnabled(!soundEnabled)}
              />
            </div>
          </div>
        </div>

        {/* Turn status pill */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 text-[11px] font-semibold">
          <span className={`w-1.5 h-1.5 rounded-full ${
            isMyTurn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
          }`} />
          <span className={isMyTurn ? 'text-emerald-300' : 'text-slate-400'}>
            {status === 'game_over' ? 'Game Over' : isMyTurn ? 'Your turn' : 'Opponent turn'}
          </span>
        </div>

        {/* Chess Board — 80% of viewport */}
        <div className="flex justify-center">
          <div
            className="w-full aspect-square flex-shrink-0 relative"
            style={{ maxWidth: 'min(95vw, 80vh, 600px)' }}
          >
            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden bg-slate-900/30">
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
              <span className={`text-sm font-semibold ${moveAccuracy !== null ? 'text-yellow-400' : 'text-slate-400'}`}>
                {moveAccuracy !== null ? `Your move: ${moveAccuracy}% accuracy` : `Opponent move: ${opponentAccuracy}% accuracy`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {pendingPromotion && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-slate-900 p-6 rounded-lg border border-slate-700">
              <h3 className="text-xl font-bold text-slate-100 mb-4 text-center">Promote Pawn</h3>
              <div className="flex gap-3 md:gap-4">
                {(['q', 'r', 'b', 'n'] as PromotionPiece[]).map((piece) => (
                  <button
                    key={piece}
                    onClick={() => handlePromotionSelect(piece)}
                    className="flex flex-col items-center p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors min-h-[44px] min-w-[44px]"
                  >
                    <span className="text-3xl md:text-4xl text-slate-100 mb-1">
                      {{ q: '♛', r: '♜', b: '♝', n: '♞' }[piece]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[piece]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom nav */}
        <BoardBottomNav
          activeTab={activeBoardTab}
          onTabChange={(t) => setActiveBoardTab(t)}
          onSurrender={() => setShowResignConfirm(true)}
        />
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
            setTimeout(() => onLeave(), 150)
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
    </div>
  )
}
