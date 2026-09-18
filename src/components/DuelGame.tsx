'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { PromotionPiece } from '@/features/shared/gameTypes'
import { GameTopBarSection, GameBoardSection } from './GameSections'
import { DuelGame as DuelGameEngine } from '@/lib/duelGame'
import { GameOverModal } from './GameOverModal'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Team } from '@/features/game-engine/gameState'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords } from 'lucide-react'
import { ConfirmMoveBar } from './ConfirmMoveBar'
import { BoardBottomNav, type BoardTab } from './BoardBottomNav'
import { type BoardTopBarPlayer } from './BoardTopBar'
import { IsolatedMatchTimer } from './IsolatedMatchTimer'
import { SettingsPanel } from './SettingsPanel'
import { ResignConfirmModal } from './ResignConfirmModal'
import { LeaveConfirmModal } from './LeaveConfirmModal'
import { useSettings } from '@/hooks/useSettings'
import { saveCompletedGame, hasLocalHistoryForRoom } from '@/lib/matchHistory'
import { supabase } from '@/lib/supabase'
import { useGameToast } from './Toast'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { PromotionModal } from './PromotionModal'
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playIllegalSound, setSoundEnabled as setEngineSoundEnabled, soundEngine } from '@/lib/sounds'
import { Chess } from 'chess.js'

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

  // Refs for overlay states — used by onOverlayBack to avoid stale closures
  const showSettingsRef = useRef(false)
  const showLeaveModalRef = useRef(false)
  const [showGameOverDismissed, setShowGameOverDismissed] = useState(false)
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [status, setStatus] = useState<'waiting' | 'playing' | 'game_over'>('waiting')
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w')
  const [whiteTime, setWhiteTime] = useState(timeLimit)
  const [blackTime, setBlackTime] = useState(timeLimit)
  const [timerActive, setTimerActive] = useState(false)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [winner, setWinner] = useState<'white' | 'black' | 'draw' | null>(null)
  const [gameResult, setGameResult] = useState<string | null>(null)
  const [gameOverReason, setGameOverReason] = useState<string | null>(null)
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)
  const [playbackFen, setPlaybackFen] = useState<string | null>(null)
  const [moveAccuracy, setMoveAccuracy] = useState<number | null>(null)
  const [opponentAccuracy, setOpponentAccuracy] = useState<number | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)
  const [heldMove, setHeldMove] = useState<{ move: string; promotion?: PromotionPiece } | null>(null)
  const [boardKey, setBoardKey] = useState(0)
  const [waiting, setWaiting] = useState(true)
  const [opponentUsername, setOpponentUsername] = useState('Opponent')
  const [opponentAvatar, setOpponentAvatar] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ username: string | null; avatarUrl: string | null }>({ username: null, avatarUrl: null })
  const [disconnectedAge, setDisconnectedAge] = useState(0)
  const [activeBoardTab, setActiveBoardTab] = useState<BoardTab>('game')
  const gameRef = useRef<DuelGameEngine | null>(null)
  const accuracyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const moveEntriesRef = useRef<Array<{ accuracy: number; fenAfter: string }>>([])
  const moveAccuracyRef = useRef<number | null>(null)
  const opponentAccuracyRef = useRef<number | null>(null)
  const prevFenRef = useRef('')
  const prevTurnRef = useRef<'w' | 'b'>('w')
  // Refs for clock-tick filtering — read inside engine callback without
  // capturing stale React state (all updates funnel through this callback).
  const winnerRef = useRef<'white' | 'black' | 'draw' | null>(null)
  const moveHistoryLengthRef = useRef(0)
  const disconnectedAgeRef = useRef(0)
  const prevStatusRef = useRef<'waiting' | 'playing' | 'game_over'>('waiting')

  const showAccuracy = moveAccuracy !== null || opponentAccuracy !== null

  // Sync overlay refs with state — keeps onOverlayBack from seeing stale values
  useEffect(() => { showSettingsRef.current = showSettings }, [showSettings])
  useEffect(() => { showLeaveModalRef.current = showLeaveModal }, [showLeaveModal])

  const closeTopmostOverlay = useCallback((): boolean => {
    if (showSettingsRef.current) { setShowSettings(false); return true }
    if (showLeaveModalRef.current) { setShowLeaveModal(false); return true }
    return false
  }, [])

  const { confirmLeave: confirmNavLeave } = useNavigationGuard({
    enabled: status === 'playing',
    onAttemptLeave: () => setShowLeaveModal(true),
    onOverlayBack: closeTopmostOverlay,
    hasOpenOverlay: showSettings,
  })

  useCapacitorBackButton(
    () => {
      if (status === 'playing') {
        setShowLeaveModal(true)
      } else {
        onLeave()
      }
      return true
    },
    true,
  )

  useEffect(() => {
    const game = new DuelGameEngine(roomId, playerId, team, timeLimit)
    gameRef.current = game

    game.setOnStateChange((state) => {
      // P0-2 perf: skip pure 1 Hz clock ticks — the isolated timer below polls
      // the engine directly, so clock-only notifies must NOT re-render DuelGame
      // (and therefore must NOT re-render Board/ChessBoard). Non-clock changes
      // (fen/status/turn/winner/history/disconnect-age) still propagate.
      // Timeout/forfeit converge via status change (playing → game_over), which
      // is never skipped. Disconnect age is included so the AvatarTile forfeit
      // countdown keeps ticking while a peer is disconnected.
      const clockOnlyTick =
        prevFenRef.current !== '' &&
        state.fen === prevFenRef.current &&
        state.status === prevStatusRef.current &&
        state.currentTurn === prevTurnRef.current &&
        state.winner === winnerRef.current &&
        state.moveHistory.length === moveHistoryLengthRef.current &&
        (state.disconnectedAgeMs ?? 0) === disconnectedAgeRef.current
      if (clockOnlyTick) return
      winnerRef.current = state.winner
      moveHistoryLengthRef.current = state.moveHistory.length
      prevTurnRef.current = state.currentTurn
      disconnectedAgeRef.current = state.disconnectedAgeMs ?? 0
      setFen(state.fen)
      setStatus(state.status)
      setCurrentTurn(state.currentTurn)
      setWhiteTime(state.whiteTimeRemaining)
      setBlackTime(state.blackTimeRemaining)
      setTimerActive(state.matchTimerActive)
      setLastMove(state.lastMove)
      setWinner(state.winner)
      setGameResult(state.gameResult)
      setGameOverReason(state.gameOverReason ?? null)
      setDisconnectedAge(state.disconnectedAgeMs ?? 0)
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

      if (prevFenRef.current && state.fen !== prevFenRef.current && state.status === 'playing') {
        playMoveSound()

        try {
          const prevChess = new Chess(prevFenRef.current)
          const currChess = new Chess(state.fen)
          const prevPieces = Array.from(prevChess.board().flat()).filter(Boolean).length
          const currPieces = Array.from(currChess.board().flat()).filter(Boolean).length
          if (currPieces < prevPieces) {
            playCaptureSound()
          }
        } catch { /* fen parse error — skip capture sound */ }

        try {
          const currChess = new Chess(state.fen)
          if (currChess.isCheck()) {
            playCheckSound()
          }
        } catch { /* skip check sound */ }
      }

      if (state.status === 'game_over' && prevStatusRef.current !== 'game_over') {
        try {
          const currChess = new Chess(state.fen)
          if (currChess.isCheckmate()) {
            playCheckmateSound()
          }
        } catch { /* skip checkmate sound */ }
      }

      prevFenRef.current = state.fen
      prevStatusRef.current = state.status
    })

    // Capture opponent move fenAfter for navigation
    game.setOnOpponentMove((fenAfter: string) => {
      moveEntriesRef.current = [...moveEntriesRef.current, { accuracy: 0, fenAfter }]
    })

    game.join()

    return () => { game.destroy() }
  }, [roomId, playerId, team, timeLimit])

  useEffect(() => {
    setEngineSoundEnabled(settings.soundEnabled)
  }, [settings.soundEnabled])

  useEffect(() => {
    const tryResumeAudio = () => {
      soundEngine.resumeContext().catch(() => {})
      if (soundEngine.getState() === 'running') {
        document.removeEventListener('click', tryResumeAudio)
        document.removeEventListener('touchstart', tryResumeAudio)
        document.removeEventListener('pointerdown', tryResumeAudio)
      }
    }
    document.addEventListener('click', tryResumeAudio)
    document.addEventListener('touchstart', tryResumeAudio)
    document.addEventListener('pointerdown', tryResumeAudio)
    return () => {
      document.removeEventListener('click', tryResumeAudio)
      document.removeEventListener('touchstart', tryResumeAudio)
      document.removeEventListener('pointerdown', tryResumeAudio)
    }
  }, [])

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

    // C5: a refresh after game-over remounts and re-fires this effect — skip
    // when this device already recorded the room (prevents duplicate local
    // entries; the Supabase side is idempotent via UNIQUE(room_id)).
    if (!hasLocalHistoryForRoom(roomId, playerId)) {
      const winningSide = winner === 'white' ? 'WHITE' : winner === 'black' ? 'BLACK' : 'DRAW'
      saveCompletedGame({
        winner: winningSide,
        gameResult: gameResult || 'Game Over',
        gameOverReason: gameOverReason || null,
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
    } else {
      console.log('[DUEL] History entry already exists locally — skipping duplicate save:', JSON.stringify({ roomId }))
    }
    toast.gameOver(gameResult || 'Game Over')
  }, [status, winner, gameResult, gameOverReason, moveHistory, moveAccuracy, opponentAccuracy, roomId, playerId, toast])

  const captureMoveEntry = useCallback((accuracy: number) => {
    const fenAfter = gameRef.current?.fen
    if (fenAfter) {
      moveEntriesRef.current = [...moveEntriesRef.current, { accuracy, fenAfter }]
    }
  }, [])

  const handleResign = useCallback(async () => {
    try {
      await gameRef.current?.resign()
    } catch {
      // Resignation failure is handled by the engine; keep the result screen usable.
    }
  }, [])

  const handleMove = useCallback(async (uci: string, promotion?: PromotionPiece) => {
    const game = gameRef.current
    if (!game) return

    if (settings.confirmMove) {
      setHeldMove({ move: uci, promotion })
      return
    }

    if (promotion) {
      if (settings.autoQueen) {
        const result = await game.makeMove(uci.replace('-', '') + 'q')
        if (!result.success) toast.warning('Move failed — please retry')
        else if (result.accuracy !== undefined) {
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
    if (!result.success) toast.warning('Move failed — please retry')
    else if (result.accuracy !== undefined) {
      setMoveAccuracy(result.accuracy)
      captureMoveEntry(result.accuracy)
    }
  }, [settings.autoQueen, settings.confirmMove, captureMoveEntry, toast])

  const handleConfirmHeldMove = useCallback(async () => {
    if (!heldMove) return
    const { move, promotion } = heldMove
    setHeldMove(null)
    const game = gameRef.current
    if (!game) return

    if (promotion) {
      if (settings.autoQueen) {
        const result = await game.makeMove(move.replace('-', '') + 'q')
        if (!result.success) toast.warning('Move failed — please retry')
        else if (result.accuracy !== undefined) {
          setMoveAccuracy(result.accuracy)
          captureMoveEntry(result.accuracy)
        }
        return
      }
      const [from, to] = move.split('-')
      setPendingPromotion({ from, to })
      return
    }

    const result = await game.makeMove(move.replace('-', ''))
    if (!result.success) toast.warning('Move failed — please retry')
    else if (result.accuracy !== undefined) {
      setMoveAccuracy(result.accuracy)
      captureMoveEntry(result.accuracy)
    }
  }, [heldMove, settings.autoQueen, captureMoveEntry, toast])

  const handleCancelHeldMove = useCallback(() => {
    setHeldMove(null)
    setBoardKey(k => k + 1)
  }, [])

  const handlePromotionSelect = useCallback(async (piece: PromotionPiece) => {
    if (!pendingPromotion) return
    const { from, to } = pendingPromotion
    setPendingPromotion(null)
    const uci = from + to + piece
    const game = gameRef.current
    if (!game) return
    const result = await game.makeMove(uci)
    if (!result.success) toast.warning('Move failed — please retry')
    else if (result.accuracy !== undefined) {
      setMoveAccuracy(result.accuracy)
      captureMoveEntry(result.accuracy)
    }
  }, [pendingPromotion, captureMoveEntry, toast])

  const isMyTurn = status === 'playing' && ((currentTurn === 'w' && team === 'WHITE') || (currentTurn === 'b' && team === 'BLACK'))

  if (waiting) {
    return (
      <div className={`min-h-dvh bg-white dark:bg-[var(--color-page-bg-alt)] text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 ${isMobile ? 'pb-24' : ''}`}>
        <div className="text-center space-y-4">
          <div className="animate-pulse text-5xl flex justify-center">
            <Swords size={48} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400">Waiting for opponent...</h1>
          <p className="text-gray-500 dark:text-gray-400">Share this room code with your friend:</p>
          <div className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl p-4">
            <p className="text-3xl font-bold tracking-widest font-mono text-amber-500 dark:text-amber-400">{roomCode}</p>
          </div>
          <p className="text-gray-500 text-sm">The game starts when your opponent joins</p>
          <button
            onClick={onLeave}
            className="focus-ring mt-4 px-6 py-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // For 1v1, render the timer text inside the BoardTopBar so the
  // single-shot 5:00 / 4:59 is visible.
  // P0-2 perf: isolated 1 Hz timer polls the engine directly — parent no longer
  // re-renders every second (see clockOnlyTick filter in setOnStateChange).
  // matchTimeRemaining/matchTimerActive below are now initial values only;
  // the live countdown is owned by `duelTimerNode`.
  const totalSeconds = timeLimit || 600
  const remainingSeconds = team === 'WHITE' ? whiteTime : blackTime
  void remainingSeconds
  // Stable getter: reads live engine values via ref; mount-time fallbacks are
  // mirrored into refs so whiteTime/blackTime state updates don't recreate
  // this callback (which would tear down IsolatedMatchTimer's 1s interval and
  // invalidate duelTimerNode's memo on every non-clock engine event).
  const fallbackTimeRef = useRef({ whiteTime, blackTime })
  useEffect(() => {
    fallbackTimeRef.current = { whiteTime, blackTime }
  }, [whiteTime, blackTime])
  const getDuelTimeRemaining = useCallback(() => {
    const g = gameRef.current
    if (!g) return team === 'WHITE' ? fallbackTimeRef.current.whiteTime : fallbackTimeRef.current.blackTime
    return team === 'WHITE' ? g.whiteTimeRemaining : g.blackTimeRemaining
  }, [team])
  const isDuelTimerActive = timerActive && status === 'playing'
  const duelTimerNode = useMemo(() => (
    <IsolatedMatchTimer getTimeRemaining={getDuelTimeRemaining} isActive={isDuelTimerActive} totalSeconds={totalSeconds} />
  ), [getDuelTimeRemaining, isDuelTimerActive, totalSeconds])

  // P0-1 perf: memoize presence mapping so BoardTopBar's referential comparator
  // holds when disconnectedAge/base arrays are unchanged.
  const whitePlayersWithPresence: BoardTopBarPlayer[] = useMemo(() => (
    whitePlayers.map(p => ({ ...p, disconnectedSinceMs: !p.isYou ? disconnectedAge : undefined }))
  ), [whitePlayers, disconnectedAge])
  const blackPlayersWithPresence: BoardTopBarPlayer[] = useMemo(() => (
    blackPlayers.map(p => ({ ...p, disconnectedSinceMs: !p.isYou ? disconnectedAge : undefined }))
  ), [blackPlayers, disconnectedAge])

  // Stable BoardBottomNav handlers (were inline closures defeating memo).
  const handleDuelTabChange = useCallback((t: BoardTab) => setActiveBoardTab(t), [])
  const handleDuelForward = useCallback(() => {}, [])
  const handleDuelBackMove = useCallback(() => {
    if (moveHistory.length === 0) return
    const current = playbackIndex ?? moveHistory.length - 1
    if (current <= 0) {
      setPlaybackIndex(-1)
      setPlaybackFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    } else {
      setPlaybackIndex(current - 1)
      setPlaybackFen(moveEntriesRef.current[current - 1]?.fenAfter || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    }
  }, [moveHistory.length, playbackIndex])
  const handleDuelForwardMove = useCallback(() => {
    if (moveHistory.length === 0) return
    if (playbackIndex === null) return
    const current = playbackIndex ?? moveHistory.length - 1
    if (current >= moveHistory.length - 1) {
      setPlaybackIndex(null)
      setPlaybackFen(null)
    } else {
      setPlaybackIndex(current + 1)
      setPlaybackFen(moveEntriesRef.current[current + 1]?.fenAfter || null)
    }
  }, [moveHistory.length, playbackIndex])

  // P7 perf: stable GameMenu handlers for the shared memoized top-bar section.
  // (DuelGame has no resolution animation — a stable noop keeps section memo held.)
  const noopDuelAnimationComplete = useCallback(() => {}, [])
  const openDuelResignConfirm = useCallback(() => setShowResignConfirm(true), [])
  const openDuelSettings = useCallback(() => setShowSettings(true), [])
  const toggleDuelSound = useCallback(
    () => settings.setSoundEnabled(!settings.soundEnabled),
    [settings.setSoundEnabled, settings.soundEnabled]
  )

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--color-page-bg)] text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col px-3 pb-24">
        {/* P7: shared memoized top-bar section. shellClassName preserves
            DuelGame's exact wrapper visuals (differs from Game's). */}
        <GameTopBarSection
          whitePlayers={whitePlayersWithPresence}
          blackPlayers={blackPlayersWithPresence}
          matchTimeRemaining={remainingSeconds}
          matchTimerActive={timerActive}
          totalMatchSeconds={totalSeconds}
          roundLabel={undefined}
          currentTurn={currentTurn === 'w' ? Team.WHITE : Team.BLACK}
          timerNode={duelTimerNode}
          resignVisible={status !== 'game_over'}
          onResign={openDuelResignConfirm}
          onOpenSettings={openDuelSettings}
          soundEnabled={settings.soundEnabled}
          onToggleSound={toggleDuelSound}
          shellClassName="w-full bg-[var(--color-page-bg)] border-b border-white/5 px-3 py-2"
        />

        {/* Turn status pill */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 text-[11px] font-semibold">
          <span className={`w-1.5 h-1.5 rounded-full ${
            isMyTurn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
          }`} />
          <span className={isMyTurn ? 'text-emerald-300' : 'text-slate-400'}>
            {status === 'game_over' ? 'Game Over' : isMyTurn ? 'Your turn' : 'Opponent turn'}
          </span>
        </div>

        {/* Chess Board — 80% of viewport.
            P7: shared memoized board section; outerClassName + maxWidth preserve
            DuelGame's exact layout (no px-3, 600px cap, unlike Game's). */}
        <GameBoardSection
          boardKey={boardKey}
          fen={playbackFen || fen}
          enabled={isMyTurn && !pendingPromotion}
          orientation={team === 'WHITE' ? 'white' : 'black'}
          lastMove={lastMove}
          pendingOverlay={null}
          myPendingOverlay={null}
          highlightSquares={null}
          onMove={handleMove}
          onAnimationComplete={noopDuelAnimationComplete}
          isMobile={isMobile}
          maxWidth="min(95vw, 80vh, 600px)"
          outerClassName="flex justify-center"
        />

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
          <PromotionModal onSelect={handlePromotionSelect} />
        )}

        {/* Bottom nav */}
        <BoardBottomNav
          activeTab={activeBoardTab}
          onTabChange={handleDuelTabChange}
          onForward={handleDuelForward}
          onBackMove={handleDuelBackMove}
          onForwardMove={handleDuelForwardMove}
        />

        {/* Floating Confirm Move Bar — overlays above BoardBottomNav */}
        {status === 'playing' && (
          <ConfirmMoveBar
            visible={settings.confirmMove && !!heldMove}
            onConfirm={handleConfirmHeldMove}
            onCancel={handleCancelHeldMove}
          />
        )}
      </div>

      <GameOverModal
        open={status === 'game_over' && winner && gameResult && !showGameOverDismissed}
        winner={winner === 'white' ? 'WHITE' : winner === 'black' ? 'BLACK' : 'DRAW'}
        onPlayAgain={() => router.replace('/')}
        onClose={() => setShowGameOverDismissed(true)}
        gameResult={gameResult}
        gameOverReason={gameOverReason}
      />

      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      <ResignConfirmModal
        open={showResignConfirm}
        onConfirm={() => { setShowResignConfirm(false); void handleResign() }}
        onCancel={() => setShowResignConfirm(false)}
      />
      <LeaveConfirmModal
        open={showLeaveModal}
        onConfirm={() => {
          setShowLeaveModal(false)
          if (status === 'playing') {
            const opponent = team === 'WHITE' ? 'black' : 'white'
            setShowGameOverDismissed(false)
            setStatus('game_over')
            setWinner(opponent)
            setGameResult('Match abandoned')
            setGameOverReason('abandoned')
            return
          }
          confirmNavLeave()
          onLeave()
        }}
        onCancel={() => setShowLeaveModal(false)}
        title="Abort Match"
        message="Are you sure you want to leave?"
        detail="You will forfeit this duel."
      />
    </div>
  )
}
