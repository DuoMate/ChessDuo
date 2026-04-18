'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChessBoard, PromotionPiece, PendingOverlay, HighlightSquares } from './ChessBoard'
import { LocalGame, GameStatus, MoveComparison } from '@/lib/localGame'
import { Team } from '@/lib/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/lib/chessBot'
import { createBotConfig, getBotConfig } from '@/lib/botConfig'
import { TeamTimer } from './TeamTimer'
import { MoveComparisonPanel } from './MoveComparison'
import { AnalyzingIndicator } from './AnalyzingIndicator'
import { motion, AnimatePresence } from 'framer-motion'

interface GameProps {
  level?: number
}

function uciToSan(uciMove: string, fen: string, promotion?: PromotionPiece): string {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  
  const from = uciMove.substring(0, 2)
  const to = uciMove.substring(2, 4)
  
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
  const from = uciMove.substring(0, 2)
  const to = uciMove.substring(2, 4)
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

export function Game({ level }: GameProps) {
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

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gameRef = useRef(game)
  const opponentInProgressRef = useRef(false)
  const pendingOpponentTurnRef = useRef(false)
  
  useEffect(() => {
    gameRef.current = game
  }, [game])

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
      
      const sanMove = uciToSan(uciMove, g.board.fen(), promotion)
      const moveInfo = getMoveFromUci(uciMove, g.board.fen())
      
      if (moveInfo) {
        g.setPendingMove('player1', sanMove, moveInfo.from, moveInfo.to, moveInfo.piece)
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
      
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const resolved = await checkAndResolve()
      
      if (!resolved) {
        return
      }
      
      const newTurn = g.currentTurn
      pendingOpponentTurnRef.current = (g.status !== GameStatus.GAME_OVER && newTurn === Team.BLACK)
      
      if (!pendingOpponentTurnRef.current) {
        console.log(`[HUMAN] Turn time: ${Date.now() - startTime}ms`)
        g.startPendingTurn()
        startTimer()
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
      updateStateRef.current()
    }
  }, [game])

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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {gameState.pendingPromotion && (
        <PromotionModal onSelect={handlePromotionSelect} />
      )}
       
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">ClashMate</h1>
        
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
          <div className="w-48 flex flex-col items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <TeamTimer 
                seconds={gameState.timerSeconds}
                isActive={gameState.timerActive}
                currentTeam={gameState.currentTurn}
              />
            </div>
            <CapturedPiecesDisplay pieces={gameState.capturedByWhite} label="White captured" />
          </div>
          
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
          
          <div className="w-64 flex flex-col items-center gap-4">
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

        <AnimatePresence>
        {gameState.status === GameStatus.GAME_OVER && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 p-6 bg-gray-800/90 backdrop-blur rounded-xl border-2 border-yellow-500 text-center"
          >
            <motion.h2 
              className="text-2xl font-bold text-yellow-400 mb-2"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              Game Over!
            </motion.h2>
            <p className="text-lg font-medium text-white mb-4">{game.getResult()}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-gray-400 text-xs">Total Moves</div>
                <div className="text-xl font-bold text-white">{game.getStats().movesPlayed}</div>
              </div>
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-gray-400 text-xs">Sync Rate</div>
                <div className="text-xl font-bold text-green-400">{Math.round(game.getStats().syncRate * 100)}%</div>
              </div>
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-gray-400 text-xs">Your Accuracy</div>
                <div className="text-xl font-bold text-blue-400">{Math.round(game.getStats().player1Accuracy)}%</div>
              </div>
              <div className="bg-gray-700/50 p-3 rounded-lg">
                <div className="text-gray-400 text-xs">Conflicts</div>
                <div className="text-xl font-bold text-red-400">{game.getStats().conflicts}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        <div className="mt-4 text-center">
          {gameState.selectedMove && (
            <p className="text-green-400">Selected: {gameState.selectedMove}</p>
          )}
          {gameState.isBotThinking && (
            <p className="text-blue-400">Bot is making a move...</p>
          )}
        </div>

        <div className="mt-8 p-4 bg-gray-800 rounded">
          <h2 className="font-bold mb-2">Your Team Stats (White)</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>White Moves: {game.getStats().whiteMovesPlayed}</div>
            <div>Sync Rate: {Math.round(game.getStats().whiteSyncRate * 100)}%</div>
            <div>Conflicts: {game.getStats().whiteConflicts}</div>
            <div>Player 1 Avg Accuracy: {Math.round(game.getStats().player1Accuracy)}%</div>
            <div>Player 2 Avg Accuracy: {Math.round(game.getStats().player2Accuracy)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}