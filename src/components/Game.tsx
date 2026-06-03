'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChessBoard, PromotionPiece, PendingOverlay, HighlightSquares } from './ChessBoard'
import { MobileChessBoard } from './MobileChessBoard'
import { LocalGame, GameStatus, MoveComparison } from '@/features/offline/game/localGame'
import { OnlineGame } from '@/features/online/game/onlineGame'
import { Team } from '@/features/game-engine/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/features/bots/chessBot'
import { createBotConfig, getBotConfig } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { normalizeUci, uciToSan, getMoveFromUci } from '@/lib/chessUtils'
import { MatchTimer } from './MatchTimer'
import { MoveComparisonPanel } from './MoveComparison'
import { GameOverModal } from './GameOverModal'
import { AccuracyBottomSheet } from './AccuracyBottomSheet'
import { AnalyzingIndicator } from './AnalyzingIndicator'
import { GameLoading } from './GameLoading'
import { GameLobby } from './GameLobby'
import { EvaluatingLoader } from './EvaluatingLoader'
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playLockSound, playResolutionSound, setSoundEnabled as setSoundEngineEnabled } from '@/lib/sounds'
import { saveCompletedGame } from '@/lib/matchHistory'
import { MovePlayback, MoveEntry } from './MovePlayback'
import { SlideOver } from './SlideOver'
import { ProfilePanel } from './ProfilePanel'
import { HistoryPanel } from './HistoryPanel'
import { BottomNav } from './BottomNav'
import { TeamIndicator } from './TeamIndicator'
import { User, Volume2, VolumeX } from 'lucide-react'
import { MobileStatusBar } from './MobileStatusBar'
import { GameOnOverlay } from './GameOnOverlay'
import { GameMenu } from './GameMenu'
import { SettingsPanel } from './SettingsPanel'
import { ResignConfirmModal } from './ResignConfirmModal'
import { useSettings } from '@/lib/settings'
import { LeaveConfirmModal } from './LeaveConfirmModal'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================================
interface GameProps {
  level?: number
  roomCode?: string
  mode?: string
  roomId?: string
  team?: 'WHITE' | 'BLACK'
  playerId?: string
  timeLimitSeconds?: number
  challengeId?: string
}

interface GameState {
  status: GameStatus
  fen: string
  currentTurn: Team
  selectedMove: string | null
  isMyTurn: boolean
  phase: string
  capturedByWhite: string[]
  capturedByBlack: string[]
  isBotThinking: boolean
  pendingPromotion: { from: string; to: string } | null
  lastMove: { from: string; to: string } | null
  moveAccuracy: number
  moveAccuracyP2: number
  totalMoves: number
  matchTimeRemaining: number
  matchTimerActive: boolean
  pendingOverlay: PendingOverlay | null
  myPendingOverlay: PendingOverlay | null
  highlightSquares: HighlightSquares | null
  isLoading: boolean
}

const PIECE_SYMBOLS: Record<string, string> = {
  'p': '♟',
  'n': '♞',
  'b': '♝',
  'r': '♜',
  'q': '♛',
  'k': '♚'
}

const PROMOTION_PIECES: { piece: PromotionPiece; symbol: string; label: string }[] = [
  { piece: 'q', symbol: '♛', label: 'Queen' },
  { piece: 'r', symbol: '♜', label: 'Rook' },
  { piece: 'b', symbol: '♝', label: 'Bishop' },
  { piece: 'n', symbol: '♞', label: 'Knight' }
]

function CapturedPiecesRow({ pieces }: { pieces: string[] }) {
  if (pieces.length === 0) return <span className="text-[10px] text-gray-600">—</span>
  const sortedPieces = [...pieces].sort((a, b) => {
    const order = ['q', 'r', 'b', 'n', 'p']
    return order.indexOf(a) - order.indexOf(b)
  })
  return (
    <span className="text-base md:text-lg leading-none">
      {sortedPieces.map((piece, i) => (
        <span key={`${piece}-${i}`}>{PIECE_SYMBOLS[piece] || piece}</span>
      ))}
    </span>
  )
}

function PromotionModal({ onSelect }: { onSelect: (piece: PromotionPiece) => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg border-2 border-yellow-500">
        <h3 className="text-xl font-bold text-white mb-4 text-center">Promote Pawn</h3>
        <div className="flex gap-4">
          {PROMOTION_PIECES.map(({ piece, symbol, label }) => (
            <button
              key={piece}
              onClick={() => onSelect(piece)}
              className="flex flex-col items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-500 transition-colors"
            >
              <span className="text-4xl text-white mb-1">{symbol}</span>
              <span className="text-xs text-gray-300">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Game({ level, roomCode, mode, roomId, team, playerId: playerIdFromProps, timeLimitSeconds, challengeId }: GameProps) {
  const router = useRouter()
  const timeLimit = timeLimitSeconds || 600

  const [game] = useState(() => mode !== 'online' ? new LocalGame(timeLimit) : null)
  const [onlineGame] = useState(() => {
    console.log('[Game] Creating OnlineGame, mode:', mode)
    return mode === 'online' ? new OnlineGame(timeLimit) : null
  })
  const isOnline = mode === 'online'
  console.log('[Game] isOnline:', isOnline, 'onlineGame:', !!onlineGame)

  // Create bot config (used for opponent bots in online mode, and both bots in offline)
  const botConfig = useMemo(() => {
    if (level && level >= 1 && level <= 6) {
      console.log(`[Game] Using selected level: ${level} for opponent`)
      return createBotConfig(level, level)
    }
    console.log('[Game] No level selected, using default config')
    return getBotConfig()
  }, [level])

  const [bot] = useState(() => {
    if (!botConfig) return null
    const botInstance = createBot({ skillLevel: botConfig.opponentSkillLevel })
    console.log(`[Game] Opponent bot created with level: ${botConfig.opponentSkillLevel}, description: ${botInstance.getSkillDescription()}`)
    return botInstance
  })
  const [teammateBot] = useState(() => {
    if (!botConfig) return null
    const botInstance = createBot({ skillLevel: botConfig.teammateSkillLevel })
    console.log(`[Game] Teammate bot created with level: ${botConfig.teammateSkillLevel}, description: ${botInstance.getSkillDescription()}`)
    return botInstance
  })
  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.WAITING,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    currentTurn: Team.WHITE,
    selectedMove: null,
    isMyTurn: true,
    phase: 'waiting',
    capturedByWhite: [],
    capturedByBlack: [],
    isBotThinking: false,
    pendingPromotion: null,
    lastMove: null,
    moveAccuracy: 100,
    moveAccuracyP2: 100,
    totalMoves: 0,
    matchTimeRemaining: 600,
    matchTimerActive: false,
    pendingOverlay: null,
    myPendingOverlay: null,
    highlightSquares: null,
    isLoading: true
  })

  const [soundEnabled, setSoundEnabledState] = useState(true)
  const [accuracyComparison, setAccuracyComparison] = useState<MoveComparison | null>(null)
  const [turnState, setTurnState] = useState<string>('selecting')
  const prevTurnRef = useRef<Team | null>(null)
  const gameSavedRef = useRef(false)
  const moveHistoryRef = useRef<MoveEntry[]>([])
  const teammateLabelShownRef = useRef(false)
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)
  const [playbackFen, setPlaybackFen] = useState<string | null>(null)
  const [overlayMode, setOverlayMode] = useState<'none' | 'profile' | 'history'>('none')
  const isMobile = useIsMobile()
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leavingConfirmed, setLeavingConfirmed] = useState(false)
  const alreadyReassessedRef = useRef(false)
  const matchTimerStartedRef = useRef(false)
  const [showGameOn, setShowGameOn] = useState(false)
  const joinRoomCalledRef = useRef(false)
  const settings = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  useEffect(() => {
    setSoundEngineEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    if (gameState.status !== GameStatus.GAME_OVER) return
    if (gameSavedRef.current) return

    const g = isOnline ? onlineGameRef.current : game
    if (!g) return

    let winner: 'WHITE' | 'BLACK' | 'DRAW' = 'DRAW'
    let result = 'Game Over'
    let reason: string | null = null
    let movesPlayed = 0
    let syncRate = 0
    let conflicts = 0
    let p1Acc = 0
    let p2Acc = 0

    if (isOnline) {
      result = g.getResult()
      reason = g.getGameOverReason()
      if (result.includes('White wins')) winner = 'WHITE'
      else if (result.includes('Black wins')) winner = 'BLACK'
      const s = g.getStats()
      movesPlayed = s.movesPlayed
      syncRate = s.syncRate
      conflicts = s.conflicts
      p1Acc = s.player1Accuracy
      p2Acc = s.player2Accuracy
    } else {
      const localGame = g as LocalGame
      result = localGame.getResult()
      reason = localGame.getGameOverReason()
      if (result.includes('White wins')) winner = 'WHITE'
      else if (result.includes('Black wins')) winner = 'BLACK'
      const s = localGame.getStats()
      movesPlayed = s.whiteMovesPlayed
      syncRate = s.whiteSyncRate
      conflicts = s.whiteConflicts
      p1Acc = s.player1Accuracy
      p2Acc = s.player2Accuracy
    }

    saveCompletedGame({
      winner,
      gameResult: result,
      gameOverReason: reason,
      stats: {
        whiteMovesPlayed: movesPlayed,
        whiteSyncRate: syncRate,
        whiteConflicts: conflicts,
        player1Accuracy: p1Acc,
        player2Accuracy: p2Acc,
        totalMoves: movesPlayed,
      },
      isOnline: !!isOnline,
      moveComparisons: moveHistoryRef.current,
      challengeId: challengeId || undefined,
    })

    gameSavedRef.current = true
  }, [gameState.status, isOnline, game])

  // Player ID from URL props (passed from Room component)
  // Auto-detect from auth session if missing (join-link flow)
  const [autoPlayerId, setAutoPlayerId] = useState<string | null>(null)
  const [autoTeam, setAutoTeam] = useState<'WHITE' | 'BLACK' | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false)

  useEffect(() => {
    if (playerIdFromProps || autoJoinAttempted) return

    async function detectPlayer() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setAutoPlayerId(session.user.id)
        setIsGuest(session.user.is_anonymous ?? false)
      } else {
        let id: string | null = null
        try {
          const { data: { user } } = await supabase.auth.signInAnonymously()
          if (user) id = user.id
        } catch (e) {
          console.warn('[Game] Anonymous sign-in failed, using fallback ID:', e)
        }
        if (!id) {
          id = `anon_${Math.random().toString(36).substring(2, 10)}`
        }
        setAutoPlayerId(id)
        setIsGuest(true)
      }
    }
    detectPlayer()
  }, [playerIdFromProps, autoJoinAttempted])

  useEffect(() => {
    if (!isOnline || !roomId || !autoPlayerId || autoTeam || autoJoinAttempted) return

    async function detectTeam() {
      const { data: roomPlayers } = await supabase
        .from('room_players')
        .select('team')
        .eq('room_id', roomId)

      const whiteCount = roomPlayers?.filter(p => p.team === 'WHITE').length ?? 0
      const blackCount = roomPlayers?.filter(p => p.team === 'BLACK').length ?? 0

      setAutoTeam(whiteCount <= blackCount ? 'WHITE' : 'BLACK')
    }
    detectTeam()
  }, [isOnline, roomId, autoPlayerId, autoTeam, autoJoinAttempted])

  const playerId = playerIdFromProps || autoPlayerId
  const effectiveTeam = team || autoTeam

  const inviteUrl = useMemo(() => {
    if (!isOnline || !roomId || !roomCode) return undefined
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const params = new URLSearchParams({
      mode: 'online',
      room: roomId,
      code: roomCode,
      time: String(timeLimit),
    })
    return `${base}/game?${params.toString()}`
  }, [isOnline, roomId, roomCode, timeLimit])

  // Set up state change callback for online mode - MUST be before joinRoom
  const onlineGameRef = useRef(onlineGame)
  const lastOnlineStateRef = useRef<string>('')
  useEffect(() => {
    console.log('[Game] setOnStateChange useEffect, onlineGame:', !!onlineGame)
    if (!onlineGame) {
      console.log('[Game] No onlineGame, skipping setOnStateChange')
      return
    }
    
    onlineGameRef.current = onlineGame
    console.log('[Game] Setting up setOnStateChange callback')
    onlineGame.setOnStateChange(() => {
      if (!onlineGameRef.current) return
      const g = onlineGameRef.current

      // Track turn state for "evaluating" loader visibility — MUST run before stateKey guard
      const ts = (g as any).turnState
      if (ts) setTurnState(ts)

      // Skip if state hasn't meaningfully changed (prevents re-render loops)
      // Exclude matchTimeRemaining from key — it changes every second
      // and would defeat the guard, causing unnecessary re-renders.
      // Timer updates are handled separately by tickMatchTimer.
      const pendingSize = (g as any).getAllPendingMoves?.()?.size ?? 0
      const stateKey = `${g.status}:${g.fen}:${g.currentTurn}:${pendingSize}`
      if (stateKey === lastOnlineStateRef.current) return
      lastOnlineStateRef.current = stateKey

      const captured = g.getCapturedPieces()
        
        // Get pendingOverlay for online mode - show teammate's pending move
        // FIX: Only show teammate's move, not my own move (avoid duplicate shadow)
        let pendingOverlay: PendingOverlay | null = null
        if (playerId) {
          const allMoves = (g as any).getAllPendingMoves() as Map<string, any>
          const entries = Array.from(allMoves.entries()) as [string, any][]
          const otherPlayerMoves = entries.filter(([p]) => p !== playerId)
          
          // Only show pendingOverlay if there's a teammate move (not my own)
          if (otherPlayerMoves.length > 0) {
            const [, teammatePending] = otherPlayerMoves[0]
            if (teammatePending.from && teammatePending.to) {
              let piece = teammatePending.piece
              if (!piece || piece === 'unknown') {
                try {
                  const boardPiece = (g as any).board.get(teammatePending.from)
                  piece = boardPiece?.type || 'p'
                } catch {
                  piece = 'p'
                }
              }
              pendingOverlay = { from: teammatePending.from, to: teammatePending.to, piece, color: g.currentTurn === Team.WHITE ? 'white' : 'black', showTeammateLabel: !teammateLabelShownRef.current && g.currentTurn === Team.WHITE }
            }
          }
        }
        
        // Get my pending overlay - show my own pending move as secondary animation
        // FIX: Only show if I have a pending move that is NOT locked (still selecting)
        // If I've already locked my move, don't show myPendingOverlay (avoid duplicate)
        let myPendingOverlay: PendingOverlay | null = null
        if (playerId) {
          const allMoves = (g as any).getAllPendingMoves() as Map<string, any>
          const myPending = allMoves.get(playerId)
          // Only show myPendingOverlay if I have a move AND it's not locked yet
          if (myPending && !myPending.locked && myPending.from && myPending.to) {
            let piece = myPending.piece
            if (!piece || piece === 'unknown') {
              try {
                const boardPiece = (g as any).board.get(myPending.from)
                piece = boardPiece?.type || 'p'
              } catch {
                piece = 'p'
              }
            }
            myPendingOverlay = { from: myPending.from, to: myPending.to, piece, color: g.currentTurn === Team.WHITE ? 'white' : 'black' }
          }
        }
        
        setGameState(prev => ({
          ...prev,
          status: g.status,
          fen: g.fen,
          currentTurn: g.currentTurn,
          isMyTurn: g.currentTurn === Team.WHITE,
          capturedByWhite: captured.white,
          capturedByBlack: captured.black,
          lastMove: g.lastMove,
          matchTimeRemaining: g.getMatchTimeRemaining(),
          matchTimerActive: g.isMatchTimerActive(),
          isLoading: (g.status === GameStatus.PLAYING || g.status === GameStatus.READY) ? false : prev.isLoading,
          pendingOverlay,
          myPendingOverlay
        }))
        
        if (pendingOverlay?.showTeammateLabel) {
          teammateLabelShownRef.current = true
        }

        // Accuracy visibility: show after WHITE resolves, persist through BLACK, clear on next WHITE
        const prevTurn = prevTurnRef.current
        const currentTurn = g.currentTurn
        
        if (prevTurn === Team.WHITE && currentTurn === Team.BLACK) {
          const comp = (g as any).lastMoveComparison as MoveComparison | null
          console.log('[ACCURACY-TRANSITION] WHITE→BLACK detected', {
            hasComparison: !!comp,
            compPlayer1Move: comp?.player1Move,
            compPlayer2Move: comp?.player2Move,
            compWinnerId: comp?.winnerId,
            isSync: comp?.isSync
          })
          if (comp) {
            setAccuracyComparison(comp)
            console.log('[ACCURACY-TRANSITION] SET accuracyComparison')
          } else {
            console.log('[ACCURACY-TRANSITION] No comparison available, accuracy NOT set')
          }
        } else if (prevTurn === Team.BLACK && currentTurn === Team.WHITE) {
          console.log('[ACCURACY-TRANSITION] BLACK→WHITE detected, keeping accuracy displayed')
        }
    prevTurnRef.current = currentTurn

    const comp = g.lastMoveComparison as MoveComparison | null
    if (comp && moveHistoryRef.current.length === 0 ||
        (comp && comp !== (moveHistoryRef.current[moveHistoryRef.current.length - 1] as any))) {
      const entry: MoveEntry = {
        turn: moveHistoryRef.current.length + 1,
        team: prevTurn || currentTurn,
        winningMove: comp.winningMove,
        winningMoveUci: (comp as any).winningMove || '',
        shadowMove: comp.isSync ? null : (comp.winningMove === comp.player1Move ? comp.player2Move : comp.player1Move),
        shadowMoveUci: '',
        isSync: comp.isSync,
        player1Accuracy: comp.player1Accuracy,
        player2Accuracy: comp.player2Accuracy,
        fenAfter: g.board.fen(),
      }
      moveHistoryRef.current = [...moveHistoryRef.current, entry]
    }

    // Populate move history from saved data after page reload recovery
    if (isOnline && moveHistoryRef.current.length === 0 && g.status === GameStatus.PLAYING) {
      const savedMoves = (g as any).savedMoveHistory as Array<{ team: string; move: string }> | undefined
      if (savedMoves && savedMoves.length > 0) {
        const entries: MoveEntry[] = savedMoves.map((sm, i) => ({
          turn: i + 1,
          team: sm.team as 'WHITE' | 'BLACK',
          winningMove: sm.move,
          winningMoveUci: sm.move,
          shadowMove: null,
          shadowMoveUci: '',
          isSync: true,
          player1Accuracy: 0,
          player2Accuracy: 0,
          fenAfter: '',
        }))
        moveHistoryRef.current = entries
      }
    }

    if (!alreadyReassessedRef.current && bot && moveHistoryRef.current.length > 0) {
      const whiteMoves = moveHistoryRef.current.filter(e => e.team === 'WHITE')
      if (whiteMoves.length >= 4) {
        const recentMoves = whiteMoves.slice(-4)
        const avgAccuracy = recentMoves.reduce((sum, e) =>
          sum + (e.player1Accuracy + e.player2Accuracy) / 2, 0
        ) / 4

        let newLevel = 4
        if (avgAccuracy >= 92) newLevel = 6
        else if (avgAccuracy >= 85) newLevel = 5

        const oldLevel = bot.getConfig().skillLevel
        if (newLevel > oldLevel) {
          console.log(`[ADAPTIVE] Human avg accuracy: ${avgAccuracy.toFixed(1)}% across 4 WHITE turns → upgrading bot from Level ${oldLevel} to Level ${newLevel}`)
          bot.setSkillLevel(newLevel)
          if (teammateBot) teammateBot.setSkillLevel(newLevel)
        } else {
          console.log(`[ADAPTIVE] Human avg accuracy: ${avgAccuracy.toFixed(1)}% across 4 WHITE turns → keeping bot at Level ${oldLevel}`)
        }
        alreadyReassessedRef.current = true
      }
    }
        console.log('[ACCURACY-TRANSITION] prevTurn tracked:', prevTurn, '→', currentTurn)
    })
    console.log('[Game] setOnStateChange callback set up complete')
  }, [onlineGame, playerId])

  // Initialize online game - runs AFTER setOnStateChange is set up
  useEffect(() => {
    console.log('[Game] JoinRoom useEffect:', {
      mode,
      isOnline,
      hasOnlineGame: !!onlineGame,
      playerId,
      roomId,
      effectiveTeam,
      conditionsMet: mode === 'online' && !!onlineGame && !!playerId && !!roomId && !!effectiveTeam
    })
    
    if (mode === 'online' && onlineGame && playerId && roomId && effectiveTeam && !joinRoomCalledRef.current) {
      joinRoomCalledRef.current = true
      console.log('[Game] [OK] Calling joinRoom with:', { roomId, playerId, team: effectiveTeam })
      onlineGame.joinRoom({ id: roomId } as any, playerId, effectiveTeam)
      if (!team) setAutoJoinAttempted(true)
    } else {
      console.log('[Game] [NO] joinRoom NOT called - conditions not met')
    }
  }, [mode, onlineGame, playerId, roomId, effectiveTeam, team])

  const matchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const matchTimeoutFlagRef = useRef(false)
  const gameRef = useRef(game)
  const opponentInProgressRef = useRef(false)
  const pendingOpponentTurnRef = useRef(false)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  const tickMatchTimer = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    const remaining = g.getMatchTimeRemaining()
    if (remaining <= 0) {
      if (matchTimerRef.current) {
        clearInterval(matchTimerRef.current)
        matchTimerRef.current = null
      }
      if (matchTimeoutFlagRef.current) return
      matchTimeoutFlagRef.current = true
      g.setMatchTimerActive(false)
      g.setMatchTimeRemaining(0)
      setGameState(prev => ({ ...prev, matchTimeRemaining: 0, matchTimerActive: false }))

      if (isOnline && !(g as any).isCoordinator()) {
        return
      }

      handleMatchTimeout(g)
      return
    }

    g.setMatchTimeRemaining(remaining - 1)
    setGameState(prev => ({ ...prev, matchTimeRemaining: remaining - 1 }))
  }, [isOnline])

  const handleMatchTimeout = useCallback(async (g: any) => {
    try {
      const evaluator = g.getEvaluator()
      if (!evaluator) {
        g.setGameOverTimeup('Draw by timeout', 'timeout')
        setGameState(prev => ({ ...prev, status: 3 as any }))
        updateStateRef.current?.()
        return
      }

      const fen = g.board.fen()
      const score = await evaluator.evaluatePosition(fen)
      let winner: 'WHITE' | 'BLACK' | 'DRAW' = 'DRAW'
      let result = ''

      if (score > 0) {
        winner = 'WHITE'
        result = 'White wins by timeout — material advantage'
      } else if (score < 0) {
        winner = 'BLACK'
        result = 'Black wins by timeout — material advantage'
      } else {
        winner = 'DRAW'
        result = "Draw by timeout — equal position"
      }

      g.setGameOverTimeup(result, 'timeout')
      setGameState(prev => ({ ...prev, status: 3 as any }))
      updateStateRef.current?.()
    } catch (e) {
      console.error('[TIMEOUT] Evaluation failed:', e)
      const g2 = isOnline ? onlineGameRef.current : gameRef.current
      if (g2) {
        g2.setGameOverTimeup('Draw by timeout', 'timeout')
        setGameState(prev => ({ ...prev, status: 3 as any }))
        updateStateRef.current?.()
      }
    }
  }, [isOnline])

  const startMatchTimer = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    if (matchTimerRef.current) {
      clearInterval(matchTimerRef.current)
      matchTimerRef.current = null
    }

    matchTimeoutFlagRef.current = false
    const currentRemaining = g.getMatchTimeRemaining()
    if (currentRemaining > 0 && currentRemaining < timeLimit) {
      g.setMatchTimerActive(true)
      setGameState(prev => ({
        ...prev,
        matchTimeRemaining: currentRemaining,
        matchTimerActive: true
      }))
    } else {
      g.setMatchTimerActive(true)
      g.setMatchTimeRemaining(timeLimit)
      setGameState(prev => ({
        ...prev,
        matchTimeRemaining: timeLimit,
        matchTimerActive: true
      }))
    }

    matchTimerRef.current = setInterval(() => {
      tickMatchTimer()
    }, 1000)
  }, [isOnline, timeLimit, tickMatchTimer])

  const stopMatchTimer = useCallback(() => {
    if (matchTimerRef.current) {
      clearInterval(matchTimerRef.current)
      matchTimerRef.current = null
    }
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (g) {
      g.setMatchTimerActive(false)
    }
    setGameState(prev => ({ ...prev, matchTimerActive: false }))
  }, [isOnline])

  // Show Game On overlay when game transitions to PLAYING, then start timer
  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING && !matchTimerStartedRef.current && !showGameOn) {
      setShowGameOn(true)
    }
    if (gameState.status === GameStatus.GAME_OVER && matchTimerStartedRef.current) {
      stopMatchTimer()
      matchTimerStartedRef.current = false
    }
  }, [gameState.status, showGameOn, stopMatchTimer])

  const handleGameOnComplete = useCallback(() => {
    setShowGameOn(false)
    if (!matchTimerStartedRef.current) {
      const g = isOnline ? onlineGameRef.current : gameRef.current
      if (g) {
        g.setMatchTimeRemaining(timeLimit)
        g.setMatchTimerActive(true)
        if (isOnline && (g as any).stopEngineTimer) {
          (g as any).stopEngineTimer()
        }
      }
      startMatchTimer()
      matchTimerStartedRef.current = true
    }
  }, [startMatchTimer, isOnline, timeLimit])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (matchTimerRef.current) {
        clearInterval(matchTimerRef.current)
        matchTimerRef.current = null
      }
    }
  }, [])

  const updateState = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    const captured = g.getCapturedPieces()
    const currentTurn = g.currentTurn
    
    // Get pendingOverlay for online mode - show teammate's pending move
    // FIX: Only show teammate's move, not my own move (avoid duplicate shadow)
    let pendingOverlay: PendingOverlay | null = null
    if (isOnline && playerId) {
      const allMoves = (g as any).getAllPendingMoves() as Map<string, any>
      const entries = Array.from(allMoves.entries()) as [string, any][]
      const otherPlayerMoves = entries.filter(([p]) => p !== playerId)
      
      // Only show pendingOverlay if there's a teammate move (not my own)
      if (otherPlayerMoves.length > 0) {
        const [, teammatePending] = otherPlayerMoves[0]
        if (teammatePending.from && teammatePending.to) {
          let piece = teammatePending.piece
          if (!piece || piece === 'unknown') {
            try {
              const boardPiece = (g as any).board.get(teammatePending.from)
              piece = boardPiece?.type || 'p'
            } catch {
              piece = 'p'
            }
          }
          pendingOverlay = { from: teammatePending.from, to: teammatePending.to, piece, color: currentTurn === Team.WHITE ? 'white' : 'black', showTeammateLabel: !teammateLabelShownRef.current && currentTurn === Team.WHITE }
        }
      }
    }
    
    // Get my pending overlay - show my own pending move as secondary animation
    // FIX: Only show if I have a pending move that is NOT locked (still selecting)
    // If I've already locked my move, don't show myPendingOverlay (avoid duplicate)
    let myPendingOverlay: PendingOverlay | null = null
    if (isOnline && playerId) {
      const allMoves = (g as any).getAllPendingMoves() as Map<string, any>
      const myPending = allMoves.get(playerId)
      // Only show myPendingOverlay if I have a move AND it's not locked yet
      if (myPending && !myPending.locked && myPending.from && myPending.to) {
        let piece = myPending.piece
        if (!piece || piece === 'unknown') {
          try {
            const boardPiece = (g as any).board.get(myPending.from)
            piece = boardPiece?.type || 'p'
          } catch {
            piece = 'p'
          }
        }
        myPendingOverlay = { from: myPending.from, to: myPending.to, piece, color: g.currentTurn === Team.WHITE ? 'white' : 'black' }
      }
    }
    
    setGameState(prev => {
      const newState = {
        ...prev,
        status: g.status,
        fen: g.board.fen(),
        currentTurn,
        selectedMove: isOnline ? null : g.getSelectedMove('player1'),
        phase: g.status === GameStatus.PLAYING ? 'selecting' : 'waiting',
        capturedByWhite: captured.white,
        capturedByBlack: captured.black,
        isMyTurn: currentTurn === Team.WHITE && g.status === GameStatus.PLAYING,
        lastMove: g.lastMove,
        moveAccuracy: 100,
        moveAccuracyP2: 100,
        totalMoves: 0,
        matchTimeRemaining: g.getMatchTimeRemaining(),
        matchTimerActive: g.isMatchTimerActive(),
        pendingOverlay,
        myPendingOverlay,
        isLoading: (g.status === GameStatus.PLAYING || g.status === GameStatus.READY) ? false : prev.isLoading,
        isBotThinking: currentTurn === Team.BLACK ? prev.isBotThinking : false,
        highlightSquares: null as HighlightSquares | null
      }
      return newState
    })
    
    if (pendingOverlay?.showTeammateLabel) {
      teammateLabelShownRef.current = true
    }

    // Accuracy transition detection (for coordinator who uses updateStateRef)
    const prevTurn = prevTurnRef.current
    if (prevTurn === Team.WHITE && currentTurn === Team.BLACK) {
      const comp = g.lastMoveComparison as MoveComparison | null
      if (comp) {
        console.log('[ACCURACY-TRANSITION] (updateState) WHITE→BLACK detected, SET accuracy', { p1Move: comp.player1Move, p2Move: comp.player2Move, winnerId: comp.winnerId })
        setAccuracyComparison(comp)
      }
    }
    prevTurnRef.current = currentTurn
  }, [isOnline, game])

  const updateStateRef = useRef(updateState)
  useEffect(() => {
    updateStateRef.current = updateState
  }, [updateState])

  const checkAndResolve = useCallback(async () => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return false

    if (!g.isBothPendingLocked()) {
      return false
    }

    const pending = g.getPendingMoves()
    const humanMove = pending.human
    const teammateMove = pending.teammate

    if (!humanMove || !teammateMove) {
      return false
    }

    await g.resolvePendingMoves()

    const comparison = g.lastMoveComparison

    // Validate chess square format (e.g., "e2", "d4")
    const isValidSquare = (sq: string | undefined): sq is string => 
      !!sq && sq.length === 2 && /^[a-h][1-8]$/.test(sq)

    if (comparison) {
      const winnerId = comparison.winnerId
      const loserId = comparison.loserId

      const highlightSquares: HighlightSquares = {}

      if (winnerId === 'player1' && humanMove) {
        if (isValidSquare(humanMove.from)) highlightSquares.winnerFrom = humanMove.from
        if (isValidSquare(humanMove.to)) highlightSquares.winnerTo = humanMove.to
        if (!comparison.isSync && loserId === 'player2' && teammateMove) {
          if (isValidSquare(teammateMove.from)) highlightSquares.loserFrom = teammateMove.from
          if (isValidSquare(teammateMove.to)) highlightSquares.loserTo = teammateMove.to
        }
      } else if (winnerId === 'player2' && teammateMove) {
        if (isValidSquare(teammateMove.from)) highlightSquares.winnerFrom = teammateMove.from
        if (isValidSquare(teammateMove.to)) highlightSquares.winnerTo = teammateMove.to
        if (!comparison.isSync && loserId === 'player1' && humanMove) {
          if (isValidSquare(humanMove.from)) highlightSquares.loserFrom = humanMove.from
          if (isValidSquare(humanMove.to)) highlightSquares.loserTo = humanMove.to
        }
      }

      setGameState(prev => ({
        ...prev,
        highlightSquares,
        pendingOverlay: null,
        myPendingOverlay: null
      }))

      const wm = comparison.winningMove
      if (wm.includes('#')) playCheckmateSound()
      else if (wm.includes('+')) playCheckSound()
      else if (wm.includes('x')) playCaptureSound()
      else playMoveSound()

      updateStateRef.current()
      return true
    }

    return false
  }, [isOnline, game])

  const executeBotMove = useCallback(async () => {
    if (isOnline || !bot) return // Only run in offline mode with bot
    
    if (opponentInProgressRef.current) {
      console.log(`[OPPONENT] Already in progress, skipping`)
      return
    }
    
    const g = gameRef.current
    
    if (!g || g.status === GameStatus.GAME_OVER) {
      console.log(`[OPPONENT] Game is over, not making move`)
      return
    }
    
    opponentInProgressRef.current = true
    
    console.log(`[OPPONENT] Starting... currentPhase=${(g as any).gameState._phase}, currentTurn=${g.currentTurn}`)
    
    const currentFen = g.board.fen()
    const currentTurn = g.currentTurn
    
    console.log(`\n[OPPONENT] Bot thinking... (current turn: ${currentTurn})`)
    const startTime = Date.now()
    
    const botUciMove = await bot.selectMoveAsync(currentFen)
    console.log(`[OPPONENT] Bot evaluation took: ${Date.now() - startTime}ms`)
    
    if (!botUciMove) {
      console.warn('[OPPONENT] Bot could not find a move')
      opponentInProgressRef.current = false
      return
    }
    
    const sanMove = uciToSan(botUciMove, currentFen)
    console.log(`[OPPONENT] Selected move: ${sanMove}`)
    
    g.selectMove('player3', sanMove)
    g.selectMove('player4', sanMove)
    g.lockMove('player3')
    g.lockMove('player4')
    
    await g.resolveLegacy(true)
    if (sanMove.includes('#')) playCheckmateSound()
    else if (sanMove.includes('+')) playCheckSound()
    else if (sanMove.includes('x')) playCaptureSound()
    else playMoveSound()
    updateStateRef.current()
    
    console.log(`[DEBUG] After opponent turn, currentTurn: ${g.currentTurn}`)
    opponentInProgressRef.current = false
  }, [isOnline, bot])

  const executeMove = useCallback(async (uciMove: string, promotion?: PromotionPiece) => {
    if (opponentInProgressRef.current) {
      console.log(`[HUMAN] BLOCKED - Opponent thinking, ignoring move`)
      return
    }

    if (isOnline && onlineGameRef.current && playerId) {
      // Online mode - human vs human with bots as opponents
      const g = onlineGameRef.current
      const currentTurn = g.currentTurn

      console.log(`\n[HUMAN] Attempting move: ${uciMove} (current turn: ${currentTurn})`)

      if (currentTurn !== Team.WHITE) {
        console.warn(`[HUMAN] BLOCKED - Not WHITE's turn! Current: ${currentTurn}`)
        return
      }

      // Block if player already submitted a move this turn
      const allPending = (g as any).getAllPendingMoves() as Map<string, any>
      if (allPending && allPending.has(playerId)) {
        console.warn(`[HUMAN] BLOCKED - Already submitted a move this turn`)
        return
      }

      // Clear accuracy panel when player starts new WHITE move (skip if resolving)
      if ((g as any).turnState !== 'resolving') {
        setAccuracyComparison(null)
      }
      console.log(`[ACCURACY-CLEAR] Cleared accuracy for new WHITE move`)

      console.log(`[HUMAN] Turn confirmed as WHITE - processing move...`)

      try {
        const fenBefore = g.board.fen()
        console.log(`[HUMAN] UCI: ${uciMove}, FEN: ${fenBefore}`)
        const sanMove = uciToSan(uciMove, fenBefore, promotion)
        const moveInfo = getMoveFromUci(uciMove, fenBefore)

        console.log(`[HUMAN] SAN: ${sanMove}, moveInfo:`, moveInfo)

        if (moveInfo) {
          g.setPendingMove(playerId as any, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
          g.broadcastMove(sanMove, moveInfo.from, moveInfo.to)

          setGameState(prev => ({
            ...prev,
            selectedMove: sanMove,
            highlightSquares: null
          }))
        }

        g.lockPendingMove(playerId as any)
        g.broadcastLocked()
        playLockSound()

        console.log(`[STATE] Setting turn state to waiting_for_teammate`)
        g.setTurnState('waiting_for_teammate' as any)
        
        // Event-based waiting - no polling, no timeouts
        // Wait for teammate lock event (or if already locked, resolve immediately)
        console.log(`[STATE] Waiting for teammate to lock move...`)
        await g.waitForTeammateLock()
        
        console.log(`[STATE] Teammate locked or already locked, checking state...`)

        // Check if turn already changed (another client resolved)
        if (g.currentTurn !== Team.WHITE) {
          console.log(`[STATE] Turn changed, another client resolved`)
          g.setTurnState('selecting' as any)
          return
        }

        if (g.isBothPendingLocked()) {
          console.log(`[RESOLVE] Both locked, my role:`, { 
            playerId, 
            isCoordinator: g.isCoordinator(), 
            coordinatorId: (g as any).getCoordinatorId?.() 
          })
          console.log(`[RESOLVE] Attempting resolve...`)
          
          try {
            await g.resolvePendingMoves()
            updateStateRef.current()
            console.log(`[RESOLVE] Resolve succeeded`)
            
            // Set highlight squares after resolve (comparison now available)
            const comparison = g.lastMoveComparison
            if (comparison) {
              
              const highlightSquares: HighlightSquares = {}
              const isPlayer1 = playerId === (g as any).player1Id

              if (comparison.winningMove && comparison.player1Move) {
                const lastMove = g.lastMove
                if (lastMove?.from) highlightSquares.winnerFrom = lastMove.from
                if (lastMove?.to) highlightSquares.winnerTo = lastMove.to
                if (!comparison.isSync) {
                  if (comparison.loserFrom && comparison.loserFrom.length === 2) highlightSquares.loserFrom = comparison.loserFrom
                  if (comparison.loserTo && comparison.loserTo.length === 2) highlightSquares.loserTo = comparison.loserTo
                }
              }
              
              setGameState(prev => ({ ...prev, highlightSquares, pendingOverlay: null, myPendingOverlay: null }))
            }
            
            const newTurn = g.currentTurn as Team
            console.log(`[RESOLVE] Resolution complete, new turn: ${newTurn}`)
            playResolutionSound()
            if (comparison) {
              const wm = comparison.winningMove
              if (wm.includes('#')) playCheckmateSound()
              else if (wm.includes('+')) playCheckSound()
              else if (wm.includes('x')) playCaptureSound()
              else playMoveSound()
            }
            
            // BLACK handling: only coordinator runs bots (non-blocking — UI stays responsive)
            if (newTurn === Team.BLACK && bot && playerId && g.isCoordinator()) {
              console.log(`[RESOLVE] Coordinator handling BLACK bot moves...`)
              setGameState(prev => ({ ...prev, isBotThinking: true }))
              
              const currentFen = g.board.fen()
              
              ;(async () => {
                const botUciMove = await bot.selectMoveAsync(currentFen)
                console.log(`[RESOLVE] Bot selected move:`, botUciMove)
                
                if (botUciMove) {
                  const sanMove = uciToSan(botUciMove, currentFen)
                  const moveInfo = getMoveFromUci(botUciMove, currentFen)
                  
                  if (moveInfo) {
                    g.setPendingMove('bot_opponent_1' as any, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
                    g.setPendingMove('bot_opponent_2' as any, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
                    g.lockPendingMove('bot_opponent_1' as any)
                    g.lockPendingMove('bot_opponent_2' as any)
                  }
                }
                
                try {
                  await g.resolvePendingMoves()
                  console.log(`[RESOLVE] BLACK resolve succeeded, new turn:`, g.currentTurn)
                  g.setTurnState('selecting' as any)
                  console.log(`[STATE] Coordinator BLACK resolve complete, reset to selecting`)
                  updateStateRef.current()
                } catch (e) {
                  console.log(`[RESOLVE] BLACK resolve failed:`, e)
                }
              })()
            }
          } catch (e: any) {
            if (e?.message === 'NOT_COORDINATOR') {
              console.log(`[RESOLVE] Not coordinator — waiting for broadcast`)
            } else {
              console.log(`[RESOLVE] Resolve failed:`, e)
            }
          }
        } else {
          console.log(`[RESOLVE] Timeout waiting for teammate, moves:`, g.getPendingMoves())
        }

      } catch (e) {
        console.warn('[HUMAN] Invalid move:', uciMove, e)
      }
    } else if (!isOnline && gameRef.current && teammateBot) {
      // Offline mode - existing logic with bots as teammates and opponents
      const g = gameRef.current
      const startTime = Date.now()
      const currentTurn = g.currentTurn

      console.log(`\n[HUMAN] Attempting move: ${uciMove} (current turn: ${currentTurn})`)

      if (currentTurn !== Team.WHITE) {
        console.warn(`[HUMAN] BLOCKED - Not WHITE's turn! Current: ${currentTurn}`)
        return
      }

      console.log(`[HUMAN] Turn confirmed as WHITE - processing move...`)

      try {
        g.startPendingTurn()

        setGameState(prev => ({
          ...prev,
          highlightSquares: null
        }))

        const fenBefore = g.board.fen()
        console.log(`[HUMAN] UCI: ${uciMove}, FEN: ${fenBefore}`)
        const sanMove = uciToSan(uciMove, fenBefore, promotion)
        const moveInfo = getMoveFromUci(uciMove, fenBefore)

        console.log(`[HUMAN] SAN: ${sanMove}, moveInfo:`, moveInfo)

        if (moveInfo) {
          g.setPendingMove('player1', sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
          console.log(`[HUMAN] Pending move SET for player1`)
          setGameState(prev => ({
            ...prev,
            selectedMove: sanMove,
            pendingOverlay: null,
            myPendingOverlay: null
          }))
        }

        console.log(`[HUMAN] Proposing move: ${sanMove}`)
        console.log(`[TEAMMATE] Bot thinking...`)

        setGameState(prev => ({ ...prev, isBotThinking: true }))

        const teammateStart = Date.now()
        let teammateUciMove: string | null = null
        let teammateSanMove: string | null = null
        let teammateMoveInfo: { from: string; to: string; piece: string } | null = null

        try {
          teammateUciMove = await teammateBot.selectMoveAsync(g.board.fen())
        } catch (error) {
          console.warn('[TEAMMATE] Error selecting move:', error)
        }
        console.log(`[TEAMMATE] Bot evaluation took: ${Date.now() - teammateStart}ms`)

        if (teammateUciMove) {
          const currentFen = g.board.fen()
          teammateSanMove = uciToSan(teammateUciMove, currentFen, promotion)
          teammateMoveInfo = getMoveFromUci(teammateUciMove, currentFen)

          if (teammateMoveInfo) {
            const { from, to, piece } = teammateMoveInfo
            g.setPendingMove('player2', teammateSanMove, from, to, piece)
            g.lockPendingMove('player2')

            setGameState(prev => ({
              ...prev,
              pendingOverlay: { from, to, piece, color: 'white', showTeammateLabel: !teammateLabelShownRef.current }
            }))
            teammateLabelShownRef.current = true
          }

          console.log(`[TEAMMATE] Selected move: ${teammateSanMove}`)
        } else {
          console.warn('[TEAMMATE] No move selected, teammate will be locked without a move')
        }

        g.lockPendingMove('player1')

        console.log(`[RESOLVE] Both moves locked, waiting...`)
        console.log(`[RESOLVE] isBothPendingLocked: ${g.isBothPendingLocked()}`)
        console.log(`[RESOLVE] Pending moves:`, g.getPendingMoves())

        await new Promise(resolve => setTimeout(resolve, 800))

        const resolved = await checkAndResolve()

        console.log(`[RESOLVE] checkAndResolve returned: ${resolved}`)

        if (!resolved) {
          return
        }

        const newTurn = g.currentTurn
        pendingOpponentTurnRef.current = (g.status !== GameStatus.GAME_OVER && newTurn === Team.BLACK)

        if (!pendingOpponentTurnRef.current) {
          console.log(`[HUMAN] Turn time: ${Date.now() - startTime}ms`)
          g.startPendingTurn()
        } else {
          console.log(`[HUMAN] Triggering opponent turn after WHITE resolution`)
          await handleResolutionComplete()
        }
      } catch (e) {
        console.warn('[HUMAN] Invalid move:', uciMove, e)
      }
    }
  }, [isOnline, onlineGame, game, playerId, teammateBot, checkAndResolve])

  useEffect(() => {
    if (!isOnline && game && game.status === GameStatus.WAITING) {
      game.addPlayer('player1', Team.WHITE)
      game.addPlayer('player2', Team.WHITE)
      game.addPlayer('player3', Team.BLACK)
      game.addPlayer('player4', Team.BLACK)
      game.start()
      updateStateRef.current()
    }
  }, [isOnline, game])

  const handleMove = useCallback((uciMove: string, promotion?: PromotionPiece) => {
    if (promotion) {
      if (settings.autoQueen) {
        executeMove(uciMove, 'q')
        return
      }
      const [from, to] = uciMove.split('-')
      setGameState(prev => ({
        ...prev,
        pendingPromotion: { from, to }
      }))
    } else {
      executeMove(uciMove)
    }
  }, [executeMove, settings.autoQueen])

  const handlePromotionSelect = useCallback((piece: PromotionPiece) => {
    if (gameState.pendingPromotion) {
      const { from, to } = gameState.pendingPromotion
      const uciMove = `${from}-${to}`
      setGameState(prev => ({ ...prev, pendingPromotion: null }))
      executeMove(uciMove, piece)
    }
  }, [gameState.pendingPromotion, executeMove])

  const handleResolutionComplete = useCallback(async () => {
    if (pendingOpponentTurnRef.current) {
      pendingOpponentTurnRef.current = false
      setGameState(prev => ({ ...prev, isBotThinking: true }))
      await executeBotMove()
// FIX: Reset resolution state when BLACK completes and WHITE turn starts
              console.log('[RESOLVE-CLEANUP] Clearing resolution state for new WHITE turn')
              setGameState(prev => ({ 
                ...prev, 
                isBotThinking: false, 
                highlightSquares: null, 
                pendingOverlay: null, 
                myPendingOverlay: null
              }))
      if (gameRef.current) {
        gameRef.current.startPendingTurn()
        updateStateRef.current()
      }

      if (!isOnline && !alreadyReassessedRef.current && bot && teammateBot && gameRef.current) {
        const g = gameRef.current
        const stats = g.getStats()
        if (stats.whiteMovesPlayed >= 4) {
          const avgAccuracy = (stats.player1Accuracy + stats.player2Accuracy) / 2

          let newLevel = 4
          if (avgAccuracy >= 92) newLevel = 6
          else if (avgAccuracy >= 85) newLevel = 5

          const oldLevel = bot.getConfig().skillLevel
          if (newLevel > oldLevel) {
            console.log(`[ADAPTIVE] Human avg accuracy: ${avgAccuracy.toFixed(1)}% across ${stats.whiteMovesPlayed} WHITE turns → upgrading bots from Level ${oldLevel} to Level ${newLevel}`)
            bot.setSkillLevel(newLevel)
            teammateBot.setSkillLevel(newLevel)
          } else {
            console.log(`[ADAPTIVE] Human avg accuracy: ${avgAccuracy.toFixed(1)}% across ${stats.whiteMovesPlayed} WHITE turns → keeping bots at Level ${oldLevel}`)
          }
          alreadyReassessedRef.current = true
        }
      }
    }
  }, [executeBotMove])

  const handleLeaveConfirm = useCallback(async () => {
    setShowLeaveModal(false)
    setLeavingConfirmed(true)
    if (isOnline && onlineGameRef.current) {
      await onlineGameRef.current.abandonMatch()
    }
    router.push('/')
  }, [isOnline, router])

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveModal(false)
  }, [])

  const { confirmLeave } = useNavigationGuard({
    enabled: isOnline && gameState.status === GameStatus.PLAYING,
    onAttemptLeave: () => setShowLeaveModal(true),
  })

  const handleLeaveModalConfirm = useCallback(() => {
    setShowLeaveModal(false)
    if (isOnline && onlineGameRef.current) {
      onlineGameRef.current.abandonMatch()
    }
    confirmLeave()
  }, [isOnline, confirmLeave])

  // Show lobby for online mode while waiting for game to start
  if (isOnline && gameState.status !== GameStatus.PLAYING && gameState.status !== GameStatus.GAME_OVER) {
    return (
      <GameLobby
        roomCode={roomCode}
        inviteUrl={inviteUrl}
        isLoading={gameState.isLoading}
      />
    )
  }

  // Show loading state for offline mode while game initializes
  if (gameState.isLoading) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <GameLoading 
          message={isOnline ? "Connecting to game server..." : "Initializing game..."} 
          roomCode={roomCode}
          inviteUrl={inviteUrl}
        />
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-2 md:p-4 overflow-x-hidden ${isMobile ? 'pb-16 pt-14' : ''}`}>
      {isMobile && (
        <MobileStatusBar
          currentTurn={gameState.currentTurn}
          timerSeconds={gameState.matchTimeRemaining}
          timerActive={gameState.matchTimerActive && gameState.status === GameStatus.PLAYING}
          whiteCaptured={gameState.capturedByWhite}
          blackCaptured={gameState.capturedByBlack}
        />
      )}
      {gameState.pendingPromotion && (
        <PromotionModal onSelect={handlePromotionSelect} />
      )}
      
      {gameState.status === GameStatus.GAME_OVER && (
        <GameOverModal 
          winner={gameState.currentTurn === Team.WHITE ? 'BLACK' : 'WHITE'}
          onPlayAgain={() => {
            router.push('/')
          }}
          gameResult={isOnline ? onlineGameRef.current?.getResult() : game?.getResult()}
          gameOverReason={isOnline ? (onlineGameRef.current?.getGameOverReason() || null) : (game?.getGameOverReason() || null)}
          showSignupPrompt={isGuest}
          onSignup={() => router.push('/?signup=1')}
        />
      )}

      {showGameOn && (
        <GameOnOverlay onComplete={handleGameOnComplete} />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {showResignConfirm && (
        <ResignConfirmModal
          onConfirm={() => {
            setShowResignConfirm(false)
            if (isOnline && onlineGameRef.current) {
              onlineGameRef.current.abandonMatch()
            }
            router.push('/')
          }}
          onCancel={() => setShowResignConfirm(false)}
        />
      )}
        
      <div className="w-full">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h1 className="text-lg md:text-2xl font-bold">ChessDuo</h1>
          {!isMobile && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOverlayMode('profile')}
                  className="min-h-[44px] min-w-[44px] rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
                  title="Profile"
                >
                  <User size={18} className="text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  onClick={() => setSoundEnabledState(!soundEnabled)}
                  className="min-h-[44px] min-w-[44px] rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center"
                  title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                >
                  {soundEnabled ? <Volume2 size={18} className="text-gray-600 dark:text-gray-300" /> : <VolumeX size={18} className="text-gray-400" />}
                </button>
              </div>
          )}
          <GameMenu
            onResign={() => setShowResignConfirm(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>

        <div className="relative flex justify-center mb-2 pb-6">
          <TeamIndicator
            whiteLabel="White Team (You)"
            blackLabel="Black Team (Bot)"
            activeTeam={gameState.currentTurn === Team.WHITE ? 'WHITE' : 'BLACK'}
            isGameOver={gameState.status === GameStatus.GAME_OVER}
            isBotThinking={gameState.isBotThinking ?? false}
          />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start justify-center gap-3 lg:gap-6 mb-3">
          {/* Left: Board column */}
          <div className="flex flex-col items-center gap-2">
            <MatchTimer
              seconds={gameState.matchTimeRemaining}
              isActive={gameState.matchTimerActive && gameState.status === GameStatus.PLAYING}
              totalSeconds={timeLimit}
            />
            <div className="w-full max-w-[94vw] md:max-w-[600px] lg:max-w-[720px] aspect-square flex-shrink-0 relative lg:max-h-[calc(100vh-220px)]">
              {isMobile ? (
                <MobileChessBoard
                  fen={playbackFen || gameState.fen}
                  onMove={handleMove}
                  enabled={overlayMode !== 'none' || playbackFen ? false : (gameState.status === GameStatus.PLAYING && gameState.currentTurn === Team.WHITE && !gameState.isBotThinking && !gameState.pendingPromotion && !(isOnline && playerId && (onlineGameRef.current as any)?.getAllPendingMoves?.()?.has(playerId)))}
                  orientation="white"
                  lastMove={gameState.lastMove}
                  pendingOverlay={gameState.pendingOverlay}
                  myPendingOverlay={gameState.myPendingOverlay}
                  highlightSquares={gameState.highlightSquares}
                  onAnimationComplete={handleResolutionComplete}
                />
              ) : (
                <ChessBoard 
                  fen={playbackFen || gameState.fen}
                  onMove={handleMove}
                  enabled={overlayMode !== 'none' || playbackFen ? false : (gameState.status === GameStatus.PLAYING && gameState.currentTurn === Team.WHITE && !gameState.isBotThinking && !gameState.pendingPromotion && !(isOnline && playerId && (onlineGameRef.current as any)?.getAllPendingMoves?.()?.has(playerId)))}
                  orientation="white"
                  lastMove={gameState.lastMove}
                  pendingOverlay={gameState.pendingOverlay}
                  myPendingOverlay={gameState.myPendingOverlay}
                  highlightSquares={gameState.highlightSquares}
                  onAnimationComplete={handleResolutionComplete}
                />
              )}
            </div>
            {/* Captured pieces - compact row below board */}
            <div className="flex items-center justify-center gap-4 md:gap-8 mt-1 w-full max-w-[94vw] md:max-w-[600px] lg:max-w-[720px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">White:</span>
                <CapturedPiecesRow pieces={gameState.capturedByWhite} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">Black:</span>
                <CapturedPiecesRow pieces={gameState.capturedByBlack} />
              </div>
            </div>
          </div>

          {/* Right: Accuracy Panel - on desktop appears beside board, on mobile below */}
          <div className="w-full max-w-[94vw] md:max-w-[600px] lg:w-72 lg:max-w-none lg:pt-9 mx-auto lg:mx-0">
            {(() => {
              const g = isOnline ? onlineGameRef.current : gameRef.current
              return (
                <>
                  {!accuracyComparison && turnState === 'resolving' && (
                    <EvaluatingLoader />
                  )}
                  <AccuracyBottomSheet 
                    comparison={accuracyComparison}
                    isVisible={!!accuracyComparison}
                    playerId={playerId}
                    player1Id={isOnline ? (g as any)?.player1Id : null}
                  />
                </>
              )
            })()}
          </div>
        </div>

        <div className="mt-4 text-center">
          {gameState.selectedMove && (
              <p className="text-green-600 dark:text-green-400">Selected: {gameState.selectedMove}</p>
            )}
            {gameState.status === GameStatus.GAME_OVER && (
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {isOnline && onlineGameRef.current ? 'Game Over' : game?.getResult()}
              </p>
            )}
            {gameState.isBotThinking && (
              <p className="text-blue-600 dark:text-blue-400">Bot is making a move...</p>
          )}
        </div>

        <div className="mt-4 md:mt-6 w-full max-w-[500px] mx-auto">
          <MovePlayback
            moves={moveHistoryRef.current}
            currentIndex={playbackIndex}
            initialFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            onSelectMove={(index, fen) => {
              setPlaybackIndex(index)
              setPlaybackFen(fen)
            }}
            onReset={() => {
              setPlaybackIndex(null)
              setPlaybackFen(null)
            }}
          />
        </div>

      </div>

      <SlideOver
        open={overlayMode === 'profile'}
        onClose={() => setOverlayMode('none')}
        title="Profile"
      >
        {playerId ? (
          <ProfilePanel
            playerId={playerId}
            onViewHistory={() => setOverlayMode('history')}
          />
        ) : (
          <p className="text-gray-400 text-center py-4">Sign in to view your profile</p>
        )}
      </SlideOver>

      <SlideOver
        open={overlayMode === 'history'}
        onClose={() => setOverlayMode('none')}
        title="Match History"
      >
        {playerId ? (
          <HistoryPanel playerId={playerId} />
        ) : (
          <p className="text-gray-400 text-center py-4">Sign in to view match history</p>
        )}
      </SlideOver>

      {isMobile && (
        <BottomNav
          activeOverlay={overlayMode}
          onProfileClick={() => {
            if (!playerId) {
              setOverlayMode('profile')
              return
            }
            setOverlayMode(overlayMode === 'profile' ? 'none' : 'profile')
          }}
          onHistoryClick={() => {
            if (!playerId) {
              setOverlayMode('profile')
              return
            }
            setOverlayMode(overlayMode === 'history' ? 'none' : 'history')
          }}
          onSoundToggle={() => setSoundEnabledState(!soundEnabled)}
          soundEnabled={soundEnabled}
        />
      )}

      <LeaveConfirmModal
        open={showLeaveModal}
        onCancel={handleLeaveCancel}
        onConfirm={handleLeaveModalConfirm}
      />
    </div>
  )
}