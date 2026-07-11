'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Flag, Settings } from 'lucide-react'

interface GameMenuProps {
  onResign?: () => void
  onOpenSettings: () => void
}

export function GameMenu({ onResign, onOpenSettings }: GameMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 transition-colors hover:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900/80 dark:hover:bg-slate-800"
        style={{ minHeight: '44px', minWidth: '44px' }}
        aria-label="Menu"
      >
        {open ? <X size={18} className="text-slate-500 dark:text-slate-400" /> : <Menu size={18} className="text-slate-500 dark:text-slate-400" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_16px_60px_rgba(2,6,23,0.2)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/90"
          >
            <button
              onClick={() => { onOpenSettings(); setOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              style={{ minHeight: '44px' }}
            >
              <Settings size={16} className="text-slate-500 dark:text-slate-400" />
              Settings
            </button>
            {onResign && (
              <>
                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                <button
                  onClick={() => { onResign(); setOpen(false) }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  style={{ minHeight: '44px' }}
                >
                  <Flag size={16} className="text-rose-500 dark:text-rose-400" />
                  Resign
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
