'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChessBoard, PromotionPiece, PendingOverlay, HighlightSquares } from './ChessBoard'
import { LocalGame, GameStatus, MoveComparison } from '@/features/offline/game/localGame'
import { OnlineGame } from '@/features/online/game/onlineGame'
import { Team } from '@/features/game-engine/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/features/bots/chessBot'
import { createBotConfig, getBotConfig } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { TeamTimer } from './TeamTimer'
import { MoveComparisonPanel } from './MoveComparison'
import { GameOverModal } from './GameOverModal'
import { AccuracyBottomSheet } from './AccuracyBottomSheet'
import { AnalyzingIndicator } from './AnalyzingIndicator'
import { GameLoading } from './GameLoading'
import { GameInfo } from './GameInfo'
import { PendingMoveOverlay } from './PendingMoveOverlay'
import { playMoveSound, playCaptureSound, playCheckSound, playCheckmateSound, playLockSound, playResolutionSound, setSoundEnabled } from '@/lib/sounds'
import { motion, AnimatePresence } from 'framer-motion'

interface GameProps {
  level?: number
  roomCode?: string
  mode?: string
  roomId?: string
  team?: 'WHITE' | 'BLACK'
  playerId?: string
}

function normalizeUci(uci: string): string {
  return uci.replace(/-/g, '')
}

function uciToSan(uciMove: string, fen: string, promotion?: PromotionPiece): string {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  
  const normalized = normalizeUci(uciMove)
  const from = normalized.substring(0, 2)
  const to = normalized.substring(2, 4)
  
  for (const move of moves) {
    if (move.from === from && move.to === to) {
      if (promotion) {
        return `${from}${to}=${promotion.toUpperCase()}`
      }
      return move.san
    }
  }
  
  throw new Error(`uciToSan: Move ${uciMove} not found in legal moves from position ${fen}`)
}

function getMoveFromUci(uciMove: string, fen: string): { from: string; to: string; piece: string } | null {
  const normalized = normalizeUci(uciMove)
  const from = normalized.substring(0, 2)
  const to = normalized.substring(2, 4)
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  const move = moves.find(m => m.from === from && m.to === to)
  
  if (move) {
    const piece = move.piece || chess.get(from as any)?.type || ''
    return { from, to, piece }
  }
  return null
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
  moveComparison: MoveComparison | null
  whiteTeamComparison: MoveComparison | null
  timerSeconds: number
  timerActive: boolean
  pendingOverlay: PendingOverlay | null
  myPendingOverlay: PendingOverlay | null
  highlightSquares: HighlightSquares | null
  showResolution: boolean
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

function CapturedPiecesDisplay({ pieces, label }: { pieces: string[], label: string }) {
  const sortedPieces = [...pieces].sort((a, b) => {
    const order = ['q', 'r', 'b', 'n', 'p']
    return order.indexOf(a) - order.indexOf(b)
  })
  
  return (
    <div className="flex flex-col items-center w-[100px]">
      <span className="text-xs text-gray-400 mb-1">{label}</span>
      <div className="flex flex-wrap gap-1 p-2 bg-gray-800 rounded border border-gray-600 h-[80px] w-full justify-center content-start">
        {sortedPieces.length === 0 ? (
          <span className="text-gray-600 text-xs">No captures</span>
        ) : (
          sortedPieces.map((piece, index) => (
            <span 
              key={`${piece}-${index}`} 
              className="text-2xl bg-gray-700 rounded px-1 text-white border border-gray-500"
              style={{ textShadow: '0 0 2px rgba(255,255,255,0.5)' }}
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

export function Game({ level, roomCode, mode, roomId, team, playerId: playerIdFromProps }: GameProps) {
  console.log('[Game] Component rendered with:', { level, roomCode, mode, roomId, team, playerId: playerIdFromProps })
  
  const [game] = useState(() => mode !== 'online' ? new LocalGame() : null)
  const [onlineGame] = useState(() => {
    console.log('[Game] Creating OnlineGame, mode:', mode)
    return mode === 'online' ? new OnlineGame() : null
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
    moveComparison: null,
    whiteTeamComparison: null,
    timerSeconds: 10,
    timerActive: false,
    pendingOverlay: null,
    myPendingOverlay: null,
    highlightSquares: null,
    showResolution: false,
    isLoading: true
  })

  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showOptions, setShowOptions] = useState(false)
  
  // Replay state
  const [isReplayMode, setIsReplayMode] = useState(false)
  const [replayTurn, setReplayTurn] = useState(0)
  const [gameLog, setGameLog] = useState<any[]>([])

  // Get game log from online game
  const getGameLog = useCallback(() => {
    if (onlineGame && isOnline) {
      return onlineGame.getGameLog?.() || []
    }
    return []
  }, [onlineGame, isOnline])

  // Navigate to previous turn
  const goToPreviousTurn = useCallback(() => {
    if (replayTurn > 0) {
      setReplayTurn(replayTurn - 1)
    }
  }, [replayTurn])

  // Navigate to next turn
  const goToNextTurn = useCallback(() => {
    const log = getGameLog()
    const maxTurn = Math.max(...log.map((e: any) => e.t), 0)
    if (replayTurn < maxTurn) {
      setReplayTurn(replayTurn + 1)
    }
  }, [replayTurn, getGameLog])

  // Toggle replay mode
  const toggleReplayMode = useCallback(() => {
    if (!isReplayMode) {
      // Enter replay mode - load current game log
      const log = getGameLog()
      setGameLog(log)
      const maxTurn = Math.max(...log.map((e: any) => e.t), 0)
      setReplayTurn(maxTurn)
    } else {
      // Exit replay mode
      setReplayTurn(0)
    }
    setIsReplayMode(!isReplayMode)
  }, [isReplayMode, getGameLog])

  // Update sound engine when setting changes
  useEffect(() => {
    setSoundEnabled(soundEnabled)
  }, [soundEnabled])

  // Player ID from URL props (passed from Room component)
  // No need to get session - use the playerId directly from URL
  const playerId = playerIdFromProps || null
  console.log('[Game] Using playerId from props:', playerId)

  // Set up state change callback for online mode - MUST be before joinRoom
  const onlineGameRef = useRef(onlineGame)
  useEffect(() => {
    console.log('[Game] setOnStateChange useEffect, onlineGame:', !!onlineGame)
    if (!onlineGame) {
      console.log('[Game] No onlineGame, skipping setOnStateChange')
      return
    }
    
    onlineGameRef.current = onlineGame
    console.log('[Game] Setting up setOnStateChange callback')
    onlineGame.setOnStateChange(() => {
      console.log('[Game] 🔥 State change callback triggered!')
      if (onlineGameRef.current) {
        const g = onlineGameRef.current
        const captured = g.getCapturedPieces()
        console.log('[Game] New state:', { status: g.status, fen: g.fen, turn: g.currentTurn })
        
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
              pendingOverlay = { from: teammatePending.from, to: teammatePending.to, piece, color: g.currentTurn === Team.WHITE ? 'white' : 'black' }
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
          timerSeconds: g.getTeamTimer(),
          timerActive: g.isTimerActive(),
          isLoading: g.status === GameStatus.PLAYING ? false : prev.isLoading,
          pendingOverlay,
          myPendingOverlay
        }))
      }
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
      team,
      conditionsMet: mode === 'online' && !!onlineGame && !!playerId && !!roomId && !!team
    })
    
    if (mode === 'online' && onlineGame && playerId && roomId && team) {
      console.log('[Game] ✅ Calling joinRoom with:', { roomId, playerId, team })
      onlineGame.joinRoom({ id: roomId } as any, playerId, team)
    } else {
      console.log('[Game] ❌ joinRoom NOT called - conditions not met')
    }
  }, [mode, onlineGame, playerId, roomId, team])

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gameRef = useRef(game)
  const opponentInProgressRef = useRef(false)
  const pendingOpponentTurnRef = useRef(false)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  const startTimer = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    g.setTeamTimer(10)
    
    timerRef.current = setInterval(() => {
      const currentTimer = g.getTeamTimer()
      if (currentTimer <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        g.setTimerActive(false)
        setGameState(prev => ({ ...prev, timerSeconds: 0, timerActive: false }))
        return
      }
      
      g.setTeamTimer(currentTimer - 1)
      setGameState(prev => ({ ...prev, timerSeconds: currentTimer - 1 }))
    }, 1000)
  }, [isOnline])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (g) {
      g.setTimerActive(false)
    }
    setGameState(prev => ({ ...prev, timerActive: false }))
  }, [isOnline])

  const updateState = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    const captured = g.getCapturedPieces()
    const currentTurn = g.currentTurn
    
    // Get comparison data for both WHITE and BLACK turns (not just BLACK)
    let comparison: MoveComparison | null = null
    const prevTurn = gameState.currentTurn
    
    // Clear whiteTeamComparison when new WHITE turn starts (turn changed from BLACK to WHITE)
    const isNewWhiteTurn = prevTurn === Team.BLACK && currentTurn === Team.WHITE
    
    if (currentTurn === Team.BLACK) {
      comparison = g.lastMoveComparison
    } else if (currentTurn === Team.WHITE && isOnline && !isNewWhiteTurn) {
      // For WHITE turn in online mode, also check for comparison from previous resolution
      // BUT don't show at start of new WHITE turn (it's from previous WHITE turn - stale)
      comparison = g.lastMoveComparison
    }
    
    // Determine showResolution: show when there's comparison data
    // Only show when turn is BLACK or when comparison exists from previous resolution (not at new WHITE start)
    const showResolution = comparison !== null && !isNewWhiteTurn
    
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
          pendingOverlay = { from: teammatePending.from, to: teammatePending.to, piece, color: currentTurn === Team.WHITE ? 'white' : 'black' }
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
        moveComparison: comparison,
        // Store WHITE team comparison separately
        // Only update during WHITE turn - keep same during BLACK turn
        // Clear when new WHITE turn starts (isNewWhiteTurn)
        whiteTeamComparison: isNewWhiteTurn 
          ? null 
          : (currentTurn === Team.WHITE && comparison 
            ? comparison 
            : prev.whiteTeamComparison),
        showResolution: showResolution,
        timerSeconds: g.getTeamTimer(),
        timerActive: g.isTimerActive(),
        pendingOverlay,
        myPendingOverlay,
        // Clear loading when game is ready
        isLoading: g.status === GameStatus.PLAYING ? false : prev.isLoading
      }
      return newState
    })
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

    stopTimer()

    const pending = g.getPendingMoves()
    const humanMove = pending.human
    const teammateMove = pending.teammate

    if (!humanMove || !teammateMove) {
      return false
    }

    if (isOnline) {
      await g.resolvePendingMoves()
    } else {
      await g.resolvePendingMoves()
    }

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
        showResolution: true
      }))

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
      const turnState = (g as any).turnState

      console.log(`\n[HUMAN] Attempting move: ${uciMove} (current turn: ${currentTurn}, turnState: ${turnState})`)

      // Only allow moves when turnState is 'selecting' (not waiting, locked, or resolving)
      if (turnState !== 'selecting') {
        console.warn(`[HUMAN] BLOCKED - Not in selecting state! Current: ${turnState}`)
        return
      }

      if (currentTurn !== Team.WHITE) {
        console.warn(`[HUMAN] BLOCKED - Not WHITE's turn! Current: ${currentTurn}`)
        return
      }

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
            showResolution: false,
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
          // Try to resolve - will fail gracefully if already resolved by other client
          console.log(`[RESOLVE] Both locked, attempting resolve...`)
          const comparison = g.lastMoveComparison
          
          // Validate chess square format (e.g., "e2", "d4")
          const isValidSquare = (sq: string | undefined): sq is string => 
            !!sq && sq.length === 2 && /^[a-h][1-8]$/.test(sq)

          // Set highlight squares for winner/loser moves
          if (comparison) {
            const highlightSquares: HighlightSquares = {}
            const winnerId = comparison.winnerId
            
            if (winnerId === 'player1' && comparison.player1Move) {
              const wf = comparison.winningMove.substring(0, 2)
              const wt = comparison.winningMove.substring(2, 4)
              if (isValidSquare(wf)) highlightSquares.winnerFrom = wf
              if (isValidSquare(wt)) highlightSquares.winnerTo = wt
              if (!comparison.isSync && comparison.loserId === 'player2') {
                const lf = comparison.player2Move?.substring(0, 2)
                const lt = comparison.player2Move?.substring(2, 4)
                if (isValidSquare(lf)) highlightSquares.loserFrom = lf
                if (isValidSquare(lt)) highlightSquares.loserTo = lt
              }
            } else if (winnerId === 'player2' && comparison.player2Move) {
              const wf = comparison.winningMove.substring(0, 2)
              const wt = comparison.winningMove.substring(2, 4)
              if (isValidSquare(wf)) highlightSquares.winnerFrom = wf
              if (isValidSquare(wt)) highlightSquares.winnerTo = wt
              if (!comparison.isSync && comparison.loserId === 'player1') {
                const lf = comparison.player1Move?.substring(0, 2)
                const lt = comparison.player1Move?.substring(2, 4)
                if (isValidSquare(lf)) highlightSquares.loserFrom = lf
                if (isValidSquare(lt)) highlightSquares.loserTo = lt
              }
            }
            
            setGameState(prev => ({ ...prev, highlightSquares, showResolution: true }))
          }
          
          try {
            await g.resolvePendingMoves()
            updateStateRef.current()
            console.log(`[RESOLVE] Resolve succeeded`)
          } catch (e) {
            console.log(`[RESOLVE] Resolve failed (already resolved by other client):`, e)
          }
          
          const newTurn = g.currentTurn as Team
          console.log(`[RESOLVE] Resolution complete, new turn: ${newTurn}`)
          playResolutionSound()
          
          // In online mode, after WHITE resolves, BLACK (bots) need to move
          // Only one client should handle bot moves - use playerId to coordinate
          if (newTurn === Team.BLACK && bot && playerId) {
            // Get both players from game state to determine coordinator
            const players = g.getPlayers(Team.WHITE)
            console.log(`[RESOLVE] BLACK handling check - players:`, players, 'playerId:', playerId, 'bot:', !!bot)
            const sortedPlayers = [...players].sort()
            const isCoordinator = playerId === sortedPlayers[0]
            console.log(`[RESOLVE] isCoordinator:`, isCoordinator, 'sortedPlayers:', sortedPlayers)
            
            if (isCoordinator) {
              console.log(`[RESOLVE] Handling BLACK bot moves (coordinator)...`)
              setGameState(prev => ({ ...prev, isBotThinking: true }))
              
              const currentFen = g.board.fen()
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
                  
                  console.log(`[RESOLVE] Bot moves set and locked, pending moves:`, g.getAllPendingMoves())
                  setGameState(prev => ({ ...prev, pendingOverlay: { from: moveInfo.from, to: moveInfo.to, piece: moveInfo.piece, color: 'black' } }))
                }
              }
              
              // Skip the isBothPendingLocked check - we just set and locked the moves, just resolve
              console.log(`[RESOLVE] Attempting BLACK resolve directly...`)
              try {
                await g.resolvePendingMoves()
                console.log(`[RESOLVE] BLACK resolve succeeded, new turn:`, g.currentTurn)
                updateStateRef.current()
              } catch (e) {
                console.log(`[RESOLVE] BLACK resolve failed:`, e)
                // Force advance to WHITE if resolve fails
                g.startPendingTurn()
              }
              
setGameState(prev => ({ ...prev, isBotThinking: false, highlightSquares: null, pendingOverlay: null, myPendingOverlay: null }))
              
              // Start next WHITE turn
              g.startPendingTurn()
              updateStateRef.current()
              startTimer()
            } else {
              console.log(`[RESOLVE] Non-coordinator waiting for BLACK to complete...`)
              // Wait for turn to change to WHITE
              let attempts = 0
              while (g.currentTurn !== Team.WHITE && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 500))
                attempts++
                console.log(`[RESOLVE] Waiting for WHITE... ${attempts}/30, turn: ${g.currentTurn}`)
              }
              console.log(`[RESOLVE] Turn changed to: ${g.currentTurn}`)
              
              // Clear the resolution UI
              setGameState(prev => ({ ...prev, highlightSquares: null }))
              
              // Start timer for next WHITE turn
              startTimer()
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
        startTimer()

        setGameState(prev => ({
          ...prev,
          showResolution: false,
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
            myPendingOverlay: { from: moveInfo.from, to: moveInfo.to, piece: moveInfo.piece, color: 'white' }
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
              pendingOverlay: { from, to, piece, color: 'white' }
            }))
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
          startTimer()
        } else {
          console.log(`[HUMAN] Triggering opponent turn after WHITE resolution`)
          await handleResolutionComplete()
        }
      } catch (e) {
        console.warn('[HUMAN] Invalid move:', uciMove, e)
      }
    }
  }, [isOnline, onlineGame, game, playerId, teammateBot, startTimer, checkAndResolve])

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
      const [from, to] = uciMove.split('-')
      setGameState(prev => ({
        ...prev,
        pendingPromotion: { from, to }
      }))
    } else {
      executeMove(uciMove)
    }
  }, [executeMove])

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
      setGameState(prev => ({ ...prev, isBotThinking: false, highlightSquares: null, pendingOverlay: null, myPendingOverlay: null }))
      if (gameRef.current) {
        gameRef.current.startPendingTurn()
        updateStateRef.current()
        startTimer()
      }
    }
  }, [executeBotMove, startTimer])

  // Show loading state while game initializes
  if (gameState.isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <GameLoading 
          message={isOnline ? "Connecting to game server..." : "Initializing game..."} 
        />
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden">
      {gameState.pendingPromotion && (
        <PromotionModal onSelect={handlePromotionSelect} />
      )}
      
      {gameState.status === GameStatus.GAME_OVER && (
        <GameOverModal 
          winner={gameState.currentTurn === Team.WHITE ? 'BLACK' : 'WHITE'}
          onPlayAgain={() => window.location.reload()}
        />
      )}
        
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 backdrop-blur-sm">
        <button
          onClick={() => window.location.href = '/'}
          className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600 transition-colors"
          title="Back to menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {roomCode && (
          <div className="px-3 py-1 bg-gray-700/50 rounded-full text-sm">
            <span className="text-gray-400">Room:</span>{' '}
            <span className="text-yellow-400 font-bold font-mono">{roomCode}</span>
          </div>
        )}
        
        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600 transition-colors"
            title="Options"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          
          {showOptions && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
              <button
                onClick={() => { setSoundEnabled(!soundEnabled); setShowOptions(false) }}
                className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2"
              >
                {soundEnabled ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    Sound On
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    Sound Off
                  </>
                )}
              </button>
              <button
                onClick={() => { alert('Resign functionality coming soon'); setShowOptions(false) }}
                className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 text-red-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Resign
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Non-scrolling */}
      {/* Mobile: vertical layout with full-width board | Desktop: centered square board */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-between px-2 lg:px-8 py-3 gap-2 lg:gap-4">
        
        {/* Mobile: Above board | Desktop: Left side */}
        <div className="flex flex-col items-center lg:items-start lg:justify-center gap-2 order-1 lg:order-1">
          <div className={`px-4 py-1.5 rounded-full text-sm ${gameState.currentTurn === Team.BLACK ? 'bg-white/20 text-white' : 'bg-gray-800/60 text-gray-400'}`}>
            <span className="font-medium">Black</span>
            <span className="mx-2">·</span>
            <span className="hidden sm:inline">Opponent</span>
          </div>
          
          {/* Timers - Desktop: left of board */}
          <div className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/60 ${gameState.timerSeconds < 10 && gameState.timerActive ? 'text-red-400' : 'text-gray-400'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-mono">{formatTime(gameState.timerSeconds)}</span>
            <span className="text-xs text-gray-500">White</span>
          </div>
        </div>
        
        {/* Chess Board - Centered */}
        {/* Mobile: full width, square aspect | Desktop: fixed max size */}
        <div className="w-full max-w-[calc(100vw-16px)] aspect-square sm:w-[340px] sm:aspect-square md:w-[400px] lg:w-[500px] lg:h-[500px] lg:aspect-square flex-shrink-0 relative order-2 lg:order-2">
          <ChessBoard 
            fen={gameState.fen}
            onMove={handleMove}
            enabled={gameState.status === GameStatus.PLAYING && gameState.currentTurn === Team.WHITE && !gameState.isBotThinking && !gameState.pendingPromotion}
            orientation="white"
            lastMove={gameState.lastMove}
            pendingOverlay={gameState.pendingOverlay}
            myPendingOverlay={gameState.myPendingOverlay}
            highlightSquares={gameState.highlightSquares}
            onAnimationComplete={handleResolutionComplete}
          />
          
          {/* Game Status Overlay */}
          {gameState.status === GameStatus.PLAYING && !gameState.isBotThinking && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-gray-900/80 px-3 py-1 rounded-full text-xs text-gray-400">
              {gameState.currentTurn === Team.WHITE ? 'Your turn' : 'Opponent thinking...'}
            </div>
          )}
        </div>
        
        {/* Replay Controls - Always Visible Below Board */}
        {isOnline && (
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={goToPreviousTurn}
              disabled={replayTurn <= 0}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={toggleReplayMode}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isReplayMode ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700/50 hover:bg-gray-600'
              }`}
            >
              {isReplayMode ? 'Exit Replay' : 'Replay'}
            </button>
            
            <button
              onClick={goToNextTurn}
              disabled={replayTurn >= Math.max(...gameLog.map((e: any) => e.t), 0)}
              className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
        
        {/* White Team (You + Teammate) - Below Board */}
        <div className="mt-3 flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-sm ${gameState.currentTurn === Team.WHITE ? 'bg-white/20 text-white' : 'bg-gray-800/60 text-gray-400'}`}>
            <span className="font-medium">White</span>
            <span className="mx-2">·</span>
            <span>You</span>
          </div>
          <div className="px-3 py-1.5 rounded-full text-sm bg-gray-800/40 text-gray-500">
            <span className="font-medium">White</span>
            <span className="mx-2">·</span>
            <span>Bot</span>
          </div>
        </div>
        
        {/* Timers - Bottom Corners */}
        <div className="flex justify-between w-full max-w-[500px] mt-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/60 ${gameState.timerSeconds < 10 && gameState.timerActive ? 'text-red-400' : 'text-gray-400'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-mono">{formatTime(gameState.timerSeconds)}</span>
            <span className="text-xs text-gray-500">White</span>
          </div>
          
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/60 text-gray-500`}>
            <span className="text-xs">Black</span>
            <span className="text-xs text-gray-600">--:--</span>
          </div>
        </div>
      </div>
    </div>
  )
}