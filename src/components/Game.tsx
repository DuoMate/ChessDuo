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
import { AnalyzingIndicator } from './AnalyzingIndicator'
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
  timerSeconds: number
  timerActive: boolean
  pendingOverlay: PendingOverlay | null
  highlightSquares: HighlightSquares | null
  showResolution: boolean
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

  // Only create bot config for offline mode
  const botConfig = useMemo(() => {
    if (isOnline) return null // No bots needed in online mode
    
    if (level && level >= 1 && level <= 6) {
      console.log(`[Game] Using selected level: ${level} for opponent`)
      return createBotConfig(level, level)
    }
    console.log('[Game] No level selected, using default config')
    return getBotConfig()
  }, [isOnline, level])

  const [bot] = useState(() => {
    if (isOnline || !botConfig) return null // No bots in online mode
    const botInstance = createBot({ skillLevel: botConfig.opponentSkillLevel })
    console.log(`[Game] Opponent bot created with level: ${botConfig.opponentSkillLevel}, description: ${botInstance.getSkillDescription()}`)
    return botInstance
  })
  const [teammateBot] = useState(() => {
    if (isOnline || !botConfig) return null // No bots in online mode
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
    timerSeconds: 10,
    timerActive: false,
    pendingOverlay: null,
    highlightSquares: null,
    showResolution: false
  })

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
          timerActive: g.isTimerActive()
        }))
      }
    })
    console.log('[Game] setOnStateChange callback set up complete')
  }, [onlineGame])

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
    
    let comparison: MoveComparison | null = null
    if (currentTurn === Team.BLACK) {
      comparison = g.lastMoveComparison
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
        timerSeconds: g.getTeamTimer(),
        timerActive: g.isTimerActive()
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

    if (comparison) {
      const winnerId = comparison.winnerId
      const loserId = comparison.loserId

      let highlightSquares: HighlightSquares = {}

      if (winnerId === 'player1' && humanMove) {
        highlightSquares.winnerFrom = humanMove.from
        highlightSquares.winnerTo = humanMove.to
        if (!comparison.isSync && loserId === 'player2' && teammateMove) {
          highlightSquares.loserFrom = teammateMove.from
          highlightSquares.loserTo = teammateMove.to
        }
      } else if (winnerId === 'player2' && teammateMove) {
        highlightSquares.winnerFrom = teammateMove.from
        highlightSquares.winnerTo = teammateMove.to
        if (!comparison.isSync && loserId === 'player1' && humanMove) {
          highlightSquares.loserFrom = humanMove.from
          highlightSquares.loserTo = humanMove.to
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

      console.log(`\n[HUMAN] Attempting move: ${uciMove} (current turn: ${currentTurn})`)

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
            pendingOverlay: null,
            showResolution: false,
            highlightSquares: null
          }))
        }

        g.lockPendingMove(playerId as any)
        g.broadcastLocked()

        console.log(`[RESOLVE] Waiting for teammate to lock move...`)
        
        // Poll until both moves are locked (max 10 seconds)
        let attempts = 0
        while (!g.isBothPendingLocked() && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 500))
          attempts++
          console.log(`[RESOLVE] Waiting... ${attempts}/20, both locked: ${g.isBothPendingLocked()}`)
        }

        if (g.isBothPendingLocked()) {
          console.log(`[RESOLVE] Both locked, resolving...`)
          await g.resolvePendingMoves()
          updateStateRef.current()
          console.log(`[RESOLVE] Resolution complete, new turn: ${g.currentTurn}`)
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
            pendingOverlay: null
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
      setGameState(prev => ({ ...prev, isBotThinking: false, highlightSquares: null, pendingOverlay: null }))
      if (gameRef.current) {
        gameRef.current.startPendingTurn()
        updateStateRef.current()
        startTimer()
      }
    }
  }, [executeBotMove, startTimer])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {gameState.pendingPromotion && (
        <PromotionModal onSelect={handlePromotionSelect} />
      )}
        
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">ClashMate</h1>

        {roomCode && (
          <div className="mb-4 p-3 bg-gray-700 rounded text-center">
            <p className="text-gray-400 text-sm mb-1">Share this room code with your teammate:</p>
            <p className="text-2xl font-bold text-yellow-400 tracking-widest font-mono">
              {roomCode}
            </p>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-2">
          <div className={`px-4 py-2 rounded ${gameState.currentTurn === Team.WHITE ? 'bg-white text-gray-900' : 'bg-gray-700'}`}>
            White Team (You)
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <div className="text-lg font-mono">
              {gameState.status === GameStatus.GAME_OVER ? (
                <span className="text-yellow-400 font-bold">Game Over!</span>
              ) : gameState.isBotThinking ? (
                <span className="text-blue-300">Your turn</span>
              ) : (
                <span className="text-gray-400">
                  {gameState.status === GameStatus.PLAYING ? 'Waiting...' : 'Waiting...'}
                </span>
              )}
            </div>
          </div>
          
          <div className={`px-4 py-2 rounded ${gameState.currentTurn === Team.BLACK ? 'bg-white text-gray-900' : 'bg-gray-700'}`}>
            Black Team (Bot)
          </div>
        </div>

        <div className="flex items-start justify-center gap-6 mb-4">
          {/* Left side - WHITE team (Timer + Captured) */}
          <div className="w-40 flex flex-col items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <TeamTimer 
                seconds={gameState.timerSeconds}
                isActive={gameState.timerActive && gameState.currentTurn === Team.WHITE}
                currentTeam={Team.WHITE}
              />
            </div>
            <CapturedPiecesDisplay pieces={gameState.capturedByWhite} label="White captured" />
          </div>
          
          {/* Chess Board */}
          <div className="w-[500px] h-[500px] flex-shrink-0 relative">
            <ChessBoard 
              fen={gameState.fen}
              onMove={handleMove}
              enabled={gameState.status === GameStatus.PLAYING && gameState.currentTurn === Team.WHITE && !gameState.isBotThinking && !gameState.pendingPromotion}
              orientation="white"
              lastMove={gameState.lastMove}
              pendingOverlay={gameState.pendingOverlay}
              highlightSquares={gameState.highlightSquares}
              onAnimationComplete={handleResolutionComplete}
            />
          </div>
          
          {/* Right side - BLACK team (Timer + Resolution + Captured) */}
          <div className="w-40 flex flex-col items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <TeamTimer 
                seconds={gameState.timerSeconds}
                isActive={gameState.timerActive && gameState.currentTurn === Team.BLACK}
                currentTeam={Team.BLACK}
              />
            </div>
            <AnimatePresence>
              {gameState.showResolution && gameState.moveComparison && (
                <MoveComparisonPanel 
                  comparison={gameState.moveComparison}
                  isVisible={gameState.showResolution}
                  onAnimationComplete={handleResolutionComplete}
                />
              )}
            </AnimatePresence>
            <CapturedPiecesDisplay pieces={gameState.capturedByBlack} label="Black captured" />
          </div>
        </div>

        <div className="mt-4 text-center">
          {gameState.selectedMove && (
            <p className="text-green-400">Selected: {gameState.selectedMove}</p>
          )}
          {gameState.status === GameStatus.GAME_OVER && (
            <p className="text-xl font-bold text-yellow-400">
              {isOnline && onlineGameRef.current ? 'Game Over' : game?.getResult()}
            </p>
          )}
          {gameState.isBotThinking && (
            <p className="text-blue-400">Bot is making a move...</p>
          )}
        </div>

        <div className="mt-8 p-4 bg-gray-800 rounded">
          <h2 className="font-bold mb-2">Your Team Stats (White)</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {!isOnline && game ? (
              <>
                <div>White Moves: {game.getStats().whiteMovesPlayed}</div>
                <div>Sync Rate: {Math.round(game.getStats().whiteSyncRate * 100)}%</div>
                <div>Conflicts: {game.getStats().whiteConflicts}</div>
                <div>Player 1 Avg Accuracy: {Math.round(game.getStats().player1Accuracy)}%</div>
                <div>Player 2 Avg Accuracy: {Math.round(game.getStats().player2Accuracy)}%</div>
              </>
            ) : (
              <>
                <div>Game Mode: Online (Human vs Human)</div>
                <div>Stats not available in online mode</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}