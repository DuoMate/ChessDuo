'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home } from 'lucide-react'

interface HomeButtonProps {
  label?: string
}

export function HomeButton({ label = 'Home' }: HomeButtonProps) {
  const router = useRouter()

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => router.push('/')}
      className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-2xl px-3 py-1.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      aria-label="Go home"
    >
      <Home size={18} strokeWidth={2} />
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </motion.button>
  )
}
