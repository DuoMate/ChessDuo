'use client'

import { memo } from 'react'
import { IsolatedMatchTimer } from './IsolatedMatchTimer'

export interface PipOverlayProps {
  visible: boolean
  /** Live FEN from the authoritative engine — presentation read-only. */
  fen: string
  /** Viewer perspective (mirrors the main board orientation). */
  orientation?: 'white' | 'black'
  /** Compact status mapped from existing state (YOUR TURN / OPPONENT'S TURN / …). */
  turnLabel: string
  /** Game identity (QUICK PLAY / DUO / 4 PLAYER / DUEL / AI COACH). */
  gameLabel: string
  lastMove?: { from: string; to: string } | null
  /** Authoritative clock getter — reused display path (IsolatedMatchTimer). Omit for untimed modes. */
  getTimeRemaining?: () => number
  isTimerActive?: boolean
  totalSeconds?: number
  /** Footer text for untimed modes (e.g. move count). Ignored when a timer is provided. */
  footerLabel?: string | null
}

const GLYPHS: Record<string, string> = {
  K: '♚',
  Q: '♛',
  R: '♜',
  B: '♝',
  N: '♞',
  P: '♟',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
}

function squareToIndex(square: string): { row: number; col: number } | null {
  if (!square || square.length !== 2) return null
  const col = square.charCodeAt(0) - 97
  const row = 8 - parseInt(square[1], 10)
  if (col < 0 || col > 7 || row < 0 || row > 7 || Number.isNaN(row)) return null
  return { row, col }
}

/**
 * Parse a FEN placement field into an 8×8 glyph grid (rank 8 first).
 * Pure + defensive: malformed FEN yields an empty board, never throws —
 * the overlay must never crash the game shell.
 */
export function parsePipBoard(fen: string, orientation: 'white' | 'black'): (string | null)[][] {
  const empty: (string | null)[][] = Array.from({ length: 8 }, () => Array<string | null>(8).fill(null))
  try {
    const placement = fen.split(' ')[0]
    if (!placement) return empty
    const rows = placement.split('/')
    if (rows.length !== 8) return empty
    const board: (string | null)[][] = rows.map((row) => {
      const cells: (string | null)[] = []
      for (const ch of row) {
        if (/\d/.test(ch)) {
          for (let i = 0; i < parseInt(ch, 10); i++) cells.push(null)
        } else if (GLYPHS[ch]) {
          cells.push(ch)
        } else {
          return null
        }
      }
      return cells.length === 8 ? cells : null
    })
    if (board.some((r) => r === null)) return empty
    const grid = board as (string | null)[][]
    if (orientation === 'black') {
      return grid.map((r) => [...r].reverse()).reverse()
    }
    return grid
  } catch {
    // Malformed FEN — show an empty board rather than breaking the shell.
    return empty
  }
}

function PipOverlayInner({
  visible,
  fen,
  orientation = 'white',
  turnLabel,
  gameLabel,
  lastMove = null,
  getTimeRemaining,
  isTimerActive = false,
  totalSeconds = 0,
  footerLabel = null,
}: PipOverlayProps) {
  if (!visible) return null

  const grid = parsePipBoard(fen, orientation)
  const highlight = new Set<string>()
  if (lastMove) {
    const from = squareToIndex(lastMove.from)
    const to = squareToIndex(lastMove.to)
    if (from) highlight.add(`${orientation === 'black' ? 7 - from.row : from.row}-${orientation === 'black' ? 7 - from.col : from.col}`)
    if (to) highlight.add(`${orientation === 'black' ? 7 - to.row : to.row}-${orientation === 'black' ? 7 - to.col : to.col}`)
  }

  return (
    // z-[100]: in PiP mode this overlay IS the window — it must cover the
    // full shell including modals (same documented exception as NetworkOverlay).
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-1 overflow-hidden bg-white p-2 dark:bg-slate-950" role="status" aria-label={`ChessDuo PiP — ${gameLabel}, ${turnLabel}`}>
      <div className="text-center text-xs font-extrabold tracking-widest text-slate-500 dark:text-slate-400">CHESSDUO</div>
      <div className="grid aspect-square w-full max-w-[240px] grid-cols-8 overflow-hidden rounded-lg border-2 border-slate-300 dark:border-slate-700" aria-hidden>
        {grid.flatMap((row, r) =>
          row.map((piece, c) => {
            const isLight = (r + c) % 2 === 0
            const isWhitePiece = piece !== null && piece === piece.toUpperCase()
            return (
              <div
                key={`${r}-${c}`}
                className={`flex items-center justify-center text-lg leading-none ${
                  highlight.has(`${r}-${c}`)
                    ? 'bg-yellow-300 dark:bg-yellow-500'
                    : isLight
                      ? 'bg-amber-100 dark:bg-amber-100/90'
                      : 'bg-emerald-700 dark:bg-emerald-800'
                } ${piece ? (isWhitePiece ? 'text-slate-50 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]' : 'text-slate-900 dark:text-slate-950') : ''}`}
              >
                {piece ? GLYPHS[piece] : ''}
              </div>
            )
          }),
        )}
      </div>
      <div className="text-center text-xs font-bold text-slate-900 dark:text-slate-100">{turnLabel}</div>
      {getTimeRemaining ? (
        <IsolatedMatchTimer getTimeRemaining={getTimeRemaining} isActive={isTimerActive} totalSeconds={totalSeconds} />
      ) : footerLabel ? (
        <div className="text-center text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{footerLabel}</div>
      ) : null}
      <div className="text-center text-xs font-medium tracking-wide text-slate-400 dark:text-slate-500">{gameLabel}</div>
    </div>
  )
}

export const PipOverlay = memo(PipOverlayInner)
