'use client'

import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { Chessboard, COLOR, INPUT_EVENT_TYPE, InputEvent } from 'cm-chessboard'
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers'
import { Chess, Square } from 'chess.js'
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
  showTeammateLabel?: boolean
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
  myPendingOverlay?: PendingOverlay | null
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
  myPendingOverlay,
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
  const [teammateLabelVisible, setTeammateLabelVisible] = useState(false)
  const [overlayWidth, setOverlayWidth] = useState(0)

  useLayoutEffect(() => {
    if (overlayContainerRef.current) {
      setOverlayWidth(overlayContainerRef.current.getBoundingClientRect().width)
    }
  }, [])
 
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
      boardRef.current.setPosition(fen, false)
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
        boardRef.current.addMarker(MARKER_TYPE.framePrimary, highlightSquares.loserFrom)
        boardRef.current.addMarker(MARKER_TYPE.framePrimary, highlightSquares.loserTo)
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
          const { squareFrom } = event
          boardRef.current?.removeMarkers(MARKER_TYPE.dot)

          if (squareFrom) {
            try {
              const chess = new Chess(fenRef.current)
              const piece = chess.get(squareFrom as Square)
              if (piece) {
                const moves = chess.moves({ square: squareFrom as Square, verbose: true })
                for (const move of moves) {
                  boardRef.current?.addMarker(MARKER_TYPE.dot, move.to)
                }
              }
            } catch {
              // ignore — marker dots are cosmetic only
            }
          }

          return true
        }

        if (event.type === INPUT_EVENT_TYPE.moveInputCanceled) {
          boardRef.current?.removeMarkers(MARKER_TYPE.dot)
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
          boardRef.current?.removeMarkers(MARKER_TYPE.dot)

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

  const getSquarePercent = (square: string, orientation: string): { left: string; top: string } => {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
    const rank = 8 - parseInt(square[1])
    const isFlipped = orientation === 'black'
    const l = `${(isFlipped ? (7 - file) : file) * 12.5}%`
    const t = `${(isFlipped ? (7 - rank) : rank) * 12.5}%`
    return { left: l, top: t }
  }

  const getSquarePosition = (square: string): { x: number; y: number } => {
    if (overlayWidth <= 0) return { x: 0, y: 0 }
    
    const squareSize = overlayWidth / 8
    
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

  useEffect(() => {
    if (pendingOverlay?.showTeammateLabel) {
      setTeammateLabelVisible(true)
    } else {
      setTeammateLabelVisible(false)
    }
  }, [pendingOverlay])

  const handleRetractionComplete = () => {
    setShowRetraction(false)
    setRetractionData(null)
    onAnimationComplete?.()
  }

  return (
    <div className="relative w-full pt-[100%]">
      <div className="absolute inset-0 rounded-[24px] border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/70" />
      <div
        ref={containerRef}
        className="absolute inset-1 overflow-hidden rounded-[22px]"
      />
      
      <div
        ref={overlayContainerRef}
        className="absolute inset-0 pointer-events-none"
      >
        {overlayWidth > 0 && (
          <>
        {pendingOverlay && !showRetraction && (() => {
          const toPos = getSquarePercent(pendingOverlay.to, orientation)
          return (
          <motion.div
            key={`pending-${pendingOverlay.from}-${pendingOverlay.to}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute flex items-center justify-center font-bold select-none"
            style={{ 
              left: toPos.left,
              top: toPos.top,
              width: '12.5%', 
              height: '12.5%',
              color: pendingOverlay.color === 'white' ? '#fff' : '#000',
              textShadow: pendingOverlay.color === 'white' 
                ? '0 0 2px #000' 
                : '0 0 2px #fff',
              filter: 'drop-shadow(0 0 6px rgba(96, 165, 250, 0.6))',
              fontSize: overlayWidth > 0
                ? `${(overlayWidth / 8) * 0.65}px`
                : '28px',
            }}
          >
            {getPieceChar(pendingOverlay.piece, pendingOverlay.color)}
          </motion.div>
          )
        })()}

        {myPendingOverlay && !showRetraction && (() => {
          const myPos = getSquarePercent(myPendingOverlay.to, orientation)
          return (
          <motion.div
            key={`my-pending-${myPendingOverlay.from}-${myPendingOverlay.to}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute flex items-center justify-center font-bold select-none"
            style={{ 
              left: myPos.left,
              top: myPos.top,
              width: '12.5%', 
              height: '12.5%',
              color: myPendingOverlay.color === 'white' ? '#fff' : '#000',
              textShadow: myPendingOverlay.color === 'white' 
                ? '0 0 2px #000' 
                : '0 0 2px #fff',
              filter: 'drop-shadow(0 0 6px rgba(74, 222, 128, 0.6))',
              fontSize: overlayWidth > 0
                ? `${(overlayWidth / 8) * 0.65}px`
                : '28px',
            }}
          >
            {getPieceChar(myPendingOverlay.piece, myPendingOverlay.color)}
          </motion.div>
          )
        })()}

        {pendingOverlay && (
          <AnimatePresence>
            {teammateLabelVisible && pendingOverlay && (() => {
              const labelPos = getSquarePercent(pendingOverlay.to, orientation)
              const centerLeft = `${parseFloat(labelPos.left) + 6.25}%`
              return (
              <motion.div
                key="teammate-label"
                initial={{
                  y: 0,
                  opacity: 0,
                  scale: 0.5
                }}
                animate={{
                  y: -26,
                  opacity: 1,
                  scale: 1
                }}
                exit={{
                  opacity: 0,
                  scale: 0.7
                }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="absolute pointer-events-none select-none z-20"
                style={{
                  left: centerLeft,
                  top: labelPos.top,
                }}
              >
                <div style={{ transform: 'translateX(-50%)' }}>
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap
                      bg-gradient-to-r from-amber-500/90 to-amber-400/90
                      shadow-[0_0_12px_rgba(251,191,36,0.4)] backdrop-blur-sm
                      border border-amber-300/30"
                  >
                    <span className="text-xs font-bold text-gray-900 tracking-wide">Teammate&apos;s move</span>
                  </div>
                </div>
              </motion.div>
              )
            })()}
          </AnimatePresence>
        )}

        <AnimatePresence>
          {showRetraction && retractionData && (
            <>
              {Array.from({ length: 8 }).map((_, i) => {
                const angle = (i / 8) * Math.PI * 2
                const dx = Math.cos(angle) * 40
                const dy = Math.sin(angle) * 40
                return (
                  <motion.div
                    key={`particle-${i}-${retractionData.from}-${retractionData.to}`}
                    initial={{ 
                      x: getSquarePosition(retractionData.to).x,
                      y: getSquarePosition(retractionData.to).y,
                      opacity: 0.8,
                      scale: 0.6,
                    }}
                    animate={{ 
                      x: getSquarePosition(retractionData.to).x + dx,
                      y: getSquarePosition(retractionData.to).y + dy,
                      opacity: 0,
                      scale: 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute rounded-full pointer-events-none"
                    style={{ 
                      width: '6px',
                      height: '6px',
                      backgroundColor: retractionData.color === 'white' ? '#ff4444' : '#cc0000'
                    }}
                  />
                )
              })}
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
            </>
          )}
        </AnimatePresence>
        </>
        )}
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
              left: `${((highlightSquares.winnerTo.charCodeAt(0) - 97) * (orientation === 'black' ? -1 : 1) + (orientation === 'black' ? 7 : 0)) * 12.5}%`,
              top: `${((parseInt(highlightSquares.winnerTo[1]) - 1) * (orientation === 'black' ? 1 : -1) + (orientation === 'black' ? 0 : 7)) * 12.5}%`,
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)'
            }}
          />
        </div>
      )}
    </div>
  )
}