'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

  const addToast = useCallback((type: ToastType, message: string, duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { id, type, message, duration }
    
    setToasts(prev => [...prev, newToast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
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
    info: { bg: 'bg-blue-900', border: 'border-blue-500', icon: 'ℹ️' },
    success: { bg: 'bg-green-900', border: 'border-green-500', icon: '✓' },
    warning: { bg: 'bg-yellow-900', border: 'border-yellow-500', icon: '⚠️' },
    error: { bg: 'bg-red-900', border: 'border-red-500', icon: '✕' },
  }

  const { bg, border, icon } = config[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      className={`${bg} ${border} border-2 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3`}
    >
      <span className="text-xl">{icon}</span>
      <p className="text-white text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-gray-400 hover:text-white text-xl leading-none"
      >
        ×
      </button>
    </motion.div>
  )
}

// Convenience hook for game events
export function useGameToast() {
  const { addToast } = useToast()
  
  return {
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
  }
}