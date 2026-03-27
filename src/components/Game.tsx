'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChessBoard } from './ChessBoard'
import { LocalGame, GameStatus } from '@/lib/localGame'
import { Team } from '@/lib/gameState'

interface GameState {
  status: GameStatus
  fen: string
  currentTurn: Team
  selectedMove: string | null
  isMyTurn: boolean
  phase: string
}

export function Game() {
  const [game] = useState(() => new LocalGame())
  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.WAITING,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    currentTurn: Team.WHITE,
    selectedMove: null,
    isMyTurn: true,
    phase: 'waiting'
  })

  useEffect(() => {
    game.addPlayer('player1', Team.WHITE)
    game.addPlayer('player2', Team.WHITE)
    game.addPlayer('player3', Team.BLACK)
    game.addPlayer('player4', Team.BLACK)
    game.start()

    updateState()
  }, [game])

  const updateState = useCallback(() => {
    setGameState({
      status: game.status,
      fen: game.board.fen(),
      currentTurn: game.currentTurn,
      selectedMove: game.getSelectedMove('player1'),
      isMyTurn: true,
      phase: game.status === GameStatus.PLAYING ? 'selecting' : 'waiting'
    })
  }, [game])

  const handleMove = useCallback(async (uciMove: string) => {
    // Convert UCI format (e2-e4) to SAN (e4)
    const sanMove = uciMove.split('-')[1]
    
    game.selectMove('player1', sanMove)
    game.selectMove('player2', sanMove) // Simulate teammate picking same move
    
    await game.lockAndResolve()
    updateState()
  }, [game, updateState])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">ClashMate</h1>
        
        <div className="flex justify-between items-center mb-4">
          <div className={`px-4 py-2 rounded ${gameState.currentTurn === Team.WHITE ? 'bg-white text-gray-900' : 'bg-gray-700'}`}>
            White Team
          </div>
          <div className="text-xl font-mono">
            {gameState.status === GameStatus.GAME_OVER ? 'Game Over!' : 
             gameState.status === GameStatus.PLAYING ? 'Playing...' : 'Waiting...'}
          </div>
          <div className={`px-4 py-2 rounded ${gameState.currentTurn === Team.BLACK ? 'bg-white text-gray-900' : 'bg-gray-700'}`}>
            Black Team
          </div>
        </div>

        <ChessBoard 
          fen={gameState.fen}
          onMove={handleMove}
          enabled={gameState.status === GameStatus.PLAYING}
          orientation={gameState.currentTurn === Team.WHITE ? 'white' : 'black'}
        />

        <div className="mt-4 text-center">
          {gameState.selectedMove && (
            <p className="text-green-400">Selected: {gameState.selectedMove}</p>
          )}
          {gameState.status === GameStatus.GAME_OVER && (
            <p className="text-xl font-bold text-yellow-400">{game.getResult()}</p>
          )}
        </div>

        <div className="mt-8 p-4 bg-gray-800 rounded">
          <h2 className="font-bold mb-2">Stats</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Moves: {game.getStats().movesPlayed}</div>
            <div>Sync Rate: {Math.round(game.getStats().syncRate * 100)}%</div>
            <div>Conflicts: {game.getStats().conflicts}</div>
            <div>Accuracy: {Math.round(game.getStats().averageAccuracy)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
