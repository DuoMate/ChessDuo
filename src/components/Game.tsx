'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChessBoard, PromotionPiece } from './ChessBoard'
import { LocalGame, GameStatus } from '@/lib/localGame'
import { Team } from '@/lib/gameState'
import { Chess } from 'chess.js'
import { createBot } from '@/lib/chessBot'

function uciToSan(uciMove: string, fen: string, promotion?: PromotionPiece): string | null {
  try {
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
  } catch (e) {
    console.warn('Error converting UCI to SAN:', e)
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
  totalMoves: number
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

export function Game() {
  const [game] = useState(() => new LocalGame())
  const [bot] = useState(() => createBot({ skillLevel: 3 }))
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
    totalMoves: 0
  })

  const updateState = useCallback(() => {
    const captured = game.getCapturedPieces()
    const stats = game.getStats()
    setGameState(prev => ({
      ...prev,
      status: game.status,
      fen: game.board.fen(),
      currentTurn: game.currentTurn,
      selectedMove: game.getSelectedMove('player1'),
      phase: game.status === GameStatus.PLAYING ? 'selecting' : 'waiting',
      capturedByWhite: captured.white,
      capturedByBlack: captured.black,
      isMyTurn: game.currentTurn === Team.WHITE && game.status === GameStatus.PLAYING,
      lastMove: game.lastMove,
      moveAccuracy: stats.lastMoveAccuracy,
      totalMoves: stats.movesPlayed
    }))
  }, [game])

  const updateStateRef = useRef(updateState)
  useEffect(() => {
    updateStateRef.current = updateState
  }, [updateState])

  const executeBotMove = useCallback(async () => {
    if (game.status === GameStatus.GAME_OVER) return
    
    const currentFen = game.board.fen()
    const botUciMove = bot.selectMove(currentFen)
    
    if (!botUciMove) {
      console.warn('Bot could not find a move')
      return
    }
    
    const sanMove = uciToSan(botUciMove, currentFen)
    if (!sanMove) {
      console.warn('Bot move UCI to SAN conversion failed')
      return
    }
    
    game.selectMove('player3', sanMove)
    game.selectMove('player4', sanMove)
    
    await game.lockAndResolve(true)
    updateStateRef.current()
  }, [game, bot])

  const executeMove = useCallback(async (uciMove: string, promotion?: PromotionPiece) => {
    try {
      const sanMove = uciToSan(uciMove, game.board.fen(), promotion)
      if (!sanMove) {
        return
      }
      
      game.selectMove('player1', sanMove)
      game.selectMove('player2', sanMove)
      
      await game.lockAndResolve()
      updateStateRef.current()
      
      if (game.status !== GameStatus.GAME_OVER && game.currentTurn === Team.BLACK) {
        setGameState(prev => ({ ...prev, isBotThinking: true }))
        
        await new Promise(resolve => setTimeout(resolve, 500))
        
        await executeBotMove()
        
        setGameState(prev => ({ ...prev, isBotThinking: false }))
      }
    } catch (e) {
      console.warn('Invalid move:', uciMove, e)
    }
  }, [game, executeBotMove])

  useEffect(() => {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()

    updateStateRef.current()
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
              orientation={gameState.currentTurn === Team.WHITE ? 'white' : 'black'}
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

        <div className="mt-8 p-4 bg-gray-800 rounded">
          <h2 className="font-bold mb-2">Stats</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Moves: {game.getStats().movesPlayed}</div>
            <div>Sync Rate: {Math.round(game.getStats().syncRate * 100)}%</div>
            <div>Conflicts: {game.getStats().conflicts}</div>
            <div>Overall Accuracy: {Math.round(game.getStats().averageAccuracy)}%</div>
            {gameState.moveAccuracy < 100 && (
              <div className="col-span-2 text-yellow-400">Last Move Accuracy: {gameState.moveAccuracy}%</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
