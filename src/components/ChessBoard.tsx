'use client'

import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { Chessboard, COLOR, INPUT_EVENT_TYPE, InputEvent } from 'cm-chessboard'
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers'
import { Chess, Square } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import { DEBUG } from '@/lib/debug'
import type { PromotionPiece } from '@/features/shared/gameTypes'

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

export interface CoachMoveMarker {
  from: string
  to: string
  rank: 1 | 2 | 3
}

export interface HighlightSquares {
  winnerFrom?: string
  winnerTo?: string
  loserFrom?: string
  loserTo?: string
  /** Ranked Top-3 coach previews — visual only, never mutates board state. */
  coachMoves?: CoachMoveMarker[] | null
}

/**
 * True when lastMove is a castling move: a king stepping exactly two files on
 * the same rank (e.g. e1→g1, e8→c8). Used to animate castling via cm-chessboard's
 * position-diff animation (king + rook both slide); non-castle moves snapshot
 * without animation as before.
 */
function isCastleMove(lastMove: { from: string; to: string } | null): boolean {
  if (!lastMove) return false
  const { from, to } = lastMove
  return from.length === 2 && to.length === 2 &&
    from[0] === 'e' &&
    from[1] === to[1] &&
    Math.abs(to.charCodeAt(0) - from.charCodeAt(0)) === 2
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

function getSquarePercentInternal(square: string, orientation: string): { left: string; top: string } {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
  const rank = 8 - parseInt(square[1])
  const isFlipped = orientation === 'black'
  const l = `${(isFlipped ? (7 - file) : file) * 12.5}%`
  const t = `${(isFlipped ? (7 - rank) : rank) * 12.5}%`
  return { left: l, top: t }
}

function getPieceCharInternal(piece: string, color: 'white' | 'black'): string {
  const key = color === 'white' ? piece.toUpperCase() : piece.toLowerCase()
  return PIECE_CHARS[key] || piece
}

function ChessBoardInner({ 
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
  // P0-3 perf: cache chess.js parses during an active touch gesture.
  // Previously moveInputStarted + validateMoveInput + moveInputFinished each
  // constructed `new Chess(fen)` + `moves({verbose:true})` (3 full move-gen
  // passes per tap/drag on the main thread). Cache is keyed by fen and bounded;
  // cleared on position change. Presentation-only — legality results identical.
  const verboseMovesCacheRef = useRef<{ fen: string; moves: Array<{ from: string; to: string; promotion?: string }> } | null>(null)
  const squareMovesCacheRef = useRef<Map<string, string[]>>(new Map())
  const getVerboseMoves = (positionFen: string) => {
    const cached = verboseMovesCacheRef.current
    if (cached && cached.fen === positionFen) return cached.moves
    const chess = new Chess(positionFen)
    const moves = chess.moves({ verbose: true }) as Array<{ from: string; to: string; promotion?: string }>
    verboseMovesCacheRef.current = { fen: positionFen, moves }
    // Position changed → per-square destinations from the old position are stale.
    if (squareMovesCacheRef.current.size > 0) squareMovesCacheRef.current.clear()
    return moves
  }
  const getSquareDestinations = (positionFen: string, squareFrom: string): string[] => {
    const key = `${positionFen}|${squareFrom}`
    const hit = squareMovesCacheRef.current.get(key)
    if (hit) return hit
    let dests: string[] = []
    try {
      const all = getVerboseMoves(positionFen)
      dests = all.filter(m => m.from === squareFrom).map(m => m.to)
    } catch {
      dests = []
    }
    // Bound the cache: one position × ≤32 origins is tiny; clear on overflow.
    if (squareMovesCacheRef.current.size > 64) squareMovesCacheRef.current.clear()
    squareMovesCacheRef.current.set(key, dests)
    return dests
  }

  // Overlay glyph sizing only needs the board width when an overlay is
  // visible. rAF-coalesced + width-change-guarded so continuous resizes
  // don't setState every frame; passive effect (no layout read during render).
  useEffect(() => {
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (overlayContainerRef.current) {
          const w = overlayContainerRef.current.getBoundingClientRect().width
          setOverlayWidth((prev) => (Math.abs(prev - w) < 1 ? prev : w))
        }
      })
    }
    measure()

    if (typeof ResizeObserver !== 'undefined' && overlayContainerRef.current) {
      const observer = new ResizeObserver(measure)
      observer.observe(overlayContainerRef.current)
      return () => {
        cancelAnimationFrame(raf)
        observer.disconnect()
      }
    }
    return () => cancelAnimationFrame(raf)
  }, [orientation])
 
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

    // cm-chessboard wires its own ResizeObserver (and window-resize fallback)
    // against the board view. If a resize/orientation event lands after the
    // board was torn down (React unmount, remount on layout change), its
    // internal handleResize → redrawBoard reads a destroyed context and throws
    // "Cannot read properties of undefined (reading 'invokeExtensionPoints')".
    // Patch the handlers so redraws no-op once the container is gone from the
    // DOM or the view has been disposed.
    const view = (boardRef.current as any).view
    if (view && typeof view.handleResize === 'function') {
      const originalHandleResize = view.handleResize.bind(view)
      const safeResize = () => {
        try {
          if (!view.container || !view.container.isConnected) return
          originalHandleResize()
        } catch {
          // Board torn down mid-resize — ignore.
        }
      }
      view.handleResize = safeResize
      if (view.resizeListener) view.resizeListener = safeResize
    }

    return () => {
      const board = boardRef.current
      if (board) {
        const v = (board as any).view
        if (v?.resizeObserver) {
          v.resizeObserver.disconnect()
          v.resizeObserver = null
        }
        if (v?.resizeListener) {
          window.removeEventListener('resize', v.resizeListener)
          v.resizeListener = null
        }
        board.destroy()
      }
      boardRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!boardRef.current) return
    // Animate castling so the king + rook both slide to their squares
    // (cm-chessboard's setPosition diffs the position and moves both pieces).
    // All other moves snapshot instantly as before.
    boardRef.current.setPosition(fen, isCastleMove(lastMoveRef.current))
  }, [fen])

  useEffect(() => {
    if (boardRef.current) {
      boardRef.current.setOrientation(orientation === 'white' ? COLOR.white : COLOR.black)
    }
  }, [orientation])

  useEffect(() => {
    if (!boardRef.current) return

    boardRef.current.removeMarkers()

    const coachMoves = highlightSquares?.coachMoves ?? null
    if (coachMoves && coachMoves.length > 0) {
      // Ranked Top-3 preview: distinct marker TYPES per rank (frame /
      // framePrimary / circle) so rank never depends on color alone. Custom
      // colored borders + numbered badges render in the overlay below.
      for (const move of coachMoves.slice(0, 3)) {
        const marker =
          move.rank === 2 ? MARKER_TYPE.framePrimary
          : move.rank === 3 ? MARKER_TYPE.circle
          : MARKER_TYPE.frame
        boardRef.current.addMarker(marker, move.from)
        boardRef.current.addMarker(marker, move.to)
      }
      return
    }

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
            // Cached: one move-gen pass per position, shared with validate/finish.
            const dests = getSquareDestinations(fenRef.current, squareFrom)
            for (const to of dests) {
              boardRef.current?.addMarker(MARKER_TYPE.dot, to)
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
            const moves = getVerboseMoves(fenRef.current)
            const validMove = moves.find(m => m.from === squareFrom && m.to === squareTo)

            if (validMove) {
              return true
            }
          } catch {
            DEBUG && console.warn('Error validating move')
          }
          return false
        }

        if (event.type === INPUT_EVENT_TYPE.moveInputFinished) {
          boardRef.current?.removeMarkers(MARKER_TYPE.dot)

          const { squareFrom, squareTo } = event
          if (squareFrom && squareTo) {
            try {
              const moves = getVerboseMoves(fenRef.current)
              const validMove = moves.find(m => m.from === squareFrom && m.to === squareTo)

              if (validMove) {
                // Reuse the already-computed verbose move: `promotion` flag is
                // on validMove, so no extra `new Chess()` parse is needed.
                const promotionPiece = (validMove.promotion as PromotionPiece | undefined) ?? null
                const move = `${squareFrom}-${squareTo}`
                if (promotionPiece) {
                  onMoveRef.current(move, promotionPiece)
                } else {
                  onMoveRef.current(move)
                }
                return true
              }
            } catch {
              DEBUG && console.warn('Error processing move')
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

  // Stable callbacks — avoid recreating helpers every render (perf). Helpers
  // themselves are pure and defined at module scope; these closures only bind
  // overlayWidth which is the only dynamic input for getSquarePosition.
  const getSquarePosition = useCallback((square: string): { x: number; y: number } => {
    if (overlayWidth <= 0) return { x: 0, y: 0 }
    const squareSize = overlayWidth / 8
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0)
    const rank = parseInt(square[1]) - 1
    const isFlipped = orientation === 'black'
    const x = isFlipped ? (7 - file) * squareSize : file * squareSize
    const y = isFlipped ? rank * squareSize : (7 - rank) * squareSize
    return { x, y }
  }, [overlayWidth, orientation])

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

  const handleRetractionComplete = useCallback(() => {
    setShowRetraction(false)
    setRetractionData(null)
    onAnimationComplete?.()
  }, [onAnimationComplete])

  return (
    <div className="relative w-full pt-[100%]">
      {/* P1 perf: no backdrop-blur under the board — the cm-chessboard view is
          opaque and covers this frame entirely, so the blur only cost GPU
          (full-board backdrop sampling on every frame) with zero visual effect. */}
      <div className="absolute inset-0 rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/70" />
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
          const toPos = getSquarePercentInternal(pendingOverlay.to, orientation)
          return (
          <motion.div
            key={`pending-${pendingOverlay.from}-${pendingOverlay.to}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute flex items-center justify-center font-bold select-none"
            // Dynamic piece-contrast colors: pending-move glyphs must render in
            // literal piece white/black with an inverted halo so they stay
            // legible on either square color — Tailwind tokens can't express
            // this per-piece inversion, hence the style prop.
            style={{ 
              left: toPos.left,
              top: toPos.top,
              width: '12.5%', 
              height: '12.5%',
              color: pendingOverlay.color === 'white' ? '#fff' : '#000',
              textShadow: pendingOverlay.color === 'white' 
                ? '0 0 2px #000' 
                : '0 0 2px #fff',
              fontSize: overlayWidth > 0
                ? `${(overlayWidth / 8) * 0.65}px`
                : '28px',
              willChange: 'opacity',
            }}
          >
            {getPieceCharInternal(pendingOverlay.piece, pendingOverlay.color)}
          </motion.div>
          )
        })()}

        {myPendingOverlay && !showRetraction && (() => {
          const myPos = getSquarePercentInternal(myPendingOverlay.to, orientation)
          return (
          <motion.div
            key={`my-pending-${myPendingOverlay.from}-${myPendingOverlay.to}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute flex items-center justify-center font-bold select-none"
            // Dynamic piece-contrast colors: pending-move glyphs must render in
            // literal piece white/black with an inverted halo so they stay
            // legible on either square color — Tailwind tokens can't express
            // this per-piece inversion, hence the style prop.
            style={{ 
              left: myPos.left,
              top: myPos.top,
              width: '12.5%', 
              height: '12.5%',
              color: myPendingOverlay.color === 'white' ? '#fff' : '#000',
              textShadow: myPendingOverlay.color === 'white' 
                ? '0 0 2px #000' 
                : '0 0 2px #fff',
              fontSize: overlayWidth > 0
                ? `${(overlayWidth / 8) * 0.65}px`
                : '28px',
              willChange: 'opacity',
            }}
          >
            {getPieceCharInternal(myPendingOverlay.piece, myPendingOverlay.color)}
          </motion.div>
          )
        })()}

        {pendingOverlay && (
          <AnimatePresence>
            {teammateLabelVisible && pendingOverlay && (() => {
              const labelPos = getSquarePercentInternal(pendingOverlay.to, orientation)
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
                className="absolute pointer-events-none select-none z-20 will-change-transform"
                style={{
                  left: centerLeft,
                  top: labelPos.top,
                  willChange: 'transform, opacity',
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
                const fromX = getSquarePosition(retractionData.to).x
                const fromY = getSquarePosition(retractionData.to).y
                return (
                  <motion.div
                    key={`particle-${i}-${retractionData.from}-${retractionData.to}`}
                    initial={{ 
                      x: fromX,
                      y: fromY,
                      opacity: 0.8,
                      scale: 0.6,
                    }}
                    animate={{ 
                      x: fromX + dx,
                      y: fromY + dy,
                      opacity: 0,
                      scale: 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute rounded-full pointer-events-none"
                    style={{ 
                      width: '6px',
                      height: '6px',
                      backgroundColor: retractionData.color === 'white' ? '#ff4444' : '#cc0000',
                      willChange: 'transform, opacity',
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
                }}
                animate={{ 
                  x: getSquarePosition(retractionData.from).x,
                  y: getSquarePosition(retractionData.from).y,
                  opacity: 0
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeIn" }}
                className="absolute flex items-center justify-center text-4xl md:text-5xl lg:text-6xl font-bold select-none will-change-transform"
                style={{ 
                  width: '12.5%', 
                  height: '12.5%',
                  borderRadius: '0',
                  willChange: 'transform, opacity',
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
                  {getPieceCharInternal(retractionData.piece, retractionData.color as 'white' | 'black')}
                </span>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        </>
        )}
      </div>

      {highlightSquares?.coachMoves && highlightSquares.coachMoves.length > 0 && !showRetraction && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {highlightSquares.coachMoves.slice(0, 3).map((move) => {
            // Same-destination overlap: stack badges diagonally so no rank hides another.
            const sameToCount = highlightSquares.coachMoves!
              .slice(0, 3)
              .filter((m) => m.to === move.to)
              .findIndex((m) => m.from === move.from && m.rank === move.rank)
            const borderVar =
              move.rank === 2 ? 'var(--color-coach-insight)'
              : move.rank === 3 ? 'var(--color-coach-alt)'
              : 'var(--color-coach-best)'
            return (
              <motion.div
                key={`coach-${move.rank}-${move.from}-${move.to}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute rounded-lg border-4 will-change-transform"
                // Dynamic square geometry + rank color: position derives from
                // the move square/orientation, color from the rank token —
                // Tailwind cannot express either statically.
                style={{
                  width: '12.5%',
                  height: '12.5%',
                  left: `${((move.to.charCodeAt(0) - 97) * (orientation === 'black' ? -1 : 1) + (orientation === 'black' ? 7 : 0)) * 12.5}%`,
                  top: `${((parseInt(move.to[1]) - 1) * (orientation === 'black' ? 1 : -1) + (orientation === 'black' ? 0 : 7)) * 12.5}%`,
                  borderColor: borderVar,
                  // z-20s: rank 1 paints above 2/3 on shared squares, all below overlays (>50 never used).
                  zIndex: 24 - move.rank,
                  willChange: 'transform, opacity',
                }}
              >
                <span
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white ring-2 ring-white dark:ring-slate-900"
                  // Dynamic per-rank fill + diagonal nudge for shared squares.
                  style={{
                    backgroundColor: borderVar,
                    marginTop: `${Math.max(0, sameToCount) * 20}px`,
                    zIndex: 24 - move.rank,
                  }}
                >
                  {move.rank}
                </span>
              </motion.div>
            )
          })}
        </div>
      )}

      {(!highlightSquares?.coachMoves || highlightSquares.coachMoves.length === 0) && highlightSquares?.winnerFrom && highlightSquares?.winnerTo && !showRetraction && (
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute border-4 border-green-500 rounded-lg will-change-transform"
            style={{
              width: '12.5%',
              height: '12.5%',
              left: `${((highlightSquares.winnerTo.charCodeAt(0) - 97) * (orientation === 'black' ? -1 : 1) + (orientation === 'black' ? 7 : 0)) * 12.5}%`,
              top: `${((parseInt(highlightSquares.winnerTo[1]) - 1) * (orientation === 'black' ? 1 : -1) + (orientation === 'black' ? 0 : 7)) * 12.5}%`,
              willChange: 'transform, opacity',
            }}
          />
        </div>
      )}
    </div>
  )
}

// Memoized — timer/presence/chat updates must NOT rerender the board.
// Props are shallow-compared; pendingOverlay/highlightSquares are stable
// object refs (Game.tsx retains same ref when unchanged via ...prev spread).
export const ChessBoard = memo(ChessBoardInner, (prev, next) => {
  return (
    prev.fen === next.fen &&
    prev.enabled === next.enabled &&
    prev.orientation === next.orientation &&
    prev.lastMove?.from === next.lastMove?.from &&
    prev.lastMove?.to === next.lastMove?.to &&
    prev.pendingOverlay?.from === next.pendingOverlay?.from &&
    prev.pendingOverlay?.to === next.pendingOverlay?.to &&
    prev.pendingOverlay?.piece === next.pendingOverlay?.piece &&
    prev.pendingOverlay?.color === next.pendingOverlay?.color &&
    prev.pendingOverlay?.showTeammateLabel === next.pendingOverlay?.showTeammateLabel &&
    prev.myPendingOverlay?.from === next.myPendingOverlay?.from &&
    prev.myPendingOverlay?.to === next.myPendingOverlay?.to &&
    prev.myPendingOverlay?.piece === next.myPendingOverlay?.piece &&
    prev.myPendingOverlay?.color === next.myPendingOverlay?.color &&
    prev.highlightSquares?.winnerFrom === next.highlightSquares?.winnerFrom &&
    prev.highlightSquares?.winnerTo === next.highlightSquares?.winnerTo &&
    prev.highlightSquares?.loserFrom === next.highlightSquares?.loserFrom &&
    prev.highlightSquares?.loserTo === next.highlightSquares?.loserTo &&
    (prev.highlightSquares?.coachMoves?.length ?? 0) === (next.highlightSquares?.coachMoves?.length ?? 0) &&
    (prev.highlightSquares?.coachMoves ?? []).every(
      (m, i) =>
        m.from === next.highlightSquares?.coachMoves?.[i]?.from &&
        m.to === next.highlightSquares?.coachMoves?.[i]?.to &&
        m.rank === next.highlightSquares?.coachMoves?.[i]?.rank,
    ) &&
    prev.onAnimationComplete === next.onAnimationComplete &&
    prev.onMove === next.onMove
  )
})