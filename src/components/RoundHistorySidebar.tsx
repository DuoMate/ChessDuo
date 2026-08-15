'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useCallback } from 'react'
import { X, History, Crown } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

export interface RoundHistoryEntry {
  round: number
  playerLabel: string
  moveSan: string
  pieceColor: 'white' | 'black'
  pieceChar: string
  evalDelta: number
  isCurrent?: boolean
}

interface RoundHistorySidebarProps {
  open: boolean
  entries: RoundHistoryEntry[]
  onClose: () => void
  onViewFullHistory?: () => void
}

function pieceFor(san: string, color: 'white' | 'black'): string {
  const first = san[0]
  if (['K','Q','R','B','N'].includes(first)) {
    return color === 'white'
      ? { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' }[first] || '♙'
      : { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' }[first] || '♟'
  }
  return color === 'white' ? '♙' : '♟'
}

export function RoundHistorySidebar({ open, entries, onClose, onViewFullHistory }: RoundHistorySidebarProps) {
  useEscapeKey(onClose, open)
  useScrollLock(open)

  const backHandler = useCallback(() => {
    onClose()
    return true
  }, [onClose])
  useCapacitorBackButton(backHandler, open)
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-slate-900/95 border-l border-slate-700/70 backdrop-blur-xl flex flex-col"
          >
            <header className="flex items-center justify-between p-4 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <History size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Round History</h3>
                  <p className="text-xs text-slate-400">View past rounds</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-400"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {entries.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-8">No rounds yet.</p>
              )}
              {entries.map((e) => {
                const isWhite = e.pieceColor === 'white'
                return (
                  <div
                    key={`${e.round}-${e.moveSan}-${e.pieceColor}`} // pieceColor ensures uniqueness when both teams play to the same square
                    className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                      e.isCurrent
                        ? 'border-blue-500/40 bg-blue-500/10'
                        : 'border-slate-700/60 bg-slate-800/40'
                    }`}
                  >
                    <div className="flex flex-col items-center min-w-[44px]">
                      <span className="text-xs font-bold uppercase text-slate-400">Round</span>
                      <span className="text-base font-extrabold text-slate-100">{e.round}</span>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-slate-800/80 flex items-center justify-center text-lg">
                      {pieceFor(e.moveSan, e.pieceColor)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-400 truncate">{e.playerLabel}</p>
                      <p className="text-sm font-bold text-slate-100">{e.moveSan}</p>
                    </div>
                    <div className={`text-xs font-bold ${e.evalDelta > 0 ? 'text-emerald-300' : e.evalDelta < 0 ? 'text-rose-300' : 'text-slate-400'}`}>
                      {e.evalDelta > 0 ? '+' : ''}{e.evalDelta.toFixed(2)}
                    </div>
                    {e.isCurrent && (
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Current
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {onViewFullHistory && (
              <footer className="p-3 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={onViewFullHistory}
                  className="w-full min-h-[44px] rounded-xl text-sm font-bold text-slate-200 bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700/60 transition-colors"
                >
                  View Full History
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
