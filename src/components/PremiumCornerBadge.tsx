'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown } from 'lucide-react'
import { usePremium } from '@/hooks/usePremium'

export function PremiumCornerBadge() {
  const { isPremium, loading } = usePremium()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!isPremium) return
    const timer = setTimeout(() => setCollapsed(true), 3000)
    return () => clearTimeout(timer)
  }, [isPremium])

  if (loading || !isPremium) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.3 }}
        className="fixed z-[40] flex items-center select-none"
        style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))', right: 'calc(1rem + env(safe-area-inset-right, 0px))' }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        onClick={() => setCollapsed(c => !c)}
      >
        <button
          aria-label="Premium member"
          className={`
            flex items-center gap-2 min-h-[44px] rounded-full border
            bg-gradient-to-r from-amber-500/10 to-amber-600/10 backdrop-blur-xl
            dark:from-amber-400/15 dark:to-amber-500/15
            border-amber-500/20 dark:border-amber-400/20
            shadow-[0_0_16px_rgba(251,191,36,0.2)] dark:shadow-[0_0_16px_rgba(251,191,36,0.3)]
            transition-all duration-300
            ${collapsed ? 'px-3' : 'pl-3 pr-4'}
          `}
        >
          <Crown size={16} className="text-amber-500 dark:text-amber-400 flex-shrink-0" strokeWidth={2.5} />
          <motion.span
            initial={false}
            animate={{ width: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="overflow-hidden whitespace-nowrap text-xs font-bold text-amber-500 dark:text-amber-400"
          >
            Premium
          </motion.span>
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
