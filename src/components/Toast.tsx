'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const timerIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    return () => {
      timerIdsRef.current.forEach((id) => clearTimeout(id))
      timerIdsRef.current.clear()
    }
  }, [])

  const addToast = useCallback((type: ToastType, message: string, duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { id, type, message, duration }
    
    setToasts(prev => [...prev, newToast])

    if (duration > 0) {
      const timerId = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
        timerIdsRef.current.delete(timerId)
      }, duration)
      timerIdsRef.current.add(timerId)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const config = {
    info: { bg: 'bg-white/90 dark:bg-slate-900/90', border: 'border-sky-200 dark:border-sky-500/30', text: 'text-slate-800 dark:text-slate-100', icon: Info, iconClass: 'text-sky-600 dark:text-sky-400' },
    success: { bg: 'bg-emerald-50/95 dark:bg-emerald-950/70', border: 'border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-900 dark:text-emerald-100', icon: CheckCircle2, iconClass: 'text-emerald-600 dark:text-emerald-400' },
    warning: { bg: 'bg-amber-50/95 dark:bg-amber-950/70', border: 'border-amber-200 dark:border-amber-500/30', text: 'text-amber-900 dark:text-amber-100', icon: AlertCircle, iconClass: 'text-amber-600 dark:text-amber-400' },
    error: { bg: 'bg-rose-50/95 dark:bg-rose-950/70', border: 'border-rose-200 dark:border-rose-500/30', text: 'text-rose-900 dark:text-rose-100', icon: XCircle, iconClass: 'text-rose-600 dark:text-rose-400' },
  }

  const { bg, border, text, icon: Icon, iconClass } = config[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      className={`${bg} ${border} ${text} flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(2,6,23,0.16)] backdrop-blur-xl`}
    >
      <Icon size={18} className={iconClass} />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-xl leading-none text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        aria-label="Dismiss"
      >
        ×
      </button>
    </motion.div>
  )
}

// Convenience hook for game events
export function useGameToast() {
  const { addToast } = useToast()
  
  return useMemo(() => ({
    info: (msg: string) => addToast('info', msg),
    success: (msg: string) => addToast('success', msg),
    warning: (msg: string) => addToast('warning', msg),
    error: (msg: string) => addToast('error', msg, 6000),
    
    // Game-specific
    connectionLost: () => addToast('error', 'Connection lost. Trying to reconnect...', 8000),
    connectionRestored: () => addToast('success', 'Connection restored!'),
    moveLocked: () => addToast('info', 'Move locked in'),
    resolutionComplete: (winner: string) => addToast('success', `${winner} won this turn!`),
    gameOver: (result: string) => addToast('info', `Game Over: ${result}`, 0),
  }), [addToast])
}