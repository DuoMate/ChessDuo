'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'
import { PANEL_SPRING, PANEL_BACKDROP } from './modalConstants'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  const isMobile = useIsMobile()

  const backHandler = useCallback(() => {
    onClose()
    return true
  }, [onClose])
  useCapacitorBackButton(backHandler, open)
  useEscapeKey(onClose, open)
  useScrollLock(open)

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 z-40 ${PANEL_BACKDROP}`}
              onClick={onClose}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={PANEL_SPRING}
              className="fixed inset-x-0 top-0 bottom-0 z-50 overflow-y-auto bg-white/90 shadow-[0_24px_90px_rgba(2,6,23,0.28)] backdrop-blur-2xl dark:bg-slate-950/90"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {title && (
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/80">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{title}</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className={title ? '' : 'pt-0'}>{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-40 ${PANEL_BACKDROP}`}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={PANEL_SPRING}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto border-l border-slate-200/80 bg-white/90 shadow-[0_24px_90px_rgba(2,6,23,0.28)] backdrop-blur-2xl dark:border-slate-700/80 dark:bg-slate-950/90"
          >
            <div className="p-4">
              {title && (
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-3 dark:border-slate-700/70 dark:bg-slate-800/70">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{title}</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              )}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
