'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChessBoard, PromotionPiece } from './ChessBoard'
import { LocalGame, GameStatus, MoveComparison } from '@/lib/localGame'
import { Team } from '@/lib/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/lib/chessBot'
import { createBotConfig, getBotConfig } from '@/lib/botConfig'

interface GameProps {
  level?: number
}

function uciToSan(uciMove: string, fen: string, promotion?: PromotionPiece): string {
  const [from, to] = uciMove.split('-')
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  
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
    moveComparison: null
  })

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
        moveComparison: comparison
      }
      return newState
    })
  }, [game])

  const updateStateRef = useRef(updateState)
  useEffect(() => {
    updateStateRef.current = updateState
  }, [updateState])

  const executeBotMove = useCallback(async () => {
    if (game.status === GameStatus.GAME_OVER) {
      console.log(`[OPPONENT] Game is over, not making move`)
      return
    }
    
    const currentFen = game.board.fen()
    const currentTurn = game.currentTurn
    
    console.log(`\n[OPPONENT] Bot thinking... (current turn: ${currentTurn})`)
    
    const botUciMove = await bot.selectMoveAsync(currentFen)
    
    if (!botUciMove) {
      console.warn('[OPPONENT] Bot could not find a move')
      return
    }
    
    const sanMove = uciToSan(botUciMove, currentFen)
    console.log(`[OPPONENT] Selected move: ${sanMove}`)
    
    game.selectMove('player3', sanMove)
    game.selectMove('player4', sanMove)
    
    await game.lockAndResolve(true)
    updateStateRef.current()
    
    console.log(`[DEBUG] After opponent turn, currentTurn: ${game.currentTurn}`)
  }, [game, bot])

  const executeMove = useCallback(async (uciMove: string, promotion?: PromotionPiece) => {
    const currentTurn = game.currentTurn
    
    console.log(`\n[HUMAN] Attempting move: ${uciMove} (current turn: ${currentTurn})`)
    
    if (currentTurn !== Team.WHITE) {
      console.warn(`[HUMAN] BLOCKED - Not WHITE's turn! Current: ${currentTurn}`)
      return
    }
    
    console.log(`[HUMAN] Turn confirmed as WHITE - processing move...`)
    
    try {
      const sanMove = uciToSan(uciMove, game.board.fen(), promotion)
      
      console.log(`[HUMAN] Proposing move: ${sanMove}`)
      game.selectMove('player1', sanMove)
      
      console.log(`[TEAMMATE] Bot is thinking...`)
      const teammateMove = await teammateBot.selectMoveAsync(game.board.fen())
      if (teammateMove) {
        const teammateSanMove = uciToSan(teammateMove, game.board.fen(), promotion)
        console.log(`[TEAMMATE] Selected move: ${teammateSanMove}`)
        game.selectMove('player2', teammateSanMove)
      }
      
      console.log(`[LOCK] Resolving moves...`)
      await game.lockAndResolve()
      updateStateRef.current()
      
      const newTurn = game.currentTurn
      console.log(`[DEBUG] After lockAndResolve, newTurn: ${newTurn}`)
      
      if (game.status !== GameStatus.GAME_OVER && newTurn === Team.BLACK) {
        setGameState(prev => ({ ...prev, isBotThinking: true }))
        
        await executeBotMove()
        
        setGameState(prev => ({ ...prev, isBotThinking: false }))
      }
    } catch (e) {
      console.warn('[HUMAN] Invalid move:', uciMove, e)
    }
  }, [game, executeBotMove, teammateBot])

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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {gameState.pendingPromotion && (
        <PromotionModal onSelect={handlePromotionSelect} />
      )}
      
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">ClashMate</h1>
        
        <div className="flex justify-between items-center mb-4">
          <div className={`px-4 py-2 rounded ${gameState.currentTurn === Team.WHITE ? 'bg-white text-gray-900' : 'bg-gray-700'}`}>
            White Team (You)
          </div>
          <div className="text-xl font-mono">
            {gameState.status === GameStatus.GAME_OVER ? 'Game Over!' : 
             gameState.isBotThinking ? 'Bot thinking...' :
             gameState.status === GameStatus.PLAYING ? 'Playing...' : 'Waiting...'}
          </div>
          <div className={`px-4 py-2 rounded ${gameState.currentTurn === Team.BLACK ? 'bg-white text-gray-900' : 'bg-gray-700'}`}>
            Black Team (Bot)
          </div>
        </div>

        <div className="flex items-start justify-center gap-4 mb-4">
          <CapturedPiecesDisplay pieces={gameState.capturedByWhite} label="White captured" />
          
          <div className="w-[500px] h-[500px] flex-shrink-0">
            <ChessBoard 
              fen={gameState.fen}
              onMove={handleMove}
              enabled={gameState.status === GameStatus.PLAYING && gameState.currentTurn === Team.WHITE && !gameState.isBotThinking && !gameState.pendingPromotion}
              orientation="white"
              lastMove={gameState.lastMove}
            />
          </div>
          
          <CapturedPiecesDisplay pieces={gameState.capturedByBlack} label="Black captured" />
        </div>

        <div className="mt-4 text-center">
          {gameState.selectedMove && (
            <p className="text-green-400">Selected: {gameState.selectedMove}</p>
          )}
          {gameState.status === GameStatus.GAME_OVER && (
            <p className="text-xl font-bold text-yellow-400">{game.getResult()}</p>
          )}
          {gameState.isBotThinking && (
            <p className="text-blue-400">Bot is making a move...</p>
          )}
        </div>

        {gameState.moveComparison && (

          <div className="mt-4 p-4 bg-gray-800 rounded border border-gray-600">
            <h3 className="font-bold mb-3 text-center text-lg">Last Move Analysis</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 rounded ${!gameState.moveComparison.isSync && gameState.moveComparison.player1Accuracy >= gameState.moveComparison.player2Accuracy ? 'bg-green-900/50 border border-green-500' : 'bg-blue-900/30 border border-blue-700'}`}>
                <div className="text-sm mb-1">
                  <span className="text-blue-400 font-bold">● Player 1 (You)</span>
                </div>
                <div className="text-2xl font-bold text-blue-300">{gameState.moveComparison.player1Move}</div>
                <div className="text-sm">
                  Centipawn Loss: <span className="text-yellow-400 font-bold">{gameState.moveComparison.player1Loss === Infinity ? 'N/A' : Math.round(gameState.moveComparison.player1Loss)}</span>
                </div>
                <div className="text-lg font-bold">
                  Accuracy: {Math.round(gameState.moveComparison.player1Accuracy)}%
                </div>
                {!gameState.moveComparison.isSync && gameState.moveComparison.player1Accuracy >= gameState.moveComparison.player2Accuracy && (
                  <div className="text-xs text-green-400 mt-1">✓ Winner</div>
                )}
              </div>
              <div className={`p-3 rounded ${!gameState.moveComparison.isSync && gameState.moveComparison.player2Accuracy >= gameState.moveComparison.player1Accuracy ? 'bg-green-900/50 border border-green-500' : 'bg-green-900/30 border border-green-700'}`}>
                <div className="text-sm mb-1">
                  <span className="text-green-400 font-bold">● Player 2 (Teammate)</span>
                </div>
                <div className="text-2xl font-bold text-green-300">{gameState.moveComparison.player2Move}</div>
                <div className="text-sm">
                  Centipawn Loss: <span className="text-yellow-400 font-bold">{gameState.moveComparison.player2Loss === Infinity ? 'N/A' : Math.round(gameState.moveComparison.player2Loss)}</span>
                </div>
                <div className="text-lg font-bold">
                  Accuracy: {Math.round(gameState.moveComparison.player2Accuracy)}%
                </div>
                {!gameState.moveComparison.isSync && gameState.moveComparison.player2Accuracy >= gameState.moveComparison.player1Accuracy && (
                  <div className="text-xs text-green-400 mt-1">✓ Winner</div>
                )}
              </div>
            </div>
            <div className="mt-3 p-2 bg-blue-900/40 rounded text-center">
              {gameState.moveComparison.isSync ? (
                <span className="text-green-400 font-bold">Synchronized! Both chose the same move.</span>
              ) : (
                <span>
                  <span className="text-white font-bold">{gameState.moveComparison.winningMove}</span>
                  <span className="text-gray-400"> was chosen (lower centipawn loss = better)</span>
                </span>
              )}
            </div>
            {gameState.moveComparison.bestEngineMove && gameState.moveComparison.bestEngineMove !== gameState.moveComparison.winningMove && (
              <div className="mt-2 text-center text-sm text-gray-500">
                Engine&apos;s best: {gameState.moveComparison.bestEngineMove} (your centipawn loss vs engine: {Math.round(gameState.moveComparison.bestEngineScore - gameState.moveComparison.winningScore)})
              </div>
            )}
          </div>
        )}

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
