'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useState, useEffect } from 'react'
import { useSettings } from '@/lib/settings'
import { ArrowLeft, Sun, Moon, BellOff, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'
import { MODAL_SPRING } from './modalConstants'
import { initPushNotifications } from '@/features/push-notifications'

interface SettingsPanelProps {
  open?: boolean
  onClose: () => void
}

export function SettingsPanel({ open = true, onClose }: SettingsPanelProps) {
  const { autoQueen, lowTimeWarning, theme, confirmMove, soundEnabled, setAutoQueen, setLowTimeWarning, setTheme, setConfirmMove, setSoundEnabled } = useSettings()
  const [notifsEnabled, setNotifsEnabled] = useState(true)

  useEffect(() => {
    setNotifsEnabled(localStorage.getItem('chessduo_push_disabled') !== 'true')
  }, [])

  const backHandler = useCallback(() => {
    onClose()
    return true
  }, [onClose])
  useCapacitorBackButton(backHandler, open)
  useEscapeKey(onClose, open)
  useScrollLock(open)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={MODAL_SPRING}
            className="w-full max-w-sm overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_24px_90px_rgba(2,6,23,0.25)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/90"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200/70 p-4 dark:border-slate-700/70">
              <button onClick={onClose} className="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 min-h-[44px] min-w-[44px]">
                <ArrowLeft size={16} />
                <span className="text-sm">Back</span>
              </button>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Settings</h2>
              <div className="w-16" />
            </div>

            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Theme</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
                </div>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 min-h-[44px] min-w-[44px]" aria-label="Toggle theme">
                  {theme === 'dark' ? <Sun size={18} className="text-yellow-600 dark:text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
                </button>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Auto-Queen</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Automatically promote pawns to queen</p>
                </div>
                <button onClick={() => setAutoQueen(!autoQueen)} className={`relative h-7 w-12 min-h-[44px] min-w-[44px] rounded-full transition-colors ${autoQueen ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-label="Toggle auto-queen">
                  <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoQueen ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Low Time Warning</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sound alert when time is running low</p>
                </div>
                <button onClick={() => setLowTimeWarning(!lowTimeWarning)} className={`relative h-7 w-12 min-h-[44px] min-w-[44px] rounded-full transition-colors ${lowTimeWarning ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-label="Toggle low time warning">
                  <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${lowTimeWarning ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Confirm Moves</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Add confirmation before final move</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={confirmMove}
                  onClick={() => setConfirmMove(!confirmMove)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${confirmMove ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${confirmMove ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Sound Effects</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Play sounds for moves and events</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${soundEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Push Notifications</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Receive game invites and chat alerts</p>
                </div>
                <button onClick={() => { const next = !notifsEnabled; setNotifsEnabled(next); localStorage.setItem('chessduo_push_disabled', next ? 'false' : 'true'); if (next) initPushNotifications().catch(() => {}) }} className={`relative h-7 w-12 min-h-[44px] min-w-[44px] rounded-full transition-colors ${notifsEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-label="Toggle push notifications">
                  <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
