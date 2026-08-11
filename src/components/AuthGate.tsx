'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthSession } from '@/hooks/useAuthSession'
import { Auth } from '@/components/Auth'
import { ChooseUsername } from '@/components/ChooseUsername'
import { BackButton } from '@/components/BackButton'
import { PageLoading } from '@/components/PageLoading'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

const LOADING_TIMEOUT_MS = 15_000

interface AuthGateProps {
  variant: 'page' | 'overlay'
  pageTitle?: string
  pageEmoji?: string
  subtitle?: string
  onBack: () => void
  onAuthComplete?: (userId: string) => void
  children: (playerId: string) => React.ReactNode
  defaultSignup?: boolean
  redirectUrl?: string
}

export type { AuthGateProps }

export function AuthGate({
  variant,
  pageTitle,
  pageEmoji,
  subtitle,
  onBack,
  onAuthComplete: onAuthCompleteProp,
  children,
  defaultSignup = false,
  redirectUrl,
}: AuthGateProps) {
  const [authDismissed, setAuthDismissed] = useState(false)
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false)
  const {
    loading,
    playerId,
    needsUsername,
    handleAuthComplete: hookAuthComplete,
    handleUsernameChosen,
  } = useAuthSession()

  useEffect(() => {
    if (loading) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoadingTimedOut(true)
      }, LOADING_TIMEOUT_MS)
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      setLoadingTimedOut(false)
    }
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [loading])

  const handleAuthComplete = useCallback((userId: string) => {
    hookAuthComplete(userId)
    setAuthDismissed(false)
    if (onAuthCompleteProp) onAuthCompleteProp(userId)
  }, [hookAuthComplete, onAuthCompleteProp])

  const handleClose = useCallback(() => {
    setAuthDismissed(true)
  }, [])

  useCapacitorBackButton(() => {
    if (!playerId && !loading) {
      onBack()
      return true
    }
    return false
  }, !!(!playerId && !loading))

  useEffect(() => {
    if (variant === 'overlay' && !playerId && !loading && typeof window !== 'undefined') {
      window.history.pushState({ authGateOverlay: true }, '', window.location.href)
      const handlePopState = () => {
        onBack()
      }
      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    }
  }, [variant, playerId, loading, onBack])

  if (loading) {
    if (loadingTimedOut) {
      return (
        <ErrorBoundary>
          <div className="min-h-screen bg-[var(--color-page-bg)] text-white flex flex-col items-center justify-center p-4 pb-20">
            <div className="text-5xl mb-3">⚠️</div>
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-6 text-center max-w-xs">We couldn&apos;t verify your session. Please try again.</p>
            <button
              onClick={() => {
                setLoadingTimedOut(false)
                window.location.reload()
              }}
              className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors mb-4"
            >
              Try Again
            </button>
            <BackButton label="Go Home" onClick={onBack} />
          </div>
        </ErrorBoundary>
      )
    }
    return <PageLoading />
  }

  if (needsUsername) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[var(--color-page-bg)] text-white p-4 pb-20">
          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <BackButton label="Back" onClick={onBack} />
            </div>
            <ChooseUsername
              userId={needsUsername.userId}
              suggestedName={needsUsername.suggestedName}
              avatarUrl={needsUsername.avatarUrl}
              onAuthComplete={handleUsernameChosen}
            />
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  if (playerId) {
    return <>{children(playerId)}</>
  }

  if (authDismissed) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-[var(--color-page-bg)] text-white flex flex-col items-center justify-center p-4 pb-20">
          {pageEmoji && <div className="text-5xl mb-3">{pageEmoji}</div>}
          <h1 className="text-2xl font-bold mb-4">{pageTitle || ''}</h1>
          <p className="text-slate-400 mb-6">{subtitle || 'Sign in to access this page'}</p>
          <button
            onClick={() => setAuthDismissed(false)}
            className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors mb-4"
          >
            Sign In
          </button>
          <BackButton label="Go Home" onClick={onBack} />
        </div>
      </ErrorBoundary>
    )
  }

  const authForm = (
    <ErrorBoundary>
      <Auth
        onAuthComplete={handleAuthComplete}
        onNeedUsername={hookAuthComplete}
        onClose={handleClose}
        defaultSignup={defaultSignup}
        redirectUrl={redirectUrl}
      />
    </ErrorBoundary>
  )

  if (variant === 'overlay') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm"
        >
          <div className="flex items-center justify-center min-h-full p-4">
            <div className="relative w-full max-w-sm">
              <button
                onClick={onBack}
                className="absolute right-3 top-3 z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                aria-label="Close sign in"
              >
                <span className="text-lg">✕</span>
              </button>
              {authForm}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-page-bg)] text-white pb-20">
        <div className="px-4 pt-4">
          <BackButton label="Back" onClick={onBack} />
        </div>
        {authForm}
      </div>
    </ErrorBoundary>
  )
}
