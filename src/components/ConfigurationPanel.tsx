'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Swords } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'
import { ColorPicker } from './ColorPicker'
import type { PlayerColor } from '@/features/shared/gameConstants'

interface ConfigurationPanelProps {
  open: boolean
  mode: 'quick' | 'duo'
  selectedColor: PlayerColor
  onColorChange: (color: PlayerColor) => void
  onClose: () => void
  onStart: (color: PlayerColor) => void
  modeTitle: string
  modeSubtitle: string
  botLevelLabel: string
  botLevelDescription: string
}

export function ConfigurationPanel({
  open,
  mode,
  selectedColor,
  onColorChange,
  onClose,
  onStart,
  modeTitle,
  modeSubtitle,
  botLevelLabel,
  botLevelDescription,
}: ConfigurationPanelProps) {
  useEscapeKey(onClose, open)
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedColor) {
        onStart(selectedColor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, selectedColor, onStart])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-md overflow-y-auto rounded-[28px] border border-slate-700/50 bg-[#0a0e1a] p-6 shadow-2xl max-h-[calc(100vh-2rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-panel-title"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close configuration"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={20} />
            </button>

            <div className="mb-5 text-center">
              <h2
                id="config-panel-title"
                className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400"
              >
                Configuration
              </h2>
            </div>

            <section className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                Game Mode
              </p>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3.5 flex items-center gap-3">
                <Swords size={20} className="text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-100">{modeTitle}</div>
                  <div className="text-[11px] text-slate-400">{modeSubtitle}</div>
                </div>
              </div>
            </section>

            <section className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                Bot Difficulty
              </p>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3.5">
                <div className="font-bold text-sm text-blue-300 mb-1">{botLevelLabel}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {botLevelDescription}
                </p>
              </div>
            </section>

            <section className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                Choose Your <span className="text-blue-400">Color</span>
              </p>
              <ColorPicker value={selectedColor} onChange={onColorChange} />
            </section>

            <button
              type="button"
              onClick={() => onStart(selectedColor)}
              disabled={!selectedColor}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold text-sm transition-all duration-200 shadow-[0_4px_24px_rgba(59,130,246,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play size={18} strokeWidth={2.5} fill="currentColor" />
              Start Game
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
