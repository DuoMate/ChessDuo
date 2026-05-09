'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChessBoard, PromotionPiece, PendingOverlay, HighlightSquares } from './ChessBoard'
import { LocalGame, GameStatus, MoveComparison } from '@/features/offline/game/localGame'
import { Team } from '@/features/game-engine/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/features/bots/chessBot'
import { createBotConfig, getBotConfig } from '@/features/bots/botConfig'
import { TopBar } from './TopBar'
import { PlayerPanel } from './PlayerPanel'
import { ComparisonPanel } from './ComparisonPanel'
import { StatsTicker } from './StatsTicker'
import { AnimatePresence } from 'framer-motion'
import { setGameResult, GameSummary } from '@/lib/resultsStore'
import { SplashScreen } from './SplashScreen'

interface GameProps {
  level?: number
  mode?: string
  roomCode?: string
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

export function Game({ level }: GameProps) {
  const router = useRouter()
  console.log(`\n══════════════════════════════════════════`)
  console.log(`[GAME] MOUNT: level=${level ?? 'default'}`)
  console.log(`[GAME] Mode: offline (bot teammate + bot opponents)`)

  const [game] = useState(() => new LocalGame())

  const botConfig = useMemo(() => {
    if (level && level >= 1 && level <= 6) {
      console.log(`[Game] Using selected level: ${level} for opponent`)
      return createBotConfig(level, level)
    }
    console.log('[Game] No level selected, using default config')
    return getBotConfig()
  }, [level])

  const [bot] = useState(() => {
    const botInstance = createBot({ skillLevel: botConfig.opponentSkillLevel })
    console.log(`[Game] Opponent bot created with level: ${botConfig.opponentSkillLevel}, description: ${botInstance.getSkillDescription()}`)
    return botInstance
  })
  const [teammateBot] = useState(() => {
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
  const [showSplash, setShowSplash] = useState(true)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gameRef = useRef(game)
  const opponentInProgressRef = useRef(false)
  const pendingOpponentTurnRef = useRef(false)
  const turnHistoryRef = useRef<Array<{ turnNumber: number; player1Move: string; player1Accuracy: number; player2Move: string; player2Accuracy: number; isSync: boolean; winnerId: string }>>([])
  
  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    if (gameState.status === GameStatus.PLAYING && showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [gameState.status, showSplash])

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    game.setTeamTimer(10)
    
    timerRef.current = setInterval(() => {
      const currentTimer = gameRef.current.getTeamTimer()
      if (currentTimer <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        gameRef.current.setTimerActive(false)
        setGameState(prev => ({ ...prev, timerSeconds: 0, timerActive: false }))
        return
      }
      
      gameRef.current.setTeamTimer(currentTimer - 1)
      setGameState(prev => ({ ...prev, timerSeconds: currentTimer - 1 }))
    }, 1000)
  }, [game])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    game.setTimerActive(false)
    setGameState(prev => ({ ...prev, timerActive: false }))
  }, [game])

  const updateState = useCallback(() => {
    const captured = game.getCapturedPieces()
    const stats = game.getStats()
    const currentTurn = game.currentTurn
    
    let comparison: MoveComparison | null = null
    if (currentTurn === Team.BLACK) {
      comparison = game.lastMoveComparison
    }
    
    setGameState(prev => {
      const newState = {
        ...prev,
        status: game.status,
        fen: game.board.fen(),
        currentTurn,
        selectedMove: game.getSelectedMove('player1'),
        phase: game.status === GameStatus.PLAYING ? 'selecting' : 'waiting',
        capturedByWhite: captured.white,
        capturedByBlack: captured.black,
        isMyTurn: currentTurn === Team.WHITE && game.status === GameStatus.PLAYING,
        lastMove: game.lastMove,
        moveAccuracy: stats.lastMoveAccuracy,
        moveAccuracyP2: stats.lastMoveAccuracyP2,
        totalMoves: stats.movesPlayed,
        moveComparison: comparison,
        timerSeconds: game.getTeamTimer(),
        timerActive: game.isTimerActive()
      }
      return newState
    })
  }, [game])

  const updateStateRef = useRef(updateState)
  useEffect(() => {
    updateStateRef.current = updateState
  }, [updateState])

  const checkAndResolve = useCallback(async () => {
    const g = gameRef.current
    
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

    await g.resolvePendingMoves()
    
    const comparison = g.lastMoveComparison
    
    if (comparison) {
      turnHistoryRef.current.push({
        turnNumber: turnHistoryRef.current.length + 1,
        player1Move: comparison.player1Move,
        player1Accuracy: comparison.player1Accuracy,
        player2Move: comparison.player2Move,
        player2Accuracy: comparison.player2Accuracy,
        isSync: comparison.isSync,
        winnerId: comparison.winnerId
      })
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
  }, [game, stopTimer])

  const executeBotMove = useCallback(async () => {
    if (opponentInProgressRef.current) {
      console.log(`[OPPONENT] Already in progress, skipping`)
      return
    }
    
    const g = gameRef.current
    
    if (g.status === GameStatus.GAME_OVER) {
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
  }, [bot])

  const executeMove = useCallback(async (uciMove: string, promotion?: PromotionPiece) => {
    if (opponentInProgressRef.current) {
      console.log(`[HUMAN] BLOCKED - Opponent thinking, ignoring move`)
      return
    }
    
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
  }, [executeBotMove, teammateBot, startTimer, checkAndResolve])

  useEffect(() => {
    if (game.status.valueOf() === GameStatus.WAITING.valueOf()) {
      game.addPlayer('player1', Team.WHITE)
      game.addPlayer('player2', Team.WHITE)
      game.addPlayer('player3', Team.BLACK)
      game.addPlayer('player4', Team.BLACK)
      game.start()
      console.log(`[GAME] STARTED: ${botConfig.opponentSkillLevel ? `level=${botConfig.opponentSkillLevel}` : 'default'} → WHITE to move`)
      updateStateRef.current()
    }
  }, [game])

  useEffect(() => {
    if (game.status === GameStatus.GAME_OVER) {
      const stats = game.getStats()
      const resultText = game.getResult()
      console.log(`\n══════════════════════════════════════════`)
      console.log(`[GAME] OVER: ${resultText}`)
      console.log(`[GAME] Stats: moves=${stats.whiteMovesPlayed} sync=${Math.round(stats.whiteSyncRate * 100)}% conflicts=${stats.whiteConflicts}`)
      console.log(`[GAME] Accuracy: P1=${Math.round(stats.player1Accuracy)}% P2=${Math.round(stats.player2Accuracy)}%`)
      console.log(`[GAME] Redirecting to /results...`)
      console.log(`══════════════════════════════════════════\n`)
      const summary: GameSummary = {
        result: 'win',
        resultText,
        team: 'WHITE',
        difficulty: level ?? 4,
        stats,
        categoryBreakdown: {
          player1: { great: 70, good: 20, inaccuracy: 5, mistake: 3, blunder: 2 },
          player2: { great: 55, good: 25, inaccuracy: 10, mistake: 7, blunder: 3 },
        },
        turnHistory: turnHistoryRef.current,
      }
      setGameResult(summary)
      router.push('/results')
    }
  }, [game, gameState.status, level, router])

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
      gameRef.current.startPendingTurn()
      updateStateRef.current()
      startTimer()
    }
  }, [executeBotMove, startTimer])

  const stats = game.getStats()

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

      <main className="flex-1 flex pt-16 pb-10">
        <PlayerPanel
          team={Team.WHITE}
          capturedPieces={gameState.capturedByWhite}
          accuracy={stats.player1Accuracy}
          isActive={gameState.currentTurn === Team.WHITE && gameState.status === GameStatus.PLAYING}
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
            </div>
          </div>
        </section>

        <ComparisonPanel
          comparison={gameState.moveComparison}
          isVisible={gameState.showResolution && !!gameState.moveComparison}
          onAnimationComplete={handleResolutionComplete}
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
