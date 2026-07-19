'use client'

import { useState, useEffect } from 'react'
import { Smartphone, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.navron.chessduo'

function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.()
}

function isMobileWeb(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export default function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isNativeApp() || !isMobileWeb()) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timer = setTimeout(() => setShow(true), 500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <AnimatePresence>
      {show && !dismissed && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="sticky top-0 z-50 w-full bg-gradient-to-r from-indigo-600 to-blue-500 px-4 py-2.5 shadow-lg"
        >
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Smartphone size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white">Get the ChessDuo app</p>
                <p className="truncate text-[11px] text-white/70">Better experience on mobile</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] min-w-[80px] rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo-600 transition-colors hover:bg-white/90"
              >
                Install
              </a>
              <button
                onClick={() => setDismissed(true)}
                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Skip"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
