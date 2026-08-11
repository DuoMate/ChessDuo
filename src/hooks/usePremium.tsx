'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { SubscriptionService } from '@/features/billing'
import { RealtimeService } from '@/lib/realtimeService'
import { AuthService } from '@/lib/authService'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface PremiumContextValue {
  isPremium: boolean
  loading: boolean
}

const PremiumContext = createContext<PremiumContextValue>({ isPremium: false, loading: true })

export function usePremium() {
  return useContext(PremiumContext)
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const checkingRef = useRef(false)

  const checkPremium = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    try {
      const session = await AuthService.getSession()
      if (!session?.user) {
        setIsPremium(false)
        setLoading(false)
        return
      }
      const premium = await SubscriptionService.isPremium()
      setIsPremium(premium)
      setLoading(false)
    } catch {
      setLoading(false)
    } finally {
      checkingRef.current = false
    }
  }, [])

  useEffect(() => {
    const unsubAuth = AuthService.onAuthChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setLoading(true)
        checkPremium()
      }
      if (event === 'SIGNED_OUT') {
        setIsPremium(false)
        setLoading(false)
      }
    })

    return () => {
      unsubAuth()
    }
  }, [checkPremium])

  useEffect(() => {
    let channel: RealtimeChannel | null = null

    AuthService.getSession().then(session => {
      if (!session?.user) return
      channel = RealtimeService.subscribeToTable(
        'profiles',
        'UPDATE',
        `id=eq.${session.user.id}`,
        (payload: { new: { is_premium?: boolean } }) => {
          const newPremium = payload.new?.is_premium
          if (typeof newPremium === 'boolean' && newPremium !== isPremium) {
            SubscriptionService.invalidate()
            setIsPremium(newPremium)
          }
        },
      )
    }).catch(() => {})

    return () => {
      if (channel) {
        RealtimeService.cleanupChannel(channel)
      }
    }
  }, [isPremium])

  return (
    <PremiumContext.Provider value={{ isPremium, loading }}>
      {children}
    </PremiumContext.Provider>
  )
}
