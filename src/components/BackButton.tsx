'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  label?: string
  fallbackHref?: string
}

export function BackButton({ label = 'Back', fallbackHref = '/' }: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-2xl px-3 py-1.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      aria-label={label}
    >
      <ArrowLeft size={18} strokeWidth={2} />
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </motion.button>
  )
}
