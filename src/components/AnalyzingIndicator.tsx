'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

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
          className="flex items-center gap-3 px-4 py-2 bg-blue-900/50 border border-blue-500/50 rounded-lg"
        >
          <motion.div
            className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <span className="text-blue-300 font-medium">
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
          className="text-blue-400"
        >
          {label}{dots}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
