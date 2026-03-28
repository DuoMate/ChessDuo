'use client'

import { useEffect, useRef } from 'react'
import { Chessboard, COLOR, INPUT_EVENT_TYPE, InputEvent } from 'cm-chessboard'
import { Chess } from 'chess.js'

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

export interface PendingPromotion {
  from: string
  to: string
}

interface ChessBoardProps {
  fen: string
  onMove: (move: string, promotion?: PromotionPiece) => void
  enabled?: boolean
  orientation?: 'white' | 'black'
  lastMove?: { from: string; to: string } | null
}

export function ChessBoard({ fen, onMove, enabled = true, orientation = 'white', lastMove }: ChessBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Chessboard | null>(null)
  const onMoveRef = useRef(onMove)
  const fenRef = useRef(fen)
  const prevLastMoveRef = useRef<string | null>(null)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    fenRef.current = fen
  }, [fen])

  useEffect(() => {
    if (!containerRef.current) return

    boardRef.current = new Chessboard(containerRef.current, {
      position: fen,
      orientation: orientation === 'white' ? COLOR.white : COLOR.black,
      assetsUrl: '/cm-chessboard/'
    })

    return () => {
      boardRef.current?.destroy()
      boardRef.current = null
    }
  }, [])

  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.setPosition(fen, true)
    }
  }, [fen])

  useEffect(() => {
    if (!boardRef.current) return
    
    const currentMoveKey = lastMove ? `${lastMove.from}-${lastMove.to}` : null
    
    if (prevLastMoveRef.current !== currentMoveKey) {
      prevLastMoveRef.current = currentMoveKey
      
      if (boardRef.current) {
        const markersContainer = document.getElementById('chessboard-markers')
        if (markersContainer) {
          markersContainer.innerHTML = ''
          
          if (lastMove) {
            const { from, to } = lastMove
            
            const createMarker = (square: string) => {
              const marker = document.createElement('div')
              marker.className = 'move-marker'
              marker.dataset.square = square
              markersContainer.appendChild(marker)
            }
            
            createMarker(from)
            createMarker(to)
          }
        }
      }
    }
  }, [lastMove, fen])

  const checkPromotion = (from: string, to: string): PromotionPiece | null => {
    try {
      const chess = new Chess(fenRef.current)
      const moves = chess.moves({ verbose: true })
      const move = moves.find(m => m.from === from && m.to === to)
      
      if (move && move.promotion) {
        return move.promotion as PromotionPiece
      }
    } catch {
      return null
    }
    return null
  }

  useEffect(() => {
    if (!boardRef.current) return

    boardRef.current.disableMoveInput()

    if (enabled) {
      const handleMoveInput = (event: InputEvent): boolean => {
        if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
          return true
        }

        if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
          const { squareFrom, squareTo } = event
          if (!squareFrom || !squareTo) {
            return false
          }

          try {
            const chess = new Chess(fenRef.current)
            const moves = chess.moves({ verbose: true })
            const validMove = moves.find(m => m.from === squareFrom && m.to === squareTo)

            if (validMove) {
              return true
            }
          } catch {
            console.warn('Error validating move')
          }
          return false
        }

        if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
          const { squareFrom, squareTo } = event
          if (squareFrom && squareTo) {
            try {
              const chess = new Chess(fenRef.current)
              const moves = chess.moves({ verbose: true })
              const validMove = moves.find(m => m.from === squareFrom && m.to === squareTo)

              if (validMove) {
                const promotionPiece = checkPromotion(squareFrom, squareTo)
                
                if (promotionPiece) {
                  const move = `${squareFrom}-${squareTo}`
                  onMoveRef.current(move, promotionPiece)
                } else {
                  const move = `${squareFrom}-${squareTo}`
                  onMoveRef.current(move)
                }
                return true
              }
            } catch {
              console.warn('Error processing move')
            }
          }
          return true
        }

        return true
      }

      const color = orientation === 'white' ? COLOR.white : COLOR.black
      boardRef.current.enableMoveInput(handleMoveInput, color)
    }
  }, [enabled, orientation])

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full h-full"
      />
      <style>{`
        .move-marker {
          position: absolute;
          width: 12.5%;
          height: 12.5%;
          background: rgba(255, 215, 0, 0.4);
          border-radius: 50%;
          pointer-events: none;
        }
        .move-marker[data-square="a1"] { left: 87.5%; top: 87.5%; }
        .move-marker[data-square="b1"] { left: 75%; top: 87.5%; }
        .move-marker[data-square="c1"] { left: 62.5%; top: 87.5%; }
        .move-marker[data-square="d1"] { left: 50%; top: 87.5%; }
        .move-marker[data-square="e1"] { left: 37.5%; top: 87.5%; }
        .move-marker[data-square="f1"] { left: 25%; top: 87.5%; }
        .move-marker[data-square="g1"] { left: 12.5%; top: 87.5%; }
        .move-marker[data-square="h1"] { left: 0%; top: 87.5%; }
        .move-marker[data-square="a2"] { left: 87.5%; top: 75%; }
        .move-marker[data-square="b2"] { left: 75%; top: 75%; }
        .move-marker[data-square="c2"] { left: 62.5%; top: 75%; }
        .move-marker[data-square="d2"] { left: 50%; top: 75%; }
        .move-marker[data-square="e2"] { left: 37.5%; top: 75%; }
        .move-marker[data-square="f2"] { left: 25%; top: 75%; }
        .move-marker[data-square="g2"] { left: 12.5%; top: 75%; }
        .move-marker[data-square="h2"] { left: 0%; top: 75%; }
        .move-marker[data-square="a3"] { left: 87.5%; top: 62.5%; }
        .move-marker[data-square="b3"] { left: 75%; top: 62.5%; }
        .move-marker[data-square="c3"] { left: 62.5%; top: 62.5%; }
        .move-marker[data-square="d3"] { left: 50%; top: 62.5%; }
        .move-marker[data-square="e3"] { left: 37.5%; top: 62.5%; }
        .move-marker[data-square="f3"] { left: 25%; top: 62.5%; }
        .move-marker[data-square="g3"] { left: 12.5%; top: 62.5%; }
        .move-marker[data-square="h3"] { left: 0%; top: 62.5%; }
        .move-marker[data-square="a4"] { left: 87.5%; top: 50%; }
        .move-marker[data-square="b4"] { left: 75%; top: 50%; }
        .move-marker[data-square="c4"] { left: 62.5%; top: 50%; }
        .move-marker[data-square="d4"] { left: 50%; top: 50%; }
        .move-marker[data-square="e4"] { left: 37.5%; top: 50%; }
        .move-marker[data-square="f4"] { left: 25%; top: 50%; }
        .move-marker[data-square="g4"] { left: 12.5%; top: 50%; }
        .move-marker[data-square="h4"] { left: 0%; top: 50%; }
        .move-marker[data-square="a5"] { left: 87.5%; top: 37.5%; }
        .move-marker[data-square="b5"] { left: 75%; top: 37.5%; }
        .move-marker[data-square="c5"] { left: 62.5%; top: 37.5%; }
        .move-marker[data-square="d5"] { left: 50%; top: 37.5%; }
        .move-marker[data-square="e5"] { left: 37.5%; top: 37.5%; }
        .move-marker[data-square="f5"] { left: 25%; top: 37.5%; }
        .move-marker[data-square="g5"] { left: 12.5%; top: 37.5%; }
        .move-marker[data-square="h5"] { left: 0%; top: 37.5%; }
        .move-marker[data-square="a6"] { left: 87.5%; top: 25%; }
        .move-marker[data-square="b6"] { left: 75%; top: 25%; }
        .move-marker[data-square="c6"] { left: 62.5%; top: 25%; }
        .move-marker[data-square="d6"] { left: 50%; top: 25%; }
        .move-marker[data-square="e6"] { left: 37.5%; top: 25%; }
        .move-marker[data-square="f6"] { left: 25%; top: 25%; }
        .move-marker[data-square="g6"] { left: 12.5%; top: 25%; }
        .move-marker[data-square="h6"] { left: 0%; top: 25%; }
        .move-marker[data-square="a7"] { left: 87.5%; top: 12.5%; }
        .move-marker[data-square="b7"] { left: 75%; top: 12.5%; }
        .move-marker[data-square="c7"] { left: 62.5%; top: 12.5%; }
        .move-marker[data-square="d7"] { left: 50%; top: 12.5%; }
        .move-marker[data-square="e7"] { left: 37.5%; top: 12.5%; }
        .move-marker[data-square="f7"] { left: 25%; top: 12.5%; }
        .move-marker[data-square="g7"] { left: 12.5%; top: 12.5%; }
        .move-marker[data-square="h7"] { left: 0%; top: 12.5%; }
        .move-marker[data-square="a8"] { left: 87.5%; top: 0%; }
        .move-marker[data-square="b8"] { left: 75%; top: 0%; }
        .move-marker[data-square="c8"] { left: 62.5%; top: 0%; }
        .move-marker[data-square="d8"] { left: 50%; top: 0%; }
        .move-marker[data-square="e8"] { left: 37.5%; top: 0%; }
        .move-marker[data-square="f8"] { left: 25%; top: 0%; }
        .move-marker[data-square="g8"] { left: 12.5%; top: 0%; }
        .move-marker[data-square="h8"] { left: 0%; top: 0%; }
      `}</style>
    </div>
  )
}
