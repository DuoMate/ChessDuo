'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={onClose}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 top-0 bottom-0 z-50 bg-gray-900 overflow-y-auto shadow-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">{children}</div>
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
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto shadow-2xl"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white text-lg transition-colors"
                >
                  ✕
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
