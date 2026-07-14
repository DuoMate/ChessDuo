'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Spinner } from '@/components/Spinner'

interface AnalyzingIndicatorProps {
  isVisible: boolean
  phase?: 'teammate' | 'opponent' | 'evaluating'
}

export function AnalyzingIndicator({ isVisible, phase = 'evaluating' }: AnalyzingIndicatorProps) {
  const [dots, setDots] = useState('')
  
  useEffect(() => {
    if (!isVisible) return
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 400)
    
    return () => clearInterval(interval)
  }, [isVisible])
  
  const messages = {
    teammate: 'Teammate analyzing',
    opponent: 'Opponent analyzing',
    evaluating: 'Analyzing'
  }
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-3 rounded-[22px] border border-indigo-200/80 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-xl dark:border-indigo-500/20 dark:bg-slate-900/70"
        >
          <Spinner size="sm" />
          <span className="font-medium text-indigo-700 dark:text-indigo-300">
            {messages[phase]}{dots}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ThinkingDotsProps {
  isVisible: boolean
  label?: string
}

export function ThinkingDots({ isVisible, label = 'Thinking' }: ThinkingDotsProps) {
  const [dots, setDots] = useState('')
  
  useEffect(() => {
    if (!isVisible) {
      setDots('')
      return
    }
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    
    return () => clearInterval(interval)
  }, [isVisible])
  
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.span
          key="thinking"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-indigo-600 dark:text-indigo-300"
        >
          {label}{dots}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
