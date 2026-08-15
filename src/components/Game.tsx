'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChessBoard, PendingOverlay, HighlightSquares } from './ChessBoard'
import type { PromotionPiece } from '@/features/shared/gameTypes'
import { MobileChessBoard } from './MobileChessBoard'
import { LocalGame } from '@/features/offline/game/localGame'
import { GameStatus, MoveComparison } from '@/features/shared/gameTypes'
import { OnlineGame } from '@/features/online/game/onlineGame'
import type { GameInterface } from '@/features/shared/GameInterface'
import { Team, Player } from '@/features/game-engine/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/features/bots/chessBot'
import { createBotConfig, getBotConfig } from '@/features/bots/botConfig'
import { supabase, Room } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { getAppBaseUrl } from '@/lib/appUrl'
import { normalizeUci, uciToSan, getMoveFromUci } from '@/lib/chessUtils'
import { MoveComparisonPanel } from './MoveComparison'
import { GameOverModal } from './GameOverModal'
import { AnalyzingIndicator } from './AnalyzingIndicator'
import { GameLoading } from './GameLoading'
import { GameLobby } from './GameLobby'
import { GameOnOverlay } from './GameOnOverlay'
import { EvaluatingLoader } from './EvaluatingLoader'
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playLockSound, playResolutionSound, setSoundEnabled as setEngineSoundEnabled, soundEngine } from '@/lib/sounds'
import { saveCompletedGame } from '@/lib/matchHistory'
import type { MoveEntry } from './MovePlayback'
import { SlideOver } from './SlideOver'
import { ProfilePanel } from './ProfilePanel'
import { HistoryPanel } from './HistoryPanel'
import { GameMenu } from './GameMenu'
import { SettingsPanel } from './SettingsPanel'
import { ResignConfirmModal } from './ResignConfirmModal'
import { useSettings } from '@/hooks/useSettings'
import { BoardTopBar, type BoardTopBarPlayer } from './BoardTopBar'
import { type HumanAvatar } from '@/features/shared/avatars'
import { PendingMovesRow, type PendingMove } from './PendingMovesRow'
import { ConfirmMoveBar } from './ConfirmMoveBar'
import { MoveResolvedInline, type MoveResolutionData } from './MoveResolvedInline'
import { RoundHistorySidebar, type RoundHistoryEntry } from './RoundHistorySidebar'
import { BoardBottomNav, type BoardTab } from './BoardBottomNav'
import { ChatPanel } from './ChatPanel'
import { MoveInsights } from './MoveInsights'
import { LeaveConfirmModal } from './LeaveConfirmModal'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useGameToast } from './Toast'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { getUserInsightsState, incrementInsightsReveals } from '@/lib/insights'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, BarChart3 } from 'lucide-react'

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
  fourplayer?: boolean
  playerColor?: 'white' | 'black' | 'random'
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
  turnStatus: 'your_turn' | 'selecting' | 'waiting_for_teammate' | 'teammate_locked' | 'evaluating' | 'opponent_turn' | 'waiting'
  winner: 'WHITE' | 'BLACK' | 'DRAW' | null
}

const DEBUG = process.env.NODE_ENV === 'development'

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

function CapturedPiecesDisplay({ pieces, label }: { pieces: string[], label: string }) {
  const sortedPieces = [...pieces].sort((a, b) => {
    const order = ['q', 'r', 'b', 'n', 'p']
    return order.indexOf(a) - order.indexOf(b)
  })
  
  return (
    <div className="flex flex-col items-center">
      <span className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</span>
      <div className="flex flex-wrap gap-0.5 md:gap-1 p-1.5 md:p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 min-h-[44px] md:min-h-[44px] min-w-[60px] md:min-w-[80px] justify-center content-start">
        {sortedPieces.length === 0 ? (
          <span className="text-gray-400 dark:text-gray-600 text-[11px] md:text-xs">No captures</span>
        ) : (
          sortedPieces.map((piece, index) => (
            <span 
              key={`${piece}-${index}`} 
              className="text-lg md:text-2xl bg-gray-200 dark:bg-gray-700 rounded px-0.5 md:px-1 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500"
            >
              {PIECE_SYMBOLS[piece] || piece}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function PromotionModal({ onSelect }: { onSelect: (piece: PromotionPiece) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-yellow-500 shadow-xl"
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">Promote Pawn</h3>
        <div className="flex gap-4">
          {PROMOTION_PIECES.map(({ piece, symbol, label }) => (
            <button
              key={piece}
              onClick={() => onSelect(piece)}
              className="flex flex-col items-center p-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg border border-gray-300 dark:border-gray-500 transition-colors min-h-[44px] min-w-[44px]"
            >
              <span className="text-4xl text-gray-900 dark:text-white mb-1">{symbol}</span>
              <span className="text-xs text-gray-500 dark:text-gray-300">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Game({ level, roomCode, mode, roomId, team, playerId: playerIdFromProps, timeLimitSeconds, fourplayer = false, playerColor = 'white' }: GameProps) {
  const router = useRouter()
  DEBUG && console.log('[Game] Component rendered with:', { level, roomCode, mode, roomId, team, playerId: playerIdFromProps, fourplayer })
  
  const [game] = useState(() => mode !== 'online' ? new LocalGame(timeLimitSeconds, playerColor) : null)
  const [onlineGame] = useState(() => {
    DEBUG && console.log('[Game] Creating OnlineGame, mode:', mode)
    return mode === 'online' ? new OnlineGame(timeLimitSeconds) : null
  })
  const isOnline = mode === 'online'
  DEBUG && console.log('[Game] isOnline:', isOnline, 'onlineGame:', !!onlineGame)

  // Track viewer's team (from prop in online mode, cached after joinRoom)
  const myTeamRef = useRef<'WHITE' | 'BLACK'>(team || 'WHITE')
  // 4-player mode: all humans, no bots
  const isFourPlayer = fourplayer

  // Bot ELO level for online mode (selectable in lobby, defaults to level prop or 4)
  const [botEloLevel, setBotEloLevel] = useState(level || 4)

  // Create bot config (used for opponent bots in online mode, and both bots in offline)
  const botConfig = useMemo(() => {
    if (level && level >= 1 && level <= 6) {
      DEBUG && console.log(`[Game] Using URL level: ${level}`)
      return createBotConfig(level, level)
    }
    if (isOnline && !isFourPlayer) {
      DEBUG && console.log(`[Game] Using lobby-selected level: ${botEloLevel}`)
      return createBotConfig(botEloLevel, botEloLevel)
    }
    DEBUG && console.log('[Game] No level selected, using default config')
    return getBotConfig()
  }, [level, botEloLevel, isOnline, isFourPlayer])

  const bot = useMemo(() => {
    if (isFourPlayer || !botConfig) return null
    const botInstance = createBot({ skillLevel: botConfig.opponentSkillLevel })
    DEBUG && console.log(`[Game] Opponent bot created with level: ${botConfig.opponentSkillLevel}, description: ${botInstance.getSkillDescription()}`)
    return botInstance
  }, [isFourPlayer, botConfig])
  const teammateBot = useMemo(() => {
    if (isFourPlayer || !botConfig) return null
    const botInstance = createBot({ skillLevel: botConfig.teammateSkillLevel })
    DEBUG && console.log(`[Game] Teammate bot created with level: ${botConfig.teammateSkillLevel}, description: ${botInstance.getSkillDescription()}`)
    return botInstance
  }, [isFourPlayer, botConfig])

  // Check for mobile WASM engine errors
  useEffect(() => {
    const checkEvaluatorError = (botInstance: ReturnType<typeof createBot> | null) => {
      if (!botInstance) return
      const evaluator = botInstance.getEvaluator()
      if (evaluator && 'getInitError' in evaluator) {
        const err = (evaluator as any).getInitError()
        if (err) {
          toast.error(`Engine failed: ${err}`)
        }
      }
    }
    checkEvaluatorError(bot)
    checkEvaluatorError(teammateBot)
  }, [bot, teammateBot])
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
    matchTimeRemaining: timeLimitSeconds || 600,
    matchTimerActive: false,
    pendingOverlay: null,
    myPendingOverlay: null,
    highlightSquares: null,
    isLoading: true,
    turnStatus: 'waiting',
    winner: null
  })

  const toast = useGameToast()
  const [accuracyComparison, setAccuracyComparison] = useState<MoveComparison | null>(null)
  const [accuracyHistory, setAccuracyHistory] = useState<MoveComparison[]>([])
  const [showGameOn, setShowGameOn] = useState(false)
  const settings = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showGameOverDismissed, setShowGameOverDismissed] = useState(false)
  const isMobile = useIsMobile()

  useNavigationGuard({
    enabled: gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.READY || gameState.status === GameStatus.WAITING,
    onAttemptLeave: () => setShowLeaveModal(true),
  })

  const prevTurnRef = useRef<Team | null>(null)
  const gameSavedRef = useRef(false)
  const moveHistoryRef = useRef<MoveEntry[]>([])
  const teammateLabelShownRef = useRef(0)
  const lastTeammateLabelMoveKeyRef = useRef<string | null>(null)
  // Sound tracking refs — compare prev/current state to trigger sounds
  const prevFenRef = useRef('')
  const prevCapturedWhiteRef = useRef(0)
  const prevCapturedBlackRef = useRef(0)
  const prevStatusRef = useRef<GameStatus | null>(null)
  const [matchTimerStarted, setMatchTimerStarted] = useState(false)
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null)
  const [playbackFen, setPlaybackFen] = useState<string | null>(null)
  const [disconnectedAge, setDisconnectedAge] = useState(0)

  // Auto-reset playback to live position only after game ends (not during active play)
  const prevGameFenRef = useRef(gameState.fen)
  useEffect(() => {
    if (playbackFen !== null && gameState.fen !== prevGameFenRef.current && gameState.status === GameStatus.GAME_OVER) {
      setPlaybackFen(null)
      setPlaybackIndex(null)
    }
    prevGameFenRef.current = gameState.fen
  }, [gameState.fen, gameState.status])

  // Poll connection health for reconnection countdown display
  useEffect(() => {
    if (!isOnline) return
    const interval = setInterval(() => {
      const age = onlineGameRef.current?.disconnectedAgeMs ?? 0
      setDisconnectedAge(age)
    }, 1000)
    return () => clearInterval(interval)
  }, [isOnline])

  const [overlayMode, setOverlayMode] = useState<'none' | 'profile' | 'history'>('none')
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null)
  const [activeBoardTab, setActiveBoardTab] = useState<BoardTab>('game')
  const [showRoundHistory, setShowRoundHistory] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [insightsState, setInsightsState] = useState<{ isPremium: boolean; revealsRemaining: number | null }>({ isPremium: false, revealsRemaining: null })
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())

  const closeAllPanels = useCallback(() => {
    setShowRoundHistory(false)
    setShowInsights(false)
    setShowChat(false)
    setOverlayMode('none')
  }, [])

  const handleUpgradeClick = useCallback(() => {
    router.push('/premium')
  }, [router])
  const [heldMove, setHeldMove] = useState<{ move: string; promotion?: PromotionPiece } | null>(null)
  const [boardKey, setBoardKey] = useState(0)
  const [userProfile, setUserProfile] = useState<{ username: string | null; avatarUrl: string | null }>({ username: null, avatarUrl: null })
  const playerId = playerIdFromProps || sessionPlayerId
  const playerIdRef = useRef(playerId)
  playerIdRef.current = playerId

  const inputLockedRef = useRef(false)
  const submissionTurnRef = useRef(false)

  useEffect(() => {
    if (!showInsights || !playerId) return
    if (insightsState.revealsRemaining !== null) return
    getUserInsightsState(playerId).then((state) => {
      setInsightsState({ isPremium: state.isPremium, revealsRemaining: state.revealsRemaining })
    }).catch(() => {
      setInsightsState({ isPremium: false, revealsRemaining: 3 })
    })
  }, [showInsights, playerId])

  const handleRevealMove = useCallback(async (index: number) => {
    if (!playerId || insightsState.revealsRemaining === null || insightsState.revealsRemaining <= 0) return
    const remaining = await incrementInsightsReveals(playerId)
    setInsightsState(prev => ({ ...prev, revealsRemaining: remaining }))
    setRevealedIndices(prev => {
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }, [playerId, insightsState.revealsRemaining])

  const handleHardwareBack = useCallback(() => {
    // First: close any open submenu
    if (showRoundHistory) { setShowRoundHistory(false); return true }
    if (showInsights) { setShowInsights(false); return true }
    if (showChat) { setShowChat(false); return true }
    if (showSettings) { setShowSettings(false); return true }
    if (showResignConfirm) { setShowResignConfirm(false); return true }
    if (showLeaveModal) { setShowLeaveModal(false); return true }
    // Second: if game is active, show leave confirmation
    if (gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.READY || gameState.status === GameStatus.WAITING) {
      setShowLeaveModal(true)
      return true
    }
    return false
  }, [gameState.status, showRoundHistory, showInsights, showChat, showSettings, showResignConfirm, showLeaveModal])

  useCapacitorBackButton(handleHardwareBack, gameState.status === GameStatus.PLAYING || gameState.status === GameStatus.READY || gameState.status === GameStatus.WAITING)

  useEffect(() => {
    let active = true
    AuthService.getSession().then(session => {
      if (active) setSessionPlayerId(session?.user?.id ?? null)
    }).catch(() => {
      // session unavailable — fall back to URL-provided playerId
    })
    const unsubscribe = AuthService.onAuthChange((_event, session) => {
      if (active) setSessionPlayerId(session?.user?.id ?? null)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Fetch the current user's profile (username + Google avatar) when playerId is known
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
        if (error) {
          DEBUG && console.warn('[Profile] Failed to fetch user profile:', error.message)
          return
        }
        if (data) {
          setUserProfile({ username: data.username || null, avatarUrl: data.avatar_url || null })
        }
      })
      .catch(() => {
        // profile fetch is non-critical — keep nulls
      })
    return () => {
      active = false
    }
  }, [playerId])
  const teamRef = useRef<string | undefined>(team)
  teamRef.current = team
  const [teamLabels, setTeamLabels] = useState<{ white: string; black: string; blackIsBot: boolean }>({ white: 'White Team', black: 'Black Team', blackIsBot: true })
  const teamNamesFetchedRef = useRef(false)

  const fetchTeamNames = useCallback(async () => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    if (!playerId) {
      setTeamLabels({ white: 'White Team (You)', black: 'Black Team (Bot)', blackIsBot: true })
      return
    }

    const myTeam = g.getTeam() || myTeamRef.current

    try {
      const isHumanId = (id: string) => !id.startsWith('bot_') && !/^player\d+$/.test(id) && id.length > 8

      const fetchUsernames = async (ids: string[]): Promise<Record<string, string>> => {
        const humanIds = ids.filter(id => isHumanId(id) && id !== playerId)
        if (humanIds.length === 0) return {}
        const { data } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', humanIds)
        const map: Record<string, string> = {}
        if (data) data.forEach((p: { id: string; username: string }) => { map[p.id] = p.username || 'Player' })
        return map
      }

      const whitePlayers = g.getPlayers(Team.WHITE)
      const blackPlayers = g.getPlayers(Team.BLACK)
      const blackHasBots = blackPlayers.some(id => !isHumanId(id))

      const whiteUsernames = await fetchUsernames(whitePlayers)
      const blackUsernames = await fetchUsernames(blackPlayers)

      let whiteLabel = 'White Team'
      let blackLabel = 'Black Team'
      let blackIsBot = true

      if (myTeam === 'WHITE') {
        const teammateIds = whitePlayers.filter(id => id !== playerId && isHumanId(id))
        const teammateNames = teammateIds.map(id => whiteUsernames[id] || 'Player')
        whiteLabel = 'White Team (You)'
        if (teammateNames.length > 0) whiteLabel += `, ${teammateNames.join(', ')}`

        if (!blackHasBots) {
          const oppNames = blackPlayers.filter(id => isHumanId(id)).map(id => blackUsernames[id] || 'Player')
          blackLabel = oppNames.length > 0 ? `Black Team · ${oppNames.join(', ')}` : 'Black Team'
          blackIsBot = false
        } else {
          blackLabel = 'Black Team (Bot)'
        }
      } else {
        const oppIds = whitePlayers.filter(id => isHumanId(id))
        const oppNames = oppIds.map(id => whiteUsernames[id] || 'Player')
        whiteLabel = oppNames.length > 0 ? `White Team · ${oppNames.join(', ')}` : 'White Team'

        const teammateIds = blackPlayers.filter(id => id !== playerId && isHumanId(id))
        const teammateNames = teammateIds.map(id => blackUsernames[id] || 'Player')
        blackLabel = 'Black Team (You)'
        if (teammateNames.length > 0) blackLabel += `, ${teammateNames.join(', ')}`
        blackIsBot = blackHasBots
      }

      setTeamLabels({ white: whiteLabel, black: blackLabel, blackIsBot })
    } catch {
      // fallback to default labels — supabase query may fail during development
    }
  }, [isOnline, playerId])

  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING && !teamNamesFetchedRef.current) {
      teamNamesFetchedRef.current = true
      fetchTeamNames()
    }
  }, [gameState.status, fetchTeamNames])

  // Update sound engine when setting changes
  useEffect(() => {
    setEngineSoundEnabled(settings.soundEnabled)
  }, [settings.soundEnabled])

  // Initialize AudioContext on user gesture for browsers / mobile WebView
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

  // Game ON overlay — show when game transitions to PLAYING, then start timer
  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING && !matchTimerStarted && !showGameOn) {
      setShowGameOn(true)
    }
    if (gameState.status === GameStatus.GAME_OVER && matchTimerStarted) {
      setMatchTimerStarted(false)
    }
  }, [gameState.status, showGameOn, matchTimerStarted])

  const handleGameOnComplete = useCallback(() => {
    setShowGameOn(false)
    if (!matchTimerStarted) {
      setMatchTimerStarted(true)
    }
  }, [matchTimerStarted])

  useEffect(() => {
    if (gameState.status !== GameStatus.GAME_OVER) return
    if (gameSavedRef.current) return

    setShowGameOverDismissed(false)

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
      playerLabels: {
        white: teamLabels.white.split(',').map(s => s.trim().replace(/[()]/g, '').trim()),
        black: teamLabels.black.split(',').map(s => s.trim().replace(/[()]/g, '').trim()),
      },
    }, playerId || undefined)

    toast.gameOver(result)

    if (playerId) gameSavedRef.current = true
  }, [gameState.status, isOnline, game, toast, playerId])

  // Warn when match is abandoned by teammate — no auto-redirect, user stays to review
  const abandonNotifiedRef = useRef(false)
  useEffect(() => {
    if (!isOnline) return
    if (gameState.status !== GameStatus.GAME_OVER) return
    const reason = onlineGameRef.current?.getGameOverReason()
    if (reason !== 'abandoned') return
    if (abandonNotifiedRef.current) return
    abandonNotifiedRef.current = true
    toast.warning('Match abandoned by teammate — you can review the board')
  }, [gameState.status, isOnline, toast])

  // Set up state change callback for online mode - MUST be before joinRoom
  const onlineGameRef = useRef(onlineGame)
  useEffect(() => {
    DEBUG && console.log('[Game] setOnStateChange useEffect, onlineGame:', !!onlineGame)
    if (!onlineGame) {
      DEBUG && console.log('[Game] No onlineGame, skipping setOnStateChange')
      return
    }
    
    onlineGameRef.current = onlineGame
    DEBUG && console.log('[Game] Setting up setOnStateChange callback')
    onlineGame.setOnStateChange(() => {
      DEBUG && console.log('[Game] 🔥 State change callback triggered!')
      if (onlineGameRef.current) {
        const g = onlineGameRef.current
        const captured = g.getCapturedPieces()
        DEBUG && console.log('[Game] New state:', { status: g.status, fen: g.fen, turn: g.currentTurn })
        
        // Determine viewer's team (use refs to avoid stale closure)
        const currentPlayerId = playerIdRef.current
        const currentTeam = teamRef.current
        const myTeam = currentTeam || (g as GameInterface).getTeam()
        if (myTeam) myTeamRef.current = myTeam as 'WHITE' | 'BLACK'
        
        // Get pendingOverlay for online mode - show teammate's pending move
        // Only show moves from same-team players (not opponent bot/player moves)
        let pendingOverlay: PendingOverlay | null = null
        if (currentPlayerId) {
          const allMoves = (g as GameInterface).getAllPendingMoves() as Map<string, any>
          const entries = Array.from(allMoves.entries()) as [string, any][]
          const otherPlayerMoves = entries.filter(([p]) => p !== currentPlayerId && (g as GameInterface).getPlayerTeam(p) === myTeam)
          
          // Only show pendingOverlay if there's a teammate move (not my own)
          if (otherPlayerMoves.length > 0) {
            const [, teammatePending] = otherPlayerMoves[0]
            if (teammatePending.from && teammatePending.to) {
              let piece = teammatePending.piece
              if (!piece || piece === 'unknown') {
                try {
                  const boardPiece = (g as GameInterface).board.get(teammatePending.from)
                  piece = boardPiece?.type || 'p'
                } catch {
                  piece = 'p'
                }
              }
              pendingOverlay = { from: teammatePending.from, to: teammatePending.to, piece, color: g.currentTurn === Team.WHITE ? 'white' : 'black', showTeammateLabel: teammateLabelShownRef.current < 3 && g.currentTurn === myTeam }
            }
          }
        }
        
        // Get my pending overlay - show my own pending move as secondary animation
        // FIX: Only show if I have a pending move that is NOT locked (still selecting)
        // If I've already locked my move, don't show myPendingOverlay (avoid duplicate)
        let myPendingOverlay: PendingOverlay | null = null
        if (currentPlayerId) {
          const allMoves = (g as GameInterface).getAllPendingMoves() as Map<string, any>
          const myPending = allMoves.get(currentPlayerId)
          // Only show myPendingOverlay if I have a move AND it's not locked yet
          if (myPending && !myPending.locked && myPending.from && myPending.to) {
            let piece = myPending.piece
            if (!piece || piece === 'unknown') {
              try {
                const boardPiece = (g as GameInterface).board.get(myPending.from)
                piece = boardPiece?.type || 'p'
              } catch {
                piece = 'p'
              }
            }
            myPendingOverlay = { from: myPending.from, to: myPending.to, piece, color: g.currentTurn === Team.WHITE ? 'white' : 'black' }
          }
        }
        
        // Compute turnStatus for UI
        // In 4-player mode: detailed status only when it's YOUR team's turn
        // In 2-player mode: detailed status only when it's YOUR team's turn
        const isMyTurnToAct = isFourPlayer
          ? g.currentTurn === myTeam
          : g.currentTurn === myTeam
        let turnStatus: GameState['turnStatus'] = 'waiting'
        if (g.status === GameStatus.PLAYING && isMyTurnToAct && currentPlayerId) {
          const ts = (g as GameInterface).getTurnState()
          const allMovesLocal = (g as GameInterface).getAllPendingMoves() as Map<string, any>
          const localEntries = Array.from(allMovesLocal.entries()) as [string, any][]
          const localOtherPlayer = localEntries.filter(([p]) => p !== currentPlayerId && (g as GameInterface).getPlayerTeam(p) === myTeam)
          const localMyPending = allMovesLocal.get(currentPlayerId)
          const localTeammateLocked = localOtherPlayer.length > 0 && localOtherPlayer[0][1]?.locked
          if (ts === 'resolving' || ts === 'locked') turnStatus = 'evaluating'
          else if (localTeammateLocked) turnStatus = 'teammate_locked'
          else if (localOtherPlayer.length > 0 || localMyPending) turnStatus = 'waiting_for_teammate'
          else turnStatus = 'your_turn'
          DEBUG && console.log(`[TURN-STATUS] myTurn=${isMyTurnToAct}, ts=${ts}, otherPlayer=${localOtherPlayer.length}, myPending=${!!localMyPending}, teammateLocked=${localTeammateLocked} → ${turnStatus}`)
        } else if (g.status === GameStatus.PLAYING) {
          turnStatus = 'opponent_turn'
          DEBUG && console.log(`[TURN-STATUS] opponent_turn (isMyTurnToAct=${isMyTurnToAct}, hasPlayerId=${!!currentPlayerId})`)
        }

        setGameState(prev => {
          const winner = g.status === GameStatus.GAME_OVER
            ? (g.getResult().includes('White wins') ? 'WHITE' as const
              : g.getResult().includes('Black wins') ? 'BLACK' as const
              : 'DRAW' as const)
            : prev.winner

          return {
            ...prev,
            status: g.status,
            fen: g.fen,
            currentTurn: g.currentTurn,
            isMyTurn: isMyTurnToAct,
            capturedByWhite: captured.white,
            capturedByBlack: captured.black,
            lastMove: g.lastMove,
            matchTimeRemaining: g.getMatchTimeRemaining(),
            matchTimerActive: g.isMatchTimerActive(),
            isLoading: g.status === GameStatus.WAITING ? prev.isLoading : false,
            pendingOverlay,
            myPendingOverlay,
            turnStatus,
            winner
          }
        })
        
        if (pendingOverlay?.showTeammateLabel) {
          const labelKey = `${pendingOverlay.from}-${pendingOverlay.to}`
          if (labelKey !== lastTeammateLabelMoveKeyRef.current) {
            teammateLabelShownRef.current += 1
            lastTeammateLabelMoveKeyRef.current = labelKey
          }
        }
        const prevTurn = prevTurnRef.current
        const currentTurn = g.currentTurn

        // Populate accuracyHistory deterministically: use moveHistoryRef length
        // as the authoritative count (both clients receive the same resolutions
        // via turn_resolved broadcasts). Only add when there's a new comparison
        // with a turnStartFen not already in the history.
        const comp = g.lastMoveComparison as MoveComparison | null
        if (comp && comp.turnStartFen) {
          const shouldAdd = accuracyHistory.length === 0 ||
            accuracyHistory[accuracyHistory.length - 1]?.turnStartFen !== comp.turnStartFen
          if (shouldAdd) {
            // Only add comparisons for the viewer's team turns (same logic as before)
            const isViewerTeamTurn = !isFourPlayer && (
              (prevTurn === Team.WHITE && currentTurn === Team.BLACK && myTeam === 'WHITE') ||
              (prevTurn === Team.BLACK && currentTurn === Team.WHITE && myTeam === 'BLACK')
            )
            if (isViewerTeamTurn || isFourPlayer) {
              setAccuracyHistory(prev => [...prev, comp])
              DEBUG && console.log(`[ACCURACY-HISTORY] Added entry #${accuracyHistory.length + 1}, team=${prevTurn}, viewerTeam=${myTeam}`)
            }
          }
        }

        // Set the current accuracy comparison for inline display
        if (prevTurn === Team.WHITE && currentTurn === Team.BLACK) {
          if (comp) {
            if (!isFourPlayer || myTeam === 'WHITE') {
              setAccuracyComparison(comp)
              DEBUG && console.log('[ACCURACY-TRANSITION] SET accuracyComparison for WHITE→BLACK')
            }
          } else {
            DEBUG && console.log('[ACCURACY-TRANSITION] No comparison available, accuracy NOT set')
          }
        } else if (prevTurn === Team.BLACK && currentTurn === Team.WHITE) {
          if (comp) {
            if (!isFourPlayer || myTeam === 'BLACK') {
              setAccuracyComparison(comp)
              DEBUG && console.log('[ACCURACY-TRANSITION] SET accuracyComparison for BLACK→WHITE')
            }
          } else {
            DEBUG && console.log('[ACCURACY-TRANSITION] No comparison available, accuracy NOT set')
          }
        }
    prevTurnRef.current = currentTurn

    if (comp && moveHistoryRef.current.length === 0 ||
        (comp && comp !== (moveHistoryRef.current[moveHistoryRef.current.length - 1] as unknown))) {
      const humanSlot = (g as GameInterface).getHumanSlot?.() || 'player1'
      const isHumanWinner = comp.winnerId === humanSlot
      const entry: MoveEntry = {
        turn: moveHistoryRef.current.length + 1,
        team: prevTurn || currentTurn,
        winningMove: comp.winningMove,
        winningMoveUci: comp.winningMove || '',
        shadowMove: comp.isSync ? null : (isHumanWinner ? comp.player2Move : comp.player1Move),
        shadowMoveUci: '',
        isSync: comp.isSync,
        player1Accuracy: comp.player1Accuracy,
        player2Accuracy: comp.player2Accuracy,
        fenAfter: g.board.fen(),
      }
      moveHistoryRef.current = [...moveHistoryRef.current, entry]
    }
        DEBUG && console.log('[ACCURACY-TRANSITION] prevTurn tracked:', prevTurn, '→', currentTurn)

        // Trigger initial bot turn when game first enters PLAYING (online, human on non-first-turn team)
        if (!initialBotTurnTriggeredRef.current && g.status === GameStatus.PLAYING) {
          const myTeam2 = currentTeam || (g as GameInterface).getTeam()
          const opponentTeam2 = myTeam2 === 'WHITE' ? Team.BLACK : Team.WHITE
          if (!isFourPlayer && g.currentTurn === opponentTeam2 && bot && currentPlayerId && g.isCoordinator()) {
            initialBotTurnTriggeredRef.current = true
            DEBUG && console.log(`[INITIAL-BOT] Triggering initial ${opponentTeam2} bot turn from onStateChange`)
            setGameState(prev => ({ ...prev, isBotThinking: true }))
            const currentFen = g.board.fen()
            ;(async () => {
              const botUciMove = await bot.selectBestMove(currentFen)
              const opponentSlots = g.getPlayers(opponentTeam2)

              const processBotMove = (uciMove: string) => {
                const sanMove = uciToSan(uciMove, currentFen)
                const moveInfo = getMoveFromUci(uciMove, currentFen)
                if (moveInfo) {
                  for (const slot of opponentSlots) {
                    g.setPendingMove(slot, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
                    g.lockPendingMove(slot)
                  }
                }
              }

              if (!botUciMove) {
                const chess = new Chess(currentFen)
                const legalMoves = chess.moves({ verbose: true })
                if (legalMoves.length > 0) {
                  processBotMove(legalMoves[0].from + legalMoves[0].to)
                }
              } else {
                processBotMove(botUciMove)
              }

              try {
                await g.resolvePendingMoves()
                DEBUG && console.log(`[INITIAL-BOT] Resolve succeeded, new turn:`, g.currentTurn)
                g.setTurnState('selecting')
                updateStateRef.current()
              } catch (e) {
                DEBUG && console.log(`[INITIAL-BOT] Resolve failed:`, e)
                // Recovery: reset turn state so humans can still play
                initialBotTurnTriggeredRef.current = false
                g.setTurnState('selecting')
                updateStateRef.current()
              }
            })()
          }
        }
      }
    })
    DEBUG && console.log('[Game] setOnStateChange callback set up complete')

    // Set onAbandonCallback so resigning triggers state update and save
    onlineGame.setOnAbandonCallback(() => {
      DEBUG && console.log('[Game] 🔥 Abandon callback triggered!')
      if (onlineGameRef.current) {
        const g = onlineGameRef.current
        const captured = g.getCapturedPieces()
        const currentPlayerId = playerIdRef.current
        const currentTeam = teamRef.current
        const myTeam = currentTeam || (g as GameInterface).getTeam()
        if (myTeam) myTeamRef.current = myTeam as 'WHITE' | 'BLACK'

        setGameState(prev => ({
          ...prev,
          status: GameStatus.GAME_OVER,
          fen: g.fen,
          currentTurn: g.currentTurn,
          capturedByWhite: captured.white,
          capturedByBlack: captured.black,
          lastMove: g.lastMove,
          matchTimeRemaining: g.getMatchTimeRemaining(),
          matchTimerActive: false,
          winner: g.getResult().includes('White wins') ? 'WHITE' : g.getResult().includes('Black wins') ? 'BLACK' : 'DRAW'
        }))
      }
    })
  }, [onlineGame, playerId])

  // Initialize online game - runs AFTER setOnStateChange is set up
  useEffect(() => {
    DEBUG && console.log('[Game][DIAG] JoinRoom useEffect firing:', {
      mode,
      isOnline,
      hasOnlineGame: !!onlineGame,
      playerId,
      roomId,
      team,
      conditionsMet: mode === 'online' && !!onlineGame && !!playerId && !!roomId && !!team,
      fourplayer,
    })
    
    if (mode === 'online' && onlineGame && playerId && roomId && team) {
      DEBUG && console.log('[Game][DIAG] ✅ Calling joinRoom with:', { roomId, playerId, team })
      onlineGame.joinRoom({ id: roomId } as Room, playerId, team)
      const actualTeam = onlineGame.getTeam()
      if (actualTeam) myTeamRef.current = actualTeam as 'WHITE' | 'BLACK'
    } else {
      DEBUG && console.log('[Game][DIAG] ❌ joinRoom NOT called - conditions not met')
    }
  }, [mode, onlineGame, playerId, roomId, team])

  const matchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const matchTimeoutFlagRef = useRef(false)
  const gameRef = useRef(game)
  const opponentInProgressRef = useRef(false)
  const pendingOpponentTurnRef = useRef(false)
  const initialBotTurnTriggeredRef = useRef(false)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  const tickMatchTimer = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    if (g.status === GameStatus.GAME_OVER) return

    const turnState = (g as GameInterface).getTurnState()
    if (turnState !== 'selecting') return
    if (g.currentTurn !== myTeamRef.current) return

    const remaining = g.getMatchTimeRemaining()
    if (remaining <= 0) {
      // R18 fix: for online games, the engine owns timeout detection — don't double-fire
      if (isOnline) return
      if (matchTimerRef.current) {
        clearInterval(matchTimerRef.current)
        matchTimerRef.current = null
      }
      if (matchTimeoutFlagRef.current) return
      matchTimeoutFlagRef.current = true
      g.setMatchTimerActive(false)
      g.setMatchTimeRemaining(0)

      const captured = g.getCapturedPieces()
      const whiteCaptured = captured.white.length
      const blackCaptured = captured.black.length

      if (whiteCaptured > blackCaptured) {
        g.setGameOverTimeup?.('White wins on time', 'timeout')
        setGameState(prev => ({ ...prev, matchTimeRemaining: 0, matchTimerActive: false, status: GameStatus.GAME_OVER, currentTurn: Team.BLACK, winner: 'WHITE' }))
      } else if (blackCaptured > whiteCaptured) {
        g.setGameOverTimeup?.('Black wins on time', 'timeout')
        setGameState(prev => ({ ...prev, matchTimeRemaining: 0, matchTimerActive: false, status: GameStatus.GAME_OVER, currentTurn: Team.WHITE, winner: 'BLACK' }))
      } else {
        g.setGameOverTimeup?.('Draw on time', 'timeout')
        setGameState(prev => ({ ...prev, matchTimeRemaining: 0, matchTimerActive: false, status: GameStatus.GAME_OVER, currentTurn: Team.WHITE, winner: 'DRAW' }))
      }
      return
    }

    g.setMatchTimeRemaining(remaining - 1)
    setGameState(prev => ({ ...prev, matchTimeRemaining: remaining - 1 }))
  }, [isOnline])

  const updateState = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    const captured = g.getCapturedPieces()
    const currentTurn = g.currentTurn
    
    // Determine viewer's team
    const myTeam = team || (g as GameInterface).getTeam()
    if (myTeam) myTeamRef.current = myTeam as 'WHITE' | 'BLACK'
    
    // Get pendingOverlay for online mode - show teammate's pending move
    // Only show moves from same-team players (not opponent bot/player moves)
    let pendingOverlay: PendingOverlay | null = null
    if (isOnline && playerId) {
      const allMoves = (g as GameInterface).getAllPendingMoves() as Map<string, any>
      const entries = Array.from(allMoves.entries()) as [string, any][]
      const otherPlayerMoves = entries.filter(([p]) => p !== playerId && (g as GameInterface).getPlayerTeam(p) === myTeam)
      
      // Only show pendingOverlay if there's a teammate move (not my own)
      if (otherPlayerMoves.length > 0) {
        const [, teammatePending] = otherPlayerMoves[0]
        if (teammatePending.from && teammatePending.to) {
          let piece = teammatePending.piece
          if (!piece || piece === 'unknown') {
            try {
              const boardPiece = (g as GameInterface).board.get(teammatePending.from)
              piece = boardPiece?.type || 'p'
            } catch {
              piece = 'p'
            }
          }
          pendingOverlay = { from: teammatePending.from, to: teammatePending.to, piece, color: currentTurn === Team.WHITE ? 'white' : 'black', showTeammateLabel: teammateLabelShownRef.current < 3 && currentTurn === myTeam }
        }
      }
    }
    
    // Get my pending overlay - show my own pending move as secondary animation
    // FIX: Only show if I have a pending move that is NOT locked (still selecting)
    // If I've already locked my move, don't show myPendingOverlay (avoid duplicate)
    let myPendingOverlay: PendingOverlay | null = null
    if (isOnline && playerId) {
      const allMoves = (g as GameInterface).getAllPendingMoves() as Map<string, any>
      const myPending = allMoves.get(playerId)
      // Only show myPendingOverlay if I have a move AND it's not locked yet
      if (myPending && !myPending.locked && myPending.from && myPending.to) {
        let piece = myPending.piece
        if (!piece || piece === 'unknown') {
          try {
            const boardPiece = (g as GameInterface).board.get(myPending.from)
            piece = boardPiece?.type || 'p'
          } catch {
            piece = 'p'
          }
        }
        myPendingOverlay = { from: myPending.from, to: myPending.to, piece, color: g.currentTurn === Team.WHITE ? 'white' : 'black' }
      }
    }
    
    // Compute turnStatus for UI
    // In 4-player mode: detailed status only when it's YOUR team's turn
    // In 2-player mode: detailed status only when it's WHITE's turn
    const isMyTurnToAct = isFourPlayer
      ? currentTurn === myTeam
      : currentTurn === myTeamRef.current
    let turnStatus: GameState['turnStatus'] = 'waiting'
    if (g.status === GameStatus.PLAYING && isMyTurnToAct) {
      if (isOnline && playerId) {
        const ts = (g as GameInterface).getTurnState()
        const allMovesLocal = (g as GameInterface).getAllPendingMoves() as Map<string, any>
        const myMove = allMovesLocal.get(playerId)
        const localEntries = Array.from(allMovesLocal.entries()) as [string, any][]
        const teammateEntry = localEntries.find(([p]) => p !== playerId && (g as GameInterface).getPlayerTeam(p) === myTeam)
        const teammateLocked = teammateEntry ? teammateEntry[1]?.locked : false
        if (ts === 'resolving' || ts === 'locked') turnStatus = 'evaluating'
        else if (teammateLocked) turnStatus = 'teammate_locked'
        else if (teammateEntry || myMove) turnStatus = 'waiting_for_teammate'
        else turnStatus = 'your_turn'
      } else {
        const pending = g.getPendingMoves?.() || { human: null, teammate: null }
        if (pending.human && pending.teammate) {
          turnStatus = (g as GameInterface).isBothPendingLocked?.() ? 'evaluating' : 'waiting_for_teammate'
        } else if (pending.human) {
          turnStatus = 'waiting_for_teammate'
        } else {
          turnStatus = 'your_turn'
        }
      }
    } else if (g.status === GameStatus.PLAYING) {
      turnStatus = 'opponent_turn'
    }

    setGameState(prev => {
      const newWinner = g.status === GameStatus.GAME_OVER
        ? (g.getResult().includes('White wins') ? 'WHITE' as const : g.getResult().includes('Black wins') ? 'BLACK' as const : 'DRAW' as const)
        : prev.winner

      const newState = {
        ...prev,
        status: g.status,
        winner: newWinner,
        fen: g.board.fen(),
        currentTurn,
        selectedMove: isOnline ? null : g.getSelectedMove((g as GameInterface).getHumanSlot?.() || 'player1'),
        phase: g.status === GameStatus.PLAYING ? 'selecting' : 'waiting',
        capturedByWhite: captured.white,
        capturedByBlack: captured.black,
        isMyTurn: isMyTurnToAct && g.status === GameStatus.PLAYING,
        lastMove: g.lastMove,
        moveAccuracy: 100,
        moveAccuracyP2: 100,
        totalMoves: 0,
        matchTimeRemaining: g.getMatchTimeRemaining(),
        matchTimerActive: g.isMatchTimerActive(),
        pendingOverlay,
        myPendingOverlay,
        isLoading: g.status === GameStatus.WAITING ? prev.isLoading : false,
        isBotThinking: isFourPlayer ? false : (currentTurn !== myTeamRef.current ? prev.isBotThinking : false),
        highlightSquares: null as HighlightSquares | null,
        turnStatus
      }
      return newState
    })
    
    const newFen = g.board.fen()
    const newWhiteCaptured = captured.white.length
    const newBlackCaptured = captured.black.length

    if (prevFenRef.current && newFen !== prevFenRef.current && g.status === GameStatus.PLAYING) {
      playMoveSound()
    }

    const prevTotalCaptured = prevCapturedWhiteRef.current + prevCapturedBlackRef.current
    const newTotalCaptured = newWhiteCaptured + newBlackCaptured
    if (prevFenRef.current && newTotalCaptured > prevTotalCaptured) {
      playCaptureSound()
    }

    if (g.board.isCheck() && g.status === GameStatus.PLAYING) {
      playCheckSound()
    }

    if (g.status === GameStatus.GAME_OVER && prevStatusRef.current !== GameStatus.GAME_OVER) {
      const result = g.getResult()
      const isCheckmate = result.toLowerCase().includes('checkmate') || g.getGameOverReason()?.toLowerCase().includes('checkmate')
      if (isCheckmate) {
        playCheckmateSound()
      }
    }

    prevFenRef.current = newFen
    prevCapturedWhiteRef.current = newWhiteCaptured
    prevCapturedBlackRef.current = newBlackCaptured
    prevStatusRef.current = g.status
    
    if (pendingOverlay?.showTeammateLabel) {
      const labelKey = `${pendingOverlay.from}-${pendingOverlay.to}`
      if (labelKey !== lastTeammateLabelMoveKeyRef.current) {
        teammateLabelShownRef.current += 1
        lastTeammateLabelMoveKeyRef.current = labelKey
      }
    }
    
    // Accuracy transition detection (for coordinator who uses updateStateRef)
    const prevTurn = prevTurnRef.current
    const viewerTeam = team || (g as GameInterface).getTeam()
    if (prevTurn === viewerTeam && currentTurn !== viewerTeam) {
      const comp = g.lastMoveComparison as MoveComparison | null
      if (comp && comp.turnStartFen) {
        const shouldAdd = accuracyHistory.length === 0 ||
          accuracyHistory[accuracyHistory.length - 1]?.turnStartFen !== comp.turnStartFen
        if (shouldAdd) {
          setAccuracyHistory(prev => [...prev, comp])
          DEBUG && console.log(`[ACCURACY-HISTORY] (updateState) Added entry #${accuracyHistory.length + 1}`)
        }
        DEBUG && console.log('[ACCURACY-TRANSITION] (updateState) human→opponent detected, SET accuracy', { p1Move: comp.player1Move, p2Move: comp.player2Move, winnerId: comp.winnerId })
        setAccuracyComparison(comp)
      }
    }
    prevTurnRef.current = currentTurn
  }, [isOnline, game, playerId, team])

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
      const humanSlot = (g as GameInterface).getHumanSlot?.() || 'player1'
      const teammateSlot = (g as GameInterface).getTeammateSlot?.() || 'player2'

      const highlightSquares: HighlightSquares = {}

      if (winnerId === humanSlot && humanMove) {
        if (isValidSquare(humanMove.from)) highlightSquares.winnerFrom = humanMove.from
        if (isValidSquare(humanMove.to)) highlightSquares.winnerTo = humanMove.to
        if (!comparison.isSync && loserId === teammateSlot && teammateMove) {
          if (isValidSquare(teammateMove.from)) highlightSquares.loserFrom = teammateMove.from
          if (isValidSquare(teammateMove.to)) highlightSquares.loserTo = teammateMove.to
        }
      } else if (winnerId === teammateSlot && teammateMove) {
        if (isValidSquare(teammateMove.from)) highlightSquares.winnerFrom = teammateMove.from
        if (isValidSquare(teammateMove.to)) highlightSquares.winnerTo = teammateMove.to
        if (!comparison.isSync && loserId === humanSlot && humanMove) {
          if (isValidSquare(humanMove.from)) highlightSquares.loserFrom = humanMove.from
          if (isValidSquare(humanMove.to)) highlightSquares.loserTo = humanMove.to
        }
      }

      setGameState(prev => ({
        ...prev,
        highlightSquares
      }))

      updateStateRef.current()
      return true
    }

    return false
  }, [isOnline, game])

  const executeBotMove = useCallback(async () => {
    if (isOnline || !bot) return // Only run in offline mode with bot
    
    if (opponentInProgressRef.current) {
      DEBUG && console.log(`[OPPONENT] Already in progress, skipping`)
      return
    }
    
    const g = gameRef.current
    
    if (!g || g.status === GameStatus.GAME_OVER) {
      DEBUG && console.log(`[OPPONENT] Game is over, not making move`)
      return
    }
    
    const myTeam = (g as GameInterface).getTeam()
    const opponentTeam = myTeam === 'WHITE' ? Team.BLACK : Team.WHITE
    const opponentSlots = g.getPlayers(opponentTeam)
    
    if (opponentSlots.length === 0) {
      DEBUG && console.warn(`[OPPONENT] No opponent slots found`)
      opponentInProgressRef.current = false
      return
    }
    
    // Guard: only run when it's actually the opponent's turn
    if (g.currentTurn !== opponentTeam) {
      DEBUG && console.warn(`[OPPONENT] Not opponent's turn (${opponentTeam}), current: ${g.currentTurn}`)
      opponentInProgressRef.current = false
      return
    }
    
    opponentInProgressRef.current = true
    
    DEBUG && console.log(`[OPPONENT] Starting... currentTurn=${g.currentTurn}, opponentTeam=${opponentTeam}, slots=${opponentSlots.join(',')}`)
    
    const currentFen = g.board.fen()
    const currentTurn = g.currentTurn
    
    DEBUG && console.log(`\n[OPPONENT] Bot thinking... (current turn: ${currentTurn})`)
    const startTime = Date.now()
    
    const botUciMove = await bot.selectMoveAsync(currentFen)
    DEBUG && console.log(`[OPPONENT] Bot evaluation took: ${Date.now() - startTime}ms`)
    
    if (!botUciMove) {
      DEBUG && console.warn('[OPPONENT] Bot could not find a move, using random legal move fallback')
      const chess = new Chess(currentFen)
      const legalMoves = chess.moves({ verbose: true })
      if (legalMoves.length > 0) {
        const fallback = legalMoves[Math.floor(Math.random() * legalMoves.length)]
        const fallbackUci = fallback.from + fallback.to + (fallback.promotion || '')
        const sanMove = uciToSan(fallbackUci, currentFen)
        g.selectMove(opponentSlots[0], sanMove)
        if (opponentSlots[1]) {
          g.selectMove(opponentSlots[1], sanMove)
        }
        g.lockMove(opponentSlots[0])
        if (opponentSlots[1]) {
          g.lockMove(opponentSlots[1])
        }
        await g.resolveLegacy(true)
        updateStateRef.current()

        const fbComp = g.lastMoveComparison as MoveComparison | null
        const humanSlot = (g as GameInterface).getHumanSlot?.() || 'player1'
        const teammateSlot = (g as GameInterface).getTeammateSlot?.() || 'player2'
        if (fbComp && (moveHistoryRef.current.length === 0 ||
            fbComp !== (moveHistoryRef.current[moveHistoryRef.current.length - 1] as unknown))) {
          const isHumanWinner = fbComp.winnerId === humanSlot
          const entry: MoveEntry = {
            turn: moveHistoryRef.current.length + 1,
            team: opponentTeam,
            winningMove: fbComp.winningMove,
            winningMoveUci: fbComp.winningMove || '',
            shadowMove: fbComp.isSync ? null : (isHumanWinner ? fbComp.player2Move : fbComp.player1Move),
            shadowMoveUci: '',
            isSync: fbComp.isSync,
            player1Accuracy: fbComp.player1Accuracy,
            player2Accuracy: fbComp.player2Accuracy,
            fenAfter: g.board.fen(),
          }
          moveHistoryRef.current = [...moveHistoryRef.current, entry]
        }
      }
      opponentInProgressRef.current = false
      return
    }
    
    const sanMove = uciToSan(botUciMove, currentFen)
    DEBUG && console.log(`[OPPONENT] Selected move: ${sanMove}`)
    
    g.selectMove(opponentSlots[0], sanMove)
    if (opponentSlots[1]) {
      g.selectMove(opponentSlots[1], sanMove)
    }
    g.lockMove(opponentSlots[0])
    if (opponentSlots[1]) {
      g.lockMove(opponentSlots[1])
    }
    
    await g.resolveLegacy(true)
    updateStateRef.current()

    const comp = g.lastMoveComparison as MoveComparison | null
    const humanSlot = (g as GameInterface).getHumanSlot?.() || 'player1'
    const teammateSlot = (g as GameInterface).getTeammateSlot?.() || 'player2'
    if (comp && (moveHistoryRef.current.length === 0 ||
        comp !== (moveHistoryRef.current[moveHistoryRef.current.length - 1] as unknown))) {
      const isHumanWinner = comp.winnerId === humanSlot
      const entry: MoveEntry = {
        turn: moveHistoryRef.current.length + 1,
        team: opponentTeam,
        winningMove: comp.winningMove,
        winningMoveUci: comp.winningMove || '',
        shadowMove: comp.isSync ? null : (isHumanWinner ? comp.player2Move : comp.player1Move),
        shadowMoveUci: '',
        isSync: comp.isSync,
        player1Accuracy: comp.player1Accuracy,
        player2Accuracy: comp.player2Accuracy,
        fenAfter: g.board.fen(),
      }
      moveHistoryRef.current = [...moveHistoryRef.current, entry]
    }

    DEBUG && console.log(`[DEBUG] After opponent turn, currentTurn: ${g.currentTurn}`)
    opponentInProgressRef.current = false
  }, [isOnline, bot])

  const executeMove = useCallback(async (uciMove: string, promotion?: PromotionPiece) => {
    if (opponentInProgressRef.current) {
      DEBUG && console.log(`[HUMAN] BLOCKED - Opponent thinking, ignoring move`)
      return
    }

    if (isOnline && onlineGameRef.current && playerId) {
      // Online mode - human vs human with bots as opponents
      const g = onlineGameRef.current

      if (g.status === GameStatus.GAME_OVER) return

      const currentTurn = g.currentTurn

      const myTeam = (g as GameInterface).getTeam()

      DEBUG && console.log(`\n[HUMAN] Attempting move: ${uciMove} (current turn: ${currentTurn}, myTeam: ${myTeam})`)

      if (currentTurn !== myTeam) {
        DEBUG && console.warn(`[HUMAN] BLOCKED - Not ${myTeam}'s turn! Current: ${currentTurn}`)
        return
      }

      // Block if player already submitted a move this turn
      if (inputLockedRef.current) {
        DEBUG && console.warn(`[HUMAN] BLOCKED - Already submitted a move this turn`)
        return
      }
      const allPending = (g as GameInterface).getAllPendingMoves() as Map<string, any>
      if (allPending && allPending.has(playerId)) {
        DEBUG && console.warn(`[HUMAN] BLOCKED - Already submitted a move this turn (pending map)`)
        return
      }

      // Clear accuracy panel when player starts new turn
      setAccuracyComparison(null)
      DEBUG && console.log(`[ACCURACY-CLEAR] Cleared accuracy for new ${myTeam} move`)

      // Lock input immediately — prevents duplicate submissions within a single turn
      inputLockedRef.current = true
      submissionTurnRef.current = true

      DEBUG && console.log(`[HUMAN] Turn confirmed as ${myTeam} - processing move...`)

      try {
        const fenBefore = g.board.fen()
        DEBUG && console.log(`[HUMAN] UCI: ${uciMove}, FEN: ${fenBefore}`)
        const sanMove = uciToSan(uciMove, fenBefore, promotion)
        const moveInfo = getMoveFromUci(uciMove, fenBefore)

        DEBUG && console.log(`[HUMAN] SAN: ${sanMove}, moveInfo:`, moveInfo)

        if (moveInfo) {
          g.submitMoveToDB(sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)

          setGameState(prev => ({
            ...prev,
            selectedMove: sanMove,
            highlightSquares: null
          }))
        }

        playLockSound()

        // Event-based waiting - no polling, no timeouts
        // Wait for teammate lock event (or if already locked, resolve immediately)
        DEBUG && console.log(`[STATE] Waiting for teammate to lock move...`)
        await g.waitForTeammateLock()
        
        DEBUG && console.log(`[STATE] Teammate locked or already locked, checking state...`)

        // Check if turn already changed (another client resolved)
        if (g.currentTurn !== myTeam) {
          DEBUG && console.log(`[STATE] Turn changed, another client resolved`)
          g.setTurnState('selecting')
          return
        }

        // Check if handleTurnResolved already processed this turn
        // (resolution applied out-of-band while we were waiting).
        // turnState is 'selecting' after startPendingTurn() ran.
        if (g.getTurnState() === 'selecting') {
          DEBUG && console.log(`[STATE] Turn already resolved via broadcast — returning cleanly`)
          return
        }

        if (g.isCoordinator()) {
          // Coordinator: evaluate and broadcast turn_resolved
          if (g.isBothPendingLocked()) {
            DEBUG && console.log(`[RESOLVE] Coordinator resolving...`)
            
            await g.resolvePendingMoves()
            updateStateRef.current()
            DEBUG && console.log(`[RESOLVE] Resolve succeeded`)
            
            // Set highlight squares after resolve (comparison now available)
            const comparison = g.lastMoveComparison
            if (comparison) {
              const isValidSquare = (sq: string): sq is string => 
                !!sq && sq.length === 2 && /^[a-h][1-8]$/.test(sq)
              
              const humanSlot = (g as GameInterface).getHumanSlot?.() || 'player1'
              const teammateSlot = (g as GameInterface).getTeammateSlot?.() || 'player2'
              const isHumanWinner = comparison.winnerId === humanSlot
              
              const winningMove = isHumanWinner ? comparison.player1Move : comparison.player2Move
              const losingMove = isHumanWinner ? comparison.player2Move : comparison.player1Move
              
              const highlightSquares: HighlightSquares = {}

              if (winningMove) {
                const wf = winningMove.substring(0, 2)
                const wt = winningMove.substring(2, 4)
                if (isValidSquare(wf)) highlightSquares.winnerFrom = wf
                if (isValidSquare(wt)) highlightSquares.winnerTo = wt
                if (!comparison.isSync && losingMove) {
                  const lf = losingMove.substring(0, 2)
                  const lt = losingMove.substring(2, 4)
                  if (isValidSquare(lf)) highlightSquares.loserFrom = lf
                  if (isValidSquare(lt)) highlightSquares.loserTo = lt
                }
              }
              
              setGameState(prev => ({ ...prev, highlightSquares }))
            }
            
            const newTurn = g.currentTurn as Team
            DEBUG && console.log(`[RESOLVE] Resolution complete, new turn: ${newTurn}`)
            playResolutionSound()
            
            // Bot turn handling: only coordinator runs bots (non-blocking — UI stays responsive)
            // In 4-player mode, skip bot handling — humans manage the turn
            const myTeam = (g as GameInterface).getTeam()
            const opponentTeam = myTeam === 'WHITE' ? Team.BLACK : Team.WHITE
            if (!isFourPlayer && newTurn === opponentTeam && bot && playerId) {
              DEBUG && console.log(`[RESOLVE] Coordinator handling ${opponentTeam} bot moves...`)
              DEBUG && console.log(`[BOT-DIAG] Before bot handler: inputLocked=${inputLockedRef.current}, submissionTurn=${submissionTurnRef.current}, turnState=${g.getTurnState()}, phase=${g.gamePhase}`)
              DEBUG && console.log(`[BOT-DIAG] pendingMoves=[${Array.from(g.getAllPendingMoves().keys()).join(', ')}]`)

              // Reset input locks from previous turn so humans can submit next turn
              inputLockedRef.current = false
              submissionTurnRef.current = false

              setGameState(prev => ({ ...prev, isBotThinking: true }))
              
              const currentFen = g.board.fen()
              
               ;(async () => {
                const botUciMove = await bot.selectBestMove(currentFen)
                DEBUG && console.log(`[RESOLVE] Bot selected move:`, botUciMove)
                
                const opponentSlots = g.getPlayers(opponentTeam)
                
                if (!botUciMove) {
                  const chess = new Chess(currentFen)
                  const legalMoves = chess.moves({ verbose: true })
                  if (legalMoves.length > 0) {
                    const fallbackMove = legalMoves[0]
                    const fallbackUci = fallbackMove.from + fallbackMove.to
                    const sanMove = uciToSan(fallbackUci, currentFen)
                    const moveInfo = getMoveFromUci(fallbackUci, currentFen)
                    if (moveInfo) {
                      for (const slot of opponentSlots) {
                        g.setPendingMove(slot, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
                        g.lockPendingMove(slot)
                      }
                    }
                  }
                } else if (botUciMove) {
                  const sanMove = uciToSan(botUciMove, currentFen)
                  const moveInfo = getMoveFromUci(botUciMove, currentFen)
                  
                  if (moveInfo) {
                    for (const slot of opponentSlots) {
                      g.setPendingMove(slot, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
                      g.lockPendingMove(slot)
                    }
                  }
                }
                
                try {
                  await g.resolvePendingMoves()
                  DEBUG && console.log(`[RESOLVE] ${opponentTeam} resolve succeeded, new turn:`, g.currentTurn)
                  DEBUG && console.log(`[BOT-DIAG] After resolve: turnState=${g.getTurnState()}, phase=${g.gamePhase}, pendingMoves=[${Array.from(g.getAllPendingMoves().keys()).join(', ')}]`)
                  g.setTurnState('selecting')
                  DEBUG && console.log(`[STATE] Coordinator ${opponentTeam} resolve complete, reset to selecting`)
                  setGameState(prev => ({ ...prev, isBotThinking: false }))
                  updateStateRef.current()
                } catch (e) {
                  DEBUG && console.log(`[RESOLVE] ${opponentTeam} resolve failed:`, e)
                  // Recovery: reset state so humans can continue playing
                  g.setTurnState('selecting')
                  inputLockedRef.current = false
                  submissionTurnRef.current = false
                  setGameState(prev => ({ ...prev, isBotThinking: false }))
                  updateStateRef.current()
                }
                
              })()
            }
          }
        } else {
          // Non-coordinator: wait for coordinator's turn_resolved broadcast
          DEBUG && console.log(`[RESOLVE] Non-coordinator — waiting for turn_resolved broadcast`)
          g.setTurnState('locked')
          await g.waitForTurnChange()
          playResolutionSound()
          DEBUG && console.log(`[RESOLVE] Non-coordinator received turn_resolved`)
        }

      } catch (e) {
        DEBUG && console.warn('[HUMAN] Invalid move:', uciMove, e)
      }
    } else if (!isOnline && gameRef.current && teammateBot) {
      // Offline mode - existing logic with bots as teammates and opponents
      const g = gameRef.current
      const startTime = Date.now()
      const currentTurn = g.currentTurn

      const myTeam = (g as GameInterface).getTeam()
      const humanSlot = (g as GameInterface).getHumanSlot?.() || 'player1'
      const teammateSlot = (g as GameInterface).getTeammateSlot?.() || 'player2'
      const opponentTeam = myTeam === 'WHITE' ? Team.BLACK : Team.WHITE

      DEBUG && console.log(`\n[HUMAN] Attempting move: ${uciMove} (current turn: ${currentTurn}, myTeam: ${myTeam})`)

      if (currentTurn !== myTeam) {
        DEBUG && console.warn(`[HUMAN] BLOCKED - Not ${myTeam}'s turn! Current: ${currentTurn}`)
        return
      }

      DEBUG && console.log(`[HUMAN] Turn confirmed as ${myTeam} - processing move...`)

      try {
        g.startPendingTurn()

        setGameState(prev => ({
          ...prev,
          highlightSquares: null
        }))

        const fenBefore = g.board.fen()
        DEBUG && console.log(`[HUMAN] UCI: ${uciMove}, FEN: ${fenBefore}`)
        const sanMove = uciToSan(uciMove, fenBefore, promotion)
        const moveInfo = getMoveFromUci(uciMove, fenBefore)

        DEBUG && console.log(`[HUMAN] SAN: ${sanMove}, moveInfo:`, moveInfo)

        if (moveInfo) {
          g.setPendingMove(humanSlot, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
          DEBUG && console.log(`[HUMAN] Pending move SET for ${humanSlot}`)
          setGameState(prev => ({
            ...prev,
            selectedMove: sanMove,
            pendingOverlay: null,
            myPendingOverlay: null
          }))
        }

        DEBUG && console.log(`[HUMAN] Proposing move: ${sanMove}`)
        DEBUG && console.log(`[TEAMMATE] Bot thinking...`)

        setGameState(prev => ({ ...prev, isBotThinking: true }))

        const teammateStart = Date.now()
        let teammateUciMove: string | null = null
        let teammateSanMove: string | null = null
        let teammateMoveInfo: { from: string; to: string; piece: string } | null = null

        try {
          teammateUciMove = await teammateBot.selectBestMove(g.board.fen())
        } catch (error) {
          DEBUG && console.warn('[TEAMMATE] Error selecting move:', error)
        }
        DEBUG && console.log(`[TEAMMATE] Bot evaluation took: ${Date.now() - teammateStart}ms`)

        if (teammateUciMove) {
          const currentFen = g.board.fen()
          teammateSanMove = uciToSan(teammateUciMove, currentFen, promotion)
          teammateMoveInfo = getMoveFromUci(teammateUciMove, currentFen)

          if (teammateMoveInfo) {
            const { from, to, piece } = teammateMoveInfo
            g.setPendingMove(teammateSlot, teammateSanMove, from, to, piece)
            g.lockPendingMove(teammateSlot)

            const botMoveKey = `${from}-${to}`
            const isNewBotMove = botMoveKey !== lastTeammateLabelMoveKeyRef.current
            setGameState(prev => ({
              ...prev,
              pendingOverlay: { from, to, piece, color: myTeam === 'WHITE' ? 'white' : 'black', showTeammateLabel: teammateLabelShownRef.current < 3 },
              myPendingOverlay: null
            }))
            if (teammateLabelShownRef.current < 3 && isNewBotMove) {
              teammateLabelShownRef.current += 1
              lastTeammateLabelMoveKeyRef.current = botMoveKey
            }
          }

          DEBUG && console.log(`[TEAMMATE] Selected move: ${teammateSanMove}`)
        } else {
          DEBUG && console.warn('[TEAMMATE] No move selected, syncing with human move')
          teammateSanMove = sanMove
          teammateMoveInfo = moveInfo
          if (moveInfo) {
            g.setPendingMove(teammateSlot, sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
          }
          g.lockPendingMove(teammateSlot)
        }

        g.lockPendingMove(humanSlot)

        DEBUG && console.log(`[RESOLVE] Both moves locked, waiting...`)
        DEBUG && console.log(`[RESOLVE] isBothPendingLocked: ${g.isBothPendingLocked()}`)
        DEBUG && console.log(`[RESOLVE] Pending moves:`, g.getPendingMoves())

        await new Promise(resolve => setTimeout(resolve, 800))

        const resolved = await checkAndResolve()

        DEBUG && console.log(`[RESOLVE] checkAndResolve returned: ${resolved}`)

        if (!resolved) {
          setGameState(prev => ({ ...prev, pendingOverlay: null, myPendingOverlay: null }))
          return
        }

        const comp = g.lastMoveComparison as MoveComparison | null
        if (comp && moveHistoryRef.current.length === 0 ||
            (comp && comp !== (moveHistoryRef.current[moveHistoryRef.current.length - 1] as unknown))) {
          const humanSlot = (g as GameInterface).getHumanSlot?.() || 'player1'
          const isHumanWinner = comp.winnerId === humanSlot
          const entry: MoveEntry = {
            turn: moveHistoryRef.current.length + 1,
            team: myTeam,
            winningMove: comp.winningMove,
            winningMoveUci: comp.winningMove || '',
            shadowMove: comp.isSync ? null : (isHumanWinner ? comp.player2Move : comp.player1Move),
            shadowMoveUci: '',
            isSync: comp.isSync,
            player1Accuracy: comp.player1Accuracy,
            player2Accuracy: comp.player2Accuracy,
            fenAfter: g.board.fen(),
          }
          moveHistoryRef.current = [...moveHistoryRef.current, entry]
        }

        const newTurn = g.currentTurn
        pendingOpponentTurnRef.current = (g.status !== GameStatus.GAME_OVER && newTurn === opponentTeam)

        if (!pendingOpponentTurnRef.current) {
          DEBUG && console.log(`[HUMAN] Turn time: ${Date.now() - startTime}ms`)
          g.startPendingTurn()
        } else {
          DEBUG && console.log(`[HUMAN] Triggering opponent turn after ${myTeam} resolution`)
          await handleResolutionComplete()
        }
      } catch (e) {
        DEBUG && console.warn('[HUMAN] Invalid move:', uciMove, e)
        setGameState(prev => ({ ...prev, pendingOverlay: null, myPendingOverlay: null }))
      }
    }
  }, [isOnline, onlineGame, game, playerId, teammateBot, checkAndResolve])

  useEffect(() => {
    if (!isOnline && game && game.status === GameStatus.WAITING) {
      // Color-aware slot assignment. Bots swap teams so the human's teammate
      // is always on the same color, and the opponents are on the opposite color.
      // Slot IDs are kept stable (player1-player4) for MoveComparison mapping;
      // the human slot is on their team (player1 for white humans, player3 for black).
      const humanTeam = game.getPlayerColor() === 'white' ? Team.WHITE : Team.BLACK
      const opponentTeam = humanTeam === Team.WHITE ? Team.BLACK : Team.WHITE
      const humanSlot = game.getHumanSlot()
      const teammateSlot = game.getTeammateSlot()
      const opponentSlots: Player[] = humanTeam === Team.WHITE
        ? ['player3', 'player4']
        : ['player1', 'player2']
      game.addPlayer(humanSlot, humanTeam)
      game.addPlayer(teammateSlot, humanTeam)
      for (const slot of opponentSlots) {
        game.addPlayer(slot, opponentTeam)
      }
      game.start()
      updateStateRef.current()
    }
  }, [isOnline, game])

  // Auto-trigger opponent bot when it's their turn in offline mode
  useEffect(() => {
    if (isOnline || !gameRef.current) return
    const g = gameRef.current
    if (g.status !== GameStatus.PLAYING) return
    const myTeam = (g as GameInterface).getTeam()
    if (!myTeam) return
    const opponentTeam = myTeam === 'WHITE' ? Team.BLACK : Team.WHITE
    if (g.currentTurn === opponentTeam && !opponentInProgressRef.current) {
      DEBUG && console.log(`[AUTO-BOT] Triggering bot for ${opponentTeam} turn`)
      executeBotMove()
    }
  }, [isOnline, gameState.status, gameState.currentTurn, executeBotMove])

  // Reset input lock when turnStatus indicates a genuinely new turn.
  // turnStatus === 'your_turn' means: currentTurn === myTeam, no pending
  // moves exist, and turnState is 'selecting' — the engine is ready.
  useEffect(() => {
    DEBUG && console.log(`[INPUT-LOCK-RESET] turnStatus=${gameState.turnStatus}, isMyTurn=${gameState.isMyTurn}, prevLocked=${inputLockedRef.current}`)
    if (gameState.turnStatus === 'your_turn' && gameState.isMyTurn) {
      inputLockedRef.current = false
      submissionTurnRef.current = false
      DEBUG && console.log(`[INPUT-LOCK-RESET] Lock reset successfully`)
    }
  }, [gameState.turnStatus, gameState.isMyTurn])

  useEffect(() => {
    if (gameState.status !== GameStatus.PLAYING) return
    if (matchTimerRef.current) return
    if (!matchTimerStarted) return

    matchTimerRef.current = setInterval(tickMatchTimer, 1000)

    return () => {
      if (matchTimerRef.current) {
        clearInterval(matchTimerRef.current)
        matchTimerRef.current = null
      }
    }
  }, [gameState.status, tickMatchTimer, matchTimerStarted])

  const handleMove = useCallback((uciMove: string, promotion?: PromotionPiece) => {
    if (settings.confirmMove) {
      setHeldMove({ move: uciMove, promotion })
      return
    }
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
  }, [executeMove, settings.autoQueen, settings.confirmMove])

  const handleConfirmHeldMove = useCallback(() => {
    if (!heldMove) return
    const { move, promotion } = heldMove
    setHeldMove(null)
    if (promotion) {
      if (settings.autoQueen) {
        executeMove(move, 'q')
        return
      }
      const [from, to] = move.split('-')
      setGameState(prev => ({ ...prev, pendingPromotion: { from, to } }))
    } else {
      executeMove(move)
    }
  }, [heldMove, executeMove, settings.autoQueen])

  const handleCancelHeldMove = useCallback(() => {
    setHeldMove(null)
    setBoardKey(k => k + 1)
  }, [])

  const handlePromotionSelect = useCallback((piece: PromotionPiece) => {
    if (gameState.pendingPromotion) {
      const { from, to } = gameState.pendingPromotion
      const uciMove = `${from}-${to}`
      setGameState(prev => ({ ...prev, pendingPromotion: null }))
      executeMove(uciMove, piece)
    }
  }, [gameState.pendingPromotion, executeMove])

  const handleResign = useCallback(async () => {
    try {
      if (isOnline && onlineGameRef.current) {
        await onlineGameRef.current.abandonMatch()
      } else if (!isOnline && gameRef.current) {
        const g = gameRef.current as LocalGame
        const humanTeam = g.getTeam()
        const opponentWins = humanTeam === 'WHITE' ? 'BLACK' : 'WHITE'
        g.setGameOverResult(`Resigned - ${humanTeam === 'WHITE' ? 'Black' : 'White'} wins`)
        g.setGameOverReason('resignation')

        // Set React state so the save-useEffect fires properly
        setGameState(prev => ({
          ...prev,
          status: GameStatus.GAME_OVER,
          winner: opponentWins,
        }))
      }
    } catch {
      // Channel may be dead during refresh; navigation still proceeds
    }
    // Wait for the save effect to run before navigating away
    await new Promise(r => setTimeout(r, 200))
    setShowGameOverDismissed(false)
    router.replace('/')
  }, [isOnline])

  const handleLeaveConfirm = useCallback(async () => {
    if (roomCode) {
      sessionStorage.setItem(`chessduo_left_${roomCode}`, 'true')
    }
    if (isOnline && onlineGameRef.current) {
      onlineGameRef.current.abandonMatch().catch(() => {})
    }
    setShowLeaveModal(false)
    router.replace('/')
  }, [isOnline, roomCode, router])

  const handleResolutionComplete = useCallback(async () => {
    if (pendingOpponentTurnRef.current) {
      pendingOpponentTurnRef.current = false
      setGameState(prev => ({ ...prev, isBotThinking: true }))
      await executeBotMove()
// FIX: Reset resolution state when BLACK completes and WHITE turn starts
              DEBUG && console.log('[RESOLVE-CLEANUP] Clearing resolution state for new human turn')
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
    }
  }, [executeBotMove])

  // Board-page derived state (must come before any early returns — Rules of Hooks)
  // A player is a bot if its id starts with 'bot_', looks like 'botN', or is one of
  // the offline player1/player2/player3/player4 placeholders.
  const isOfflineBotId = (id: string): boolean => {
    if (!id) return false
    if (id.startsWith('bot_')) return true
    if (/^bot\d+$/i.test(id)) return true
    if (/^player\d+$/.test(id)) return true
    return false
  }

  // Board-page derived state (must come before any early returns — Rules of Hooks)
  // Quick Play layout: one user tile + one bot tile per side, with the
  // bots labelled WhiteBot / BlackBot. Other bot placeholders are collapsed
  // (not shown) to keep the top bar uncluttered.
  const whitePlayers: BoardTopBarPlayer[] = useMemo(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    const ids = g?.getPlayers(Team.WHITE) || []
    const labels = teamLabels.white.split(',').map(s => s.trim().replace(/[()]/g, '').trim())
    const out: BoardTopBarPlayer[] = []
    let hasYou = false
    let hasBot = false
    ids.slice(0, 2).forEach((id, idx) => {
      const isBot = isOfflineBotId(id)
      const humanSlot = !isOnline ? (g as GameInterface)?.getHumanSlot?.() : undefined
      const isYou = id === playerId || (!isOnline && id === humanSlot)
      if (isYou) {
        out.push({
          id,
          label: userProfile.username || 'You',
          type: 'human',
          avatar: 'ace' as const,
          profileImageUrl: userProfile.avatarUrl,
          isYou: true,
          online: true,
          submitted: !!gameState.myPendingOverlay,
        })
        hasYou = true
      } else if (isBot) {
        if (hasBot) return
        out.push({
          id: 'white-bot',
          label: 'WhiteBot',
          type: 'bot',
          avatar: 'ace' as const,
          profileImageUrl: null,
          isYou: false,
          online: true,
          submitted: !!gameState.pendingOverlay,
        })
        hasBot = true
      } else {
        const candidate = labels[1] && labels[1] !== 'You' && labels[1] !== 'White Team' ? labels[1] : ''
        out.push({
          id,
          label: candidate || 'Teammate',
          type: 'human',
          avatar: 'ace' as const,
          profileImageUrl: null,
          isYou: false,
          online: true,
          submitted: !!gameState.myPendingOverlay,
        })
      }
    })
    return out
  }, [teamLabels.white, playerId, userProfile, gameState.myPendingOverlay, isOnline, gameState.status])

  const blackPlayers: BoardTopBarPlayer[] = useMemo(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    const ids = g?.getPlayers(Team.BLACK) || []
    const labels = teamLabels.black.split(',').map(s => s.trim().replace(/[()]/g, '').trim())
    const out: BoardTopBarPlayer[] = []
    let hasYou = false
    let hasBot = false
    ids.slice(0, 2).forEach((id, idx) => {
      const isBot = isOfflineBotId(id)
      const humanSlot = !isOnline ? (g as GameInterface)?.getHumanSlot?.() : undefined
      const isYou = id === playerId || (!isOnline && id === humanSlot)
      if (isYou) {
        out.push({
          id,
          label: userProfile.username || 'You',
          type: 'human',
          avatar: 'ace' as const,
          profileImageUrl: userProfile.avatarUrl,
          isYou: true,
          online: true,
          submitted: !!gameState.myPendingOverlay,
        })
        hasYou = true
      } else if (isBot) {
        if (hasBot) return
        out.push({
          id: 'black-bot',
          label: 'BlackBot',
          type: 'bot',
          avatar: 'ace' as const,
          profileImageUrl: null,
          isYou: false,
          online: true,
          submitted: !!gameState.pendingOverlay,
        })
        hasBot = true
      } else {
        const candidate = labels[1] && labels[1] !== 'You' && labels[1] !== 'Black Team' ? labels[1] : ''
        out.push({
          id,
          label: candidate || 'Teammate',
          type: 'human',
          avatar: 'ace' as const,
          profileImageUrl: null,
          isYou: false,
          online: true,
          submitted: !!gameState.pendingOverlay,
        })
      }
    })
    return out
  }, [teamLabels.black, playerId, userProfile, gameState.pendingOverlay, gameState.myPendingOverlay, isOnline, gameState.status])

  const yourMoveForRow: PendingMove | null = (() => {
    const humanColor = myTeamRef.current === 'WHITE' ? 'white' as const : 'black' as const
    if (heldMove) {
      return { san: heldMove.move.split('-').join(' '), piece: 'P', color: humanColor }
    }
    // First check the engine's pending-moves map (works for locked moves too).
    if (playerId) {
      const g = isOnline ? onlineGameRef.current : gameRef.current
      const allMoves = g?.getAllPendingMoves() as Map<string, any> | undefined
      const myPending = allMoves?.get(playerId)
      if (myPending && myPending.from && myPending.to) {
        return {
          san: gameState.selectedMove || `${myPending.from}-${myPending.to}`,
          from: myPending.from,
          to: myPending.to,
          piece: myPending.piece && myPending.piece !== 'unknown' ? myPending.piece : 'P',
          color: humanColor,
        }
      }
    }
    // Fall back to the myPendingOverlay (only set when not locked).
    if (gameState.myPendingOverlay) {
      return {
        san: gameState.selectedMove || (gameState.myPendingOverlay.from + gameState.myPendingOverlay.to),
        from: gameState.myPendingOverlay.from,
        to: gameState.myPendingOverlay.to,
        piece: gameState.myPendingOverlay.piece,
        color: gameState.myPendingOverlay.color,
      }
    }
    // Last resort: just show the SAN if we have one but no engine data.
    if (gameState.selectedMove) {
      return { san: gameState.selectedMove, piece: 'P', color: humanColor }
    }
    return null
  })()

  const teammateMoveForRow: PendingMove | null = gameState.pendingOverlay
    ? { san: gameState.pendingOverlay.from + gameState.pendingOverlay.to, piece: gameState.pendingOverlay.piece, color: gameState.pendingOverlay.color }
    : null

  const resolutionData: MoveResolutionData | null = accuracyComparison
    ? {
        yourMove: { san: accuracyComparison.player1Move || '?', piece: 'P', color: myTeamRef.current === 'WHITE' ? 'white' : 'black' },
        teammateMove: { san: accuracyComparison.player2Move || '?', piece: 'P', color: myTeamRef.current === 'WHITE' ? 'white' : 'black' },
        engineChoseMove: { san: accuracyComparison.bestEngineMove || accuracyComparison.winningMove || '?' },
        yourAccuracy: accuracyComparison.player1Accuracy || 0,
        teammateAccuracy: accuracyComparison.player2Accuracy || 0,
        yourLoss: accuracyComparison.player1Loss || 0,
        teammateLoss: accuracyComparison.player2Loss || 0,
        isSync: !!accuracyComparison.isSync,
        youMatchedEngine: !!accuracyComparison.youMatchedEngine,
        teammateMatchedEngine: !!accuracyComparison.teammateMatchedEngine,
        result: accuracyComparison.winnerId === 'player1' ? 'you_won' : accuracyComparison.winnerId === 'player2' ? 'teammate_won' : 'draw',
        scoreDelta: (accuracyComparison.winningScore - accuracyComparison.bestEngineScore) || 0,
        evaluationAfter: accuracyComparison.winningScore || 0,
        evaluationImproved: (accuracyComparison.winningScore || 0) > (accuracyComparison.bestEngineScore || 0),
      }
    : null

  const roundHistoryEntries: RoundHistoryEntry[] = useMemo(() => {
    const moves = moveHistoryRef.current
    return moves.slice(-10).map((m, i) => {
      const isWhite = m.team === 'WHITE'
      const isMyTeam = m.team === myTeamRef.current
      const san = m.winningMoveUci || m.winningMove
      const pieceChar = san ? san[0] : 'P'
      return {
        round: Math.floor(m.turn / 2) + 1,
        playerLabel: isMyTeam ? 'You' : 'Teammate',
        moveSan: m.winningMove,
        pieceColor: isWhite ? 'white' : 'black',
        pieceChar: pieceChar,
        evalDelta: m.player1Accuracy - m.player2Accuracy,
        isCurrent: i === moves.length - 1,
      }
    })
  }, [moveHistoryRef.current.length])

  // Common modals rendered at the top level so they're available even
  // during early returns (e.g. lobby, loading). These are fixed-position
  // overlays that render by conditional state, not by layout position.
  const commonModals = (
    <>
      {gameState.pendingPromotion && (
        <PromotionModal onSelect={handlePromotionSelect} />
      )}
      <GameOverModal
        open={gameState.status === GameStatus.GAME_OVER && !showGameOverDismissed}
        winner={gameState.winner || 'DRAW'}
        onPlayAgain={() => router.replace('/')}
        onClose={() => setShowGameOverDismissed(true)}
        gameResult={isOnline ? onlineGameRef.current?.getResult() : game?.getResult()}
        gameOverReason={isOnline ? onlineGameRef.current?.getGameOverReason() || null : game?.getGameOverReason() || null}
      />
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <ResignConfirmModal
        open={showResignConfirm}
        onConfirm={() => { setShowResignConfirm(false); handleResign() }}
        onCancel={() => setShowResignConfirm(false)}
      />
      <LeaveConfirmModal
        open={showLeaveModal}
        onConfirm={() => handleLeaveConfirm()}
        onCancel={() => setShowLeaveModal(false)}
        title={gameState.status === GameStatus.WAITING || gameState.status === GameStatus.READY ? 'Leave Room' : 'Abort Match'}
        message={gameState.status === GameStatus.WAITING || gameState.status === GameStatus.READY ? 'Are you sure you want to leave this room?' : 'Are you sure?'}
        detail={gameState.status === GameStatus.WAITING || gameState.status === GameStatus.READY ? 'The room will be disbanded if you are the creator.' : 'Your teammate will be notified and the match will end for both players.'}
      />
    </>
  )

  // Show lobby for online mode while waiting for game to start
  const inviteUrl = roomCode && typeof window !== 'undefined'
    ? `${getAppBaseUrl()}/?code=${roomCode}`
    : undefined

  if (isOnline && gameState.status !== GameStatus.PLAYING && gameState.status !== GameStatus.GAME_OVER) {
    return (
      <>
        {commonModals}
        <GameLobby
          roomCode={roomCode}
          inviteUrl={inviteUrl}
          isLoading={gameState.isLoading}
          lobbyTimeoutSeconds={60}
          onTimeoutLeave={() => router.push('/')}
        />
      </>
    )
  }

  // Show loading state for offline mode while game initializes
  if (gameState.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <GameLoading
          message="Initializing game..."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[var(--color-page-bg)] text-slate-900 dark:text-slate-100">
      {commonModals}

      {showGameOn && (
        <GameOnOverlay onComplete={handleGameOnComplete} />
      )}

      <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col">
        {/* Compact top bar — header + team avatars + timer + controls */}
        <div className="w-full bg-white dark:bg-[var(--color-page-bg)] border-b border-slate-200 dark:border-white/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
            <div className="min-w-0 flex-1">
              <BoardTopBar
                whitePlayers={whitePlayers.map(p => ({ ...p, disconnectedSinceMs: !p.isYou ? disconnectedAge : undefined }))}
                blackPlayers={blackPlayers.map(p => ({ ...p, disconnectedSinceMs: !p.isYou ? disconnectedAge : undefined }))}
                capturedWhite={gameState.capturedByWhite}
                capturedBlack={gameState.capturedByBlack}
                matchTimeRemaining={gameState.matchTimeRemaining}
                matchTimerActive={gameState.matchTimerActive}
                totalMatchSeconds={timeLimitSeconds || 600}
                roundLabel={gameState.status === GameStatus.PLAYING ? 'Round ' + (Math.floor(moveHistoryRef.current.length / 2) + 1) : undefined}
                currentTurn={gameState.currentTurn}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <GameMenu
                onResign={gameState.status !== GameStatus.GAME_OVER ? () => setShowResignConfirm(true) : undefined}
                onOpenSettings={() => setShowSettings(true)}
                soundEnabled={settings.soundEnabled}
                onToggleSound={() => settings.setSoundEnabled(!settings.soundEnabled)}
                onOpenProfile={() => setOverlayMode('profile')}
              />
            </div>
          </div>
        </div>

        {/* Chess Board — 80% of viewport */}
        <div className="flex justify-center px-3">
          <div
            className="w-full aspect-square flex-shrink-0 relative"
            style={{ maxWidth: 'min(95vw, 80vh, 720px)' }}
          >
            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden bg-slate-900/30">
              {(() => {
                const currentTurn = gameState.currentTurn
                const myTeamEnabled = isFourPlayer
                  ? currentTurn === myTeamRef.current
                  : currentTurn === myTeamRef.current
                const isBoardEnabled = overlayMode !== 'none' || playbackFen ? false : (gameState.status === GameStatus.PLAYING && myTeamEnabled && !gameState.isBotThinking && !gameState.pendingPromotion && !(isOnline && playerId && onlineGameRef.current?.getAllPendingMoves?.()?.has(playerId)) && !(isOnline && inputLockedRef.current))
                const boardOrientation = myTeamRef.current === 'BLACK' ? 'black' : 'white'
                return isMobile ? (
                  <MobileChessBoard
                    key={boardKey}
                    fen={playbackFen || gameState.fen}
                    onMove={handleMove}
                    enabled={isBoardEnabled}
                    orientation={boardOrientation as 'white' | 'black'}
                    lastMove={gameState.lastMove}
                    pendingOverlay={gameState.pendingOverlay}
                    myPendingOverlay={gameState.myPendingOverlay}
                    highlightSquares={gameState.highlightSquares}
                    onAnimationComplete={handleResolutionComplete}
                  />
                ) : (
                  <ChessBoard
                    key={boardKey}
                    fen={playbackFen || gameState.fen}
                    onMove={handleMove}
                    enabled={isBoardEnabled}
                    orientation={boardOrientation as 'white' | 'black'}
                    lastMove={gameState.lastMove}
                    pendingOverlay={gameState.pendingOverlay}
                    myPendingOverlay={gameState.myPendingOverlay}
                    highlightSquares={gameState.highlightSquares}
                    onAnimationComplete={handleResolutionComplete}
                  />
                )
              })()}
            </div>
          </div>
        </div>

        {/* Pending moves row */}
        {gameState.status === GameStatus.PLAYING && (
          <div className="py-2">
            <PendingMovesRow
              yourMove={yourMoveForRow}
              teammateMove={teammateMoveForRow}
              yourLabel="Your Move"
              teammateLabel="Teammate"
              yourName={!isOnline ? (userProfile.username || 'You') : undefined}
              teammateName={isOnline ? (
                (myTeamRef.current === 'WHITE'
                  ? whitePlayers.find(p => !p.isYou)
                  : blackPlayers.find(p => !p.isYou)
                )?.label
              ) : (
                (myTeamRef.current === 'WHITE'
                  ? whitePlayers.find(p => p.id === 'white-bot')
                  : blackPlayers.find(p => p.id === 'black-bot')
                )?.label
              )}
            />
          </div>
        )}

        {/* Inline Move Resolved (when accuracyComparison is available) */}
        {gameState.status === GameStatus.PLAYING && resolutionData && (
          <div className="px-3 pb-2">
            <MoveResolvedInline
              data={resolutionData}
              onNext={() => setAccuracyComparison(null)}
            />
          </div>
        )}

        {/* Bottom nav */}
        <BoardBottomNav
          activeTab={activeBoardTab}
          onTabChange={(t) => {
            if (t === 'moves') {
              setActiveBoardTab('game')
              closeAllPanels()
              setShowRoundHistory(true)
              return
            }
            if (t === 'insights') {
              setActiveBoardTab('game')
              closeAllPanels()
              setShowInsights(true)
              return
            }
            if (t === 'chat') {
              setActiveBoardTab('game')
              closeAllPanels()
              setShowChat(true)
              return
            }
            setActiveBoardTab(t)
          }}
          onBack={() => {
            closeAllPanels()
            setActiveBoardTab('game')
          }}
          onForward={() => {}}
          onBackMove={() => {
            const moves = moveHistoryRef.current
            if (moves.length === 0) return
            const current = playbackIndex ?? moves.length - 1
            if (current <= 0) {
              setPlaybackIndex(-1)
              setPlaybackFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
            } else {
              setPlaybackIndex(current - 1)
              setPlaybackFen(moves[current - 1]?.fenAfter || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
            }
          }}
          onForwardMove={() => {
            const moves = moveHistoryRef.current
            if (moves.length === 0) return
            const current = playbackIndex ?? moves.length - 1
            if (current >= moves.length - 1) {
              setPlaybackIndex(null)
              setPlaybackFen(null)
            } else {
              setPlaybackIndex(current + 1)
              setPlaybackFen(moves[current + 1]?.fenAfter || '')
            }
          }}
          insightsLocked={insightsState.revealsRemaining !== null && insightsState.revealsRemaining <= 0 && !insightsState.isPremium}
        />
      </div>

      <RoundHistorySidebar
        open={showRoundHistory}
        entries={roundHistoryEntries}
        onClose={() => {
          setShowRoundHistory(false)
          setActiveBoardTab('game')
        }}
      />

      <SlideOver
        open={showInsights}
        onClose={() => setShowInsights(false)}
      >
        {/* Move Insights Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-blue-300 text-lg">♟</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Move Insights</h2>
              <p className="text-xs text-slate-400">Analyze your moves</p>
            </div>
          </div>
          <button
            onClick={() => setShowInsights(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {accuracyHistory.length > 0 ? (
          <div className="text-slate-100 space-y-3">
            {!insightsState.isPremium && insightsState.revealsRemaining !== null && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-1 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
                <BarChart3 size={14} strokeWidth={2} />
                <span>{insightsState.revealsRemaining}/3 free insights remaining</span>
              </div>
            )}
            {accuracyHistory.map((comp, i) => {
              const isVisible = insightsState.isPremium || revealedIndices.has(i)
              const canReveal = !isVisible && insightsState.revealsRemaining !== null && insightsState.revealsRemaining > 0
              const isExhausted = !isVisible && insightsState.revealsRemaining !== null && insightsState.revealsRemaining <= 0

              return (
                <div key={`${comp.turnStartFen}-${i}`} className={i < accuracyHistory.length - 1 ? 'mb-3 pb-3 border-b border-slate-700/30' : ''}>
                  {accuracyHistory.length > 1 && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Move {i + 1}
                    </p>
                  )}
                  {isVisible ? (
                    <MoveInsights
                      player1Move={comp.player1Move || '?'}
                      player2Move={comp.player2Move || '?'}
                      player1Accuracy={comp.player1Accuracy || 0}
                      player2Accuracy={comp.player2Accuracy || 0}
                      player1Loss={comp.player1Loss || 0}
                      player2Loss={comp.player2Loss || 0}
                      isSync={comp.isSync}
                      winnerId={comp.winnerId}
                      bestEngineMove={comp.bestEngineMove}
                      bestEngineScore={comp.bestEngineScore}
                    />
                  ) : canReveal ? (
                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4 text-center">
                      <p className="text-xs text-slate-500 mb-3">Insight hidden — tap to reveal</p>
                      <button
                        onClick={() => handleRevealMove(i)}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs font-medium rounded-lg border border-slate-500 transition-colors min-h-[44px]"
                      >
                        Reveal Move Insight
                      </button>
                    </div>
                  ) : isExhausted ? (
                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4 text-center">
                      <Lock size={14} className="text-blue-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 mb-3">No free reveals remaining</p>
                      <button
                        onClick={handleUpgradeClick}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold rounded-lg shadow-[0_4px_20px_rgba(59,130,246,0.35)] hover:from-blue-500 hover:to-cyan-400 min-h-[44px] transition-all"
                      >
                        Upgrade to Premium
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">
            <p>Waiting for the first move resolution...</p>
            <p className="mt-2 text-xs text-slate-500">Insights will appear after both teammates submit a move.</p>
          </div>
        )}
      </SlideOver>

      <SlideOver
        open={showChat}
        onClose={() => setShowChat(false)}
      >
        {/* Team Chat Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-white text-lg">💬</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Team Chat</h2>
              <p className="text-xs text-slate-400">Communicate with teammate</p>
            </div>
          </div>
          <button
            onClick={() => setShowChat(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {playerId ? (
          <div className="text-slate-300 text-sm">
            <ChatPanel
              currentUserId={playerId}
              friendId={null}
              friendName="Team"
              currentUserName={userProfile.username || 'You'}
              onClose={() => setShowChat(false)}
            />
            <p className="mt-3 text-[11px] text-slate-500 text-center">
              Team chat coming soon — for now, use the Friends tab to chat with players you know.
            </p>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">
            <p>Sign in to chat with your teammate.</p>
          </div>
        )}
      </SlideOver>

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

      {/* Floating Confirm Move Bar — overlays above BoardBottomNav */}
      {gameState.status === GameStatus.PLAYING && (
        <ConfirmMoveBar
          visible={settings.confirmMove && !!heldMove}
          onConfirm={handleConfirmHeldMove}
          onCancel={handleCancelHeldMove}
        />
      )}
    </div>
  )
}