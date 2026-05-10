'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChessBoard, PromotionPiece, PendingOverlay, HighlightSquares } from './ChessBoard'
import { LocalGame, GameStatus, MoveComparison } from '@/features/offline/game/localGame'
import { OnlineGame } from '@/features/online/game/onlineGame'
import { Team } from '@/features/game-engine/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/features/bots/chessBot'
import { createBotConfig, getBotConfig } from '@/features/bots/botConfig'
import { supabase } from '@/lib/supabase'
import { TopBar } from './TopBar'
import { PlayerPanel } from './PlayerPanel'
import { MoveHistory } from './MoveHistory'
import { StatsTicker } from './StatsTicker'
import { SplashScreen } from './SplashScreen'
import { setGameResult, GameSummary } from '@/lib/resultsStore'

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
  const router = useRouter()
  const navigatedRef = useRef(false)
  const turnHistoryRef = useRef<Array<{ turnNumber: number; player1Move: string; player1Accuracy: number; player2Move: string; player2Accuracy: number; isSync: boolean; winnerId: string }>>([])
  const [turnHistory, setTurnHistory] = useState<Array<{ turnNumber: number; player1Move: string; player1Accuracy: number; player2Move: string; player2Accuracy: number; isSync: boolean; winnerId: string }>>([])
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
        const overlay = (g as any).pendingOverlay || null
        console.log('[Game] New state:', { status: g.status, fen: g.fen, turn: g.currentTurn, pendingOverlay: !!overlay })
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
          pendingOverlay: overlay || prev.pendingOverlay
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
    
    // Get comparison data for both WHITE and BLACK turns (not just BLACK)
    let comparison: MoveComparison | null = null
    if (currentTurn === Team.BLACK) {
      comparison = g.lastMoveComparison
    } else if (currentTurn === Team.WHITE && isOnline) {
      // For WHITE turn in online mode, also check for comparison from previous resolution
      comparison = g.lastMoveComparison
    }
    
    // Determine showResolution: show when there's comparison data
    // Only show when turn is BLACK or when comparison exists from previous resolution
    const showResolution = comparison !== null
    
    // Get pendingOverlay for online mode - show teammate's pending move
    const pendingOverlay = isOnline ? (g as any).pendingOverlay : null
    
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
        // Store WHITE team comparison separately - only update when WHITE has resolved (turn is WHITE)
        whiteTeamComparison: currentTurn === Team.WHITE && comparison ? comparison : prev.whiteTeamComparison,
        showResolution: showResolution,
        timerSeconds: g.getTeamTimer(),
        timerActive: g.isTimerActive(),
        pendingOverlay: pendingOverlay || prev.pendingOverlay
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
      const entry = {
        turnNumber: turnHistoryRef.current.length + 1,
        player1Move: comparison.player1Move,
        player1Accuracy: comparison.player1Accuracy,
        player2Move: comparison.player2Move,
        player2Accuracy: comparison.player2Accuracy,
        isSync: comparison.isSync,
        winnerId: comparison.winnerId
      }
      turnHistoryRef.current.push(entry)
      setTurnHistory([...turnHistoryRef.current])

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
        
        // Poll until both moves are locked (max 10 seconds) or turn changes
        const startTurn = g.currentTurn
        let attempts = 0
        while (g.currentTurn === startTurn && !g.isBothPendingLocked() && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 500))
          attempts++
          console.log(`[RESOLVE] Waiting... ${attempts}/20, turn: ${g.currentTurn}, both locked: ${g.isBothPendingLocked()}`)
        }
        
        // If turn already changed (another client resolved), exit
        if (g.currentTurn !== startTurn) {
          console.log(`[RESOLVE] Turn changed during polling, another client resolved`)
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
          
          const newTurn = g.currentTurn
          console.log(`[RESOLVE] Resolution complete, new turn: ${newTurn}`)
          
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
              
              setGameState(prev => ({ ...prev, isBotThinking: false, highlightSquares: null, pendingOverlay: null }))
              
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

  // Auto-hide splash when game starts
  const [showSplash, setShowSplash] = useState(true)
  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING && showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [gameState.status, showSplash])

  // Game over → results redirect
  useEffect(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (gameState.status === GameStatus.GAME_OVER && !navigatedRef.current && g) {
      navigatedRef.current = true
      const stats = isOnline ? { whiteMovesPlayed: 0, whiteSyncRate: 0, whiteConflicts: 0, player1Accuracy: 0, player2Accuracy: 0, lastMoveAccuracy: 0, lastMoveAccuracyP2: 0, movesPlayed: 0 } : (g as LocalGame).getStats()
      const resultText = g instanceof LocalGame ? g.getResult() : 'Game Over'
      console.log(`\n══════════════════════════════════════════`)
      console.log(`[GAME] OVER: ${resultText}`)
      console.log(`══════════════════════════════════════════\n`)
      const summary: GameSummary = {
        result: 'win',
        resultText,
        team: 'WHITE',
        difficulty: level ?? 4,
        stats: stats as any,
        categoryBreakdown: {
          player1: { great: 70, good: 20, inaccuracy: 5, mistake: 3, blunder: 2 },
          player2: { great: 55, good: 25, inaccuracy: 10, mistake: 7, blunder: 3 },
        },
        turnHistory: turnHistoryRef.current,
      }
      setGameResult(summary)
      router.push('/results')
    }
  }, [gameState.status, isOnline])

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

  const stats = !isOnline && game ? game.getStats() : { whiteMovesPlayed: 0, whiteSyncRate: 0, whiteConflicts: 0, player1Accuracy: 100, player2Accuracy: 100 }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <SplashScreen isVisible={showSplash} />

      {gameState.pendingPromotion && (
        <PromotionModal onSelect={handlePromotionSelect} />
      )}

      <TopBar
        currentTurn={gameState.currentTurn}
        timerSeconds={gameState.timerSeconds}
        timerActive={gameState.timerActive}
        isMyTurn={gameState.isMyTurn}
        phase={gameState.phase}
        status={gameState.status}
      />

      {isOnline && roomCode && (
        <div className="fixed top-16 left-0 right-0 z-30 p-2 bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 text-center">
          <p className="text-gray-400 text-[10px]">Room: <span className="text-yellow-400 font-bold font-mono">{roomCode}</span></p>
        </div>
      )}

      <main className={`flex-1 flex pt-16 pb-10 ${isOnline && roomCode ? 'mt-8' : ''}`}>
        <PlayerPanel
          team={Team.WHITE}
          capturedPieces={gameState.capturedByWhite}
          blackCapturedPieces={gameState.capturedByBlack}
          accuracy={stats.player1Accuracy}
          isActive={gameState.currentTurn === Team.WHITE && gameState.status === GameStatus.PLAYING}
          comparison={gameState.moveComparison}
          playerId={playerId}
          player1Id={isOnline ? null : 'player1'}
        />

        <section className="flex-1 flex items-center justify-center p-4">
          <div className="glass-panel rounded-xl p-2 w-full max-w-[600px] relative">
            <ChessBoard
              fen={gameState.fen}
              onMove={handleMove}
              enabled={gameState.status === GameStatus.PLAYING && gameState.currentTurn === Team.WHITE && !gameState.isBotThinking && !gameState.pendingPromotion}
              orientation="white"
              lastMove={gameState.lastMove}
              pendingOverlay={gameState.pendingOverlay}
              myPendingOverlay={gameState.pendingOverlay}
              highlightSquares={gameState.highlightSquares}
              onAnimationComplete={handleResolutionComplete}
            />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              {gameState.selectedMove && (
                <p className="text-green-400 text-xs bg-gray-900/80 px-3 py-1 rounded-full">
                  {gameState.selectedMove}
                </p>
              )}
              {gameState.isBotThinking && (
                <p className="text-blue-400 text-xs bg-gray-900/80 px-3 py-1 rounded-full">
                  Bot thinking...
                </p>
              )}
              {gameState.status === GameStatus.GAME_OVER && (
                <p className="text-xl font-bold text-yellow-400 bg-gray-900/80 px-3 py-1 rounded-full">
                  {isOnline && onlineGameRef.current ? 'Game Over' : (game as LocalGame)?.getResult()}
                </p>
              )}
            </div>
          </div>
        </section>

        <MoveHistory
          turns={turnHistory}
          roomCode={roomCode}
          isOnline={isOnline}
        />
      </main>

      <StatsTicker
        syncRate={stats.whiteSyncRate}
        conflicts={stats.whiteConflicts}
        totalMoves={stats.whiteMovesPlayed}
      />
    </div>
  )
}