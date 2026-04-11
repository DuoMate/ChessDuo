'use client'

import { useEffect, useRef, useState } from 'react'
import { Chessboard, COLOR, INPUT_EVENT_TYPE, InputEvent } from 'cm-chessboard'
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers'
import { Chess } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

export interface PendingPromotion {
  from: string
  to: string
}

export interface PendingOverlay {
  from: string
  to: string
  piece: string
  color: 'white' | 'black'
}

export interface HighlightSquares {
  winnerFrom?: string
  winnerTo?: string
  loserFrom?: string
  loserTo?: string
}

interface ChessBoardProps {
  fen: string
  onMove: (move: string, promotion?: PromotionPiece) => void
  enabled?: boolean
  orientation?: 'white' | 'black'
  lastMove?: { from: string; to: string } | null
  pendingOverlay?: PendingOverlay | null
  highlightSquares?: HighlightSquares | null
  onAnimationComplete?: () => void
}

const PIECE_CHARS: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
}

export function ChessBoard({ 
  fen, 
  onMove, 
  enabled = true, 
  orientation = 'white', 
  lastMove,
  pendingOverlay,
  highlightSquares,
  onAnimationComplete
}: ChessBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayContainerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Chessboard | null>(null)
  const onMoveRef = useRef(onMove)
  const fenRef = useRef(fen)
  const lastMoveRef = useRef(lastMove)
  const [showRetraction, setShowRetraction] = useState(false)
  const [retractionData, setRetractionData] = useState<{ from: string; to: string; piece: string; color: string } | null>(null)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    fenRef.current = fen
  }, [fen])

  useEffect(() => {
    lastMoveRef.current = lastMove
  }, [lastMove])

  useEffect(() => {
    if (!containerRef.current) return

    boardRef.current = new Chessboard(containerRef.current, {
      position: fen,
      orientation: orientation === 'white' ? COLOR.white : COLOR.black,
      assetsUrl: '/cm-chessboard/',
      extensions: [{ class: Markers }]
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
    if (boardRef.current) {
      boardRef.current.setOrientation(orientation === 'white' ? COLOR.white : COLOR.black)
    }
  }, [orientation])

  useEffect(() => {
    if (!boardRef.current) return

    boardRef.current.removeMarkers()

    if (highlightSquares) {
      if (highlightSquares.winnerFrom && highlightSquares.winnerTo) {
        boardRef.current.addMarker(MARKER_TYPE.frame, highlightSquares.winnerFrom)
        boardRef.current.addMarker(MARKER_TYPE.frame, highlightSquares.winnerTo)
      }
      if (highlightSquares.loserFrom && highlightSquares.loserTo) {
        boardRef.current.addMarker(MARKER_TYPE.square, highlightSquares.loserFrom)
        boardRef.current.addMarker(MARKER_TYPE.square, highlightSquares.loserTo)
      }
    } else if (lastMove) {
      boardRef.current.addMarker(MARKER_TYPE.dot, lastMove.from)
      boardRef.current.addMarker(MARKER_TYPE.dot, lastMove.to)
    }
  }, [lastMove, highlightSquares])

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

  const getSquarePosition = (square: string): { x: number; y: number } => {
    if (!overlayContainerRef.current) return { x: 0, y: 0 }
    
    const container = overlayContainerRef.current
    const rect = container.getBoundingClientRect()
    const squareSize = rect.width / 8
    
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
    const rank = parseInt(square[1]) - 1
    
    const isFlipped = orientation === 'black'
    const x = isFlipped ? (7 - file) * squareSize : file * squareSize
    const y = isFlipped ? rank * squareSize : (7 - rank) * squareSize
    
    return { x, y }
  }

  const getPieceChar = (piece: string, color: 'white' | 'black'): string => {
    const key = color === 'white' ? piece.toUpperCase() : piece.toLowerCase()
    return PIECE_CHARS[key] || piece
  }

  useEffect(() => {
    if (highlightSquares?.loserFrom && highlightSquares?.loserTo && pendingOverlay) {
      setRetractionData({
        from: highlightSquares.loserFrom,
        to: highlightSquares.loserTo,
        piece: pendingOverlay.piece,
        color: pendingOverlay.color
      })
      setShowRetraction(true)
    }
  }, [highlightSquares, pendingOverlay])

  const handleRetractionComplete = () => {
    setShowRetraction(false)
    setRetractionData(null)
    onAnimationComplete?.()
  }

  return (
    <div className="relative w-full pt-[100%]">
      <div
        ref={containerRef}
        className="absolute inset-0"
      />
      
      <div
        ref={overlayContainerRef}
        className="absolute inset-0 pointer-events-none"
      >
        <AnimatePresence>
          {pendingOverlay && !showRetraction && (
            <motion.div
              key={`pending-${pendingOverlay.from}-${pendingOverlay.to}`}
              initial={{ 
                x: getSquarePosition(pendingOverlay.from).x,
                y: getSquarePosition(pendingOverlay.from).y,
                opacity: 0
              }}
              animate={{ 
                x: getSquarePosition(pendingOverlay.to).x,
                y: getSquarePosition(pendingOverlay.to).y,
                opacity: 0.4
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute flex items-center justify-center text-4xl md:text-5xl lg:text-6xl font-bold select-none"
              style={{ 
                width: '12.5%', 
                height: '12.5%',
                color: pendingOverlay.color === 'white' ? '#fff' : '#000',
                textShadow: pendingOverlay.color === 'white' 
                  ? '0 0 3px #000, 0 0 3px #000' 
                  : '0 0 3px #fff, 0 0 3px #fff'
              }}
            >
              {getPieceChar(pendingOverlay.piece, pendingOverlay.color)}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRetraction && retractionData && (
            <motion.div
              key={`retraction-${retractionData.from}-${retractionData.to}`}
              initial={{ 
                x: getSquarePosition(retractionData.to).x,
                y: getSquarePosition(retractionData.to).y,
                opacity: 0.6,
                backgroundColor: 'rgba(255, 0, 0, 0.3)'
              }}
              animate={{ 
                x: getSquarePosition(retractionData.from).x,
                y: getSquarePosition(retractionData.from).y,
                opacity: 0
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeIn" }}
              className="absolute flex items-center justify-center text-4xl md:text-5xl lg:text-6xl font-bold select-none"
              style={{ 
                width: '12.5%', 
                height: '12.5%',
                borderRadius: '0'
              }}
              onAnimationComplete={handleRetractionComplete}
            >
              <span 
                className="opacity-50"
                style={{ 
                  color: retractionData.color === 'white' ? '#fff' : '#000',
                  textShadow: retractionData.color === 'white' 
                    ? '0 0 3px #000' 
                    : '0 0 3px #fff'
                }}
              >
                {getPieceChar(retractionData.piece, retractionData.color as 'white' | 'black')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {highlightSquares?.winnerFrom && highlightSquares?.winnerTo && !showRetraction && (
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute border-4 border-green-500 rounded-lg"
            style={{
              width: '12.5%',
              height: '12.5%',
              left: `${(getSquarePosition(highlightSquares.winnerTo).x / (overlayContainerRef.current?.getBoundingClientRect().width || 1)) * 100}%`,
              top: `${(getSquarePosition(highlightSquares.winnerTo).y / (overlayContainerRef.current?.getBoundingClientRect().height || 1)) * 100}%`,
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)'
            }}
          />
        </div>
      )}
    </div>
  )
}