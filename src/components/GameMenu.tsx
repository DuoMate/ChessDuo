'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Flag, Settings } from 'lucide-react'

interface GameMenuProps {
  onResign: () => void
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
        className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 flex items-center justify-center transition-colors"
        style={{ minHeight: '44px', minWidth: '44px' }}
        aria-label="Menu"
      >
        {open ? <X size={18} className="text-gray-600 dark:text-gray-300" /> : <Menu size={18} className="text-gray-600 dark:text-gray-300" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <button
              onClick={() => { onOpenSettings(); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <Settings size={16} className="text-gray-500 dark:text-gray-400" />
              Settings
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700" />
            <button
              onClick={() => { onResign(); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              style={{ minHeight: '44px' }}
            >
              <Flag size={16} className="text-red-500 dark:text-red-400" />
              Resign
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
