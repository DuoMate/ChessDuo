'use client'

import { useEffect, useRef, useState } from 'react'
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

const SQUARE_SIZE = 12.5

function getSquarePosition(square: string, orientation: 'white' | 'black'): { left: string; top: string } {
  const file = square.charCodeAt(0) - 97
  const rank = parseInt(square[1]) - 1
  
  let left: number, top: number
  
  if (orientation === 'white') {
    left = file * SQUARE_SIZE
    top = (8 - rank) * SQUARE_SIZE
  } else {
    left = (7 - file) * SQUARE_SIZE
    top = rank * SQUARE_SIZE
  }
  
  return { left: `${left}%`, top: `${top}%` }
}

export function ChessBoard({ fen, onMove, enabled = true, orientation = 'white', lastMove }: ChessBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Chessboard | null>(null)
  const onMoveRef = useRef(onMove)
  const fenRef = useRef(fen)
  const [markers, setMarkers] = useState<{ from: string; to: string } | null>(null)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    fenRef.current = fen
  }, [fen])

  useEffect(() => {
    if (lastMove) {
      setMarkers(lastMove)
    }
  }, [lastMove])

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

  const currentOrientation = orientation === 'white' ? 'white' : 'black'

  return (
    <div className="relative w-full pt-[100%]">
      <div
        ref={containerRef}
        className="absolute inset-0"
      />
      {markers && (
        <>
          <div
            className="absolute w-[12.5%] h-[12.5%] rounded-full pointer-events-none"
            style={{
              ...getSquarePosition(markers.from, currentOrientation),
              background: 'rgba(255, 215, 0, 0.4)',
              transform: 'translate(0%, 0%)'
            }}
          />
          <div
            className="absolute w-[12.5%] h-[12.5%] rounded-full pointer-events-none"
            style={{
              ...getSquarePosition(markers.to, currentOrientation),
              background: 'rgba(255, 215, 0, 0.4)',
              transform: 'translate(0%, 0%)'
            }}
          />
        </>
      )}
    </div>
  )
}
