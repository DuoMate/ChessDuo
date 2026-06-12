'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

function getApiBase(): string {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Capacitor) {
    return process.env.NEXT_PUBLIC_SITE_URL || ''
  }
  return ''
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser'))
      return
    }
    if ((window as unknown as Record<string, unknown>).Razorpay) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'))
    document.head.appendChild(script)
  })
}

export default function PremiumPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then((result) => {
      if (!mountedRef.current) return
      const session = result.data.session
      if (session?.user) {
        setPlayerId(session.user.id)
      }
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!playerId) return
    supabase
      .from('profiles')
      .select('is_premium, subscription_status')
      .eq('id', playerId)
      .maybeSingle()
      .then((result) => {
        if (!mountedRef.current) return
        const data = result.data
        if (data?.is_premium) setIsPremium(true)
        if (data?.subscription_status) setSubscriptionStatus(data.subscription_status)
      }).catch(() => {})
  }, [playerId])

  const handleSubscribe = useCallback(async (planId: string) => {
    if (!playerId) {
      setError('Please sign in to subscribe')
      return
    }
    setSubscribing(true)
    setError(null)

    try {
      await loadRazorpayScript()

      const res = await fetch(`${getApiBase()}/api/razorpay/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setSubscribing(false)
        return
      }

      const Razorpay = (window as unknown as { Razorpay?: new (options: { key: string; subscription_id: string; name: string; description: string; handler: (response: { razorpay_payment_id: string; razorpay_subscription_id: string }) => void; prefill: { name: string; email: string }; theme: { color: string } }) => { open: () => void } }).Razorpay
      if (!Razorpay) {
        setError('Razorpay checkout failed to load. Please refresh and try again.')
        setSubscribing(false)
        return
      }

      const rzp = new Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: 'ChessDuo Premium',
        description: 'Unlimited move insights & AI analysis',
        handler: function () {
          setIsPremium(true)
          setSubscriptionStatus('active')
        },
        prefill: {
          name: 'ChessDuo Player',
          email: '',
        },
        theme: { color: '#F59E0B' },
      })
      rzp.open()
    } catch {
      setError('Failed to create subscription')
    } finally {
      setSubscribing(false)
    }
  }, [playerId])

  const handleCancel = useCallback(async () => {
    setCancelling(true)
    setError(null)

    try {
      const res = await fetch(`${getApiBase()}/api/razorpay/cancel-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSubscriptionStatus('canceling')
      }
    } catch {
      setError('Failed to cancel subscription')
    } finally {
      setCancelling(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f1119] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white dark:bg-[#0f1119] text-gray-900 dark:text-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-black text-yellow-600 dark:text-yellow-400 tracking-wider">ChessDuo Premium</h1>
              <button
                onClick={() => router.push('/')}
                className="text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors min-h-[44px] px-4 py-2 font-medium"
              >
                Home
              </button>
            </div>

            {isPremium ? (
              <div className="space-y-4">
                <div className="bg-white dark:bg-white/[0.03] border-2 border-yellow-300 dark:border-yellow-500/20 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h2 className="text-xl font-black text-yellow-600 dark:text-yellow-400 mb-2">You&apos;re Premium!</h2>
                  <p className="text-gray-700 dark:text-gray-400 text-sm mb-1 font-medium">
                    Unlimited move insights, AI analysis, and all premium features.
                  </p>
                  {subscriptionStatus === 'canceling' && (
                    <p className="text-amber-500 dark:text-amber-400 text-xs mt-2 font-medium">
                      Your subscription will end at the current billing period.
                    </p>
                  )}
                </div>

                {subscriptionStatus === 'active' && (
                  <div className="text-center">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="text-gray-700 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-sm transition-colors min-h-[44px] px-4 py-2 font-medium disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-100 dark:bg-red-500/10 border-2 border-red-300 dark:border-red-500/20 text-red-700 dark:text-red-400 text-sm text-center font-medium">
                    {error}
                  </div>
                )}

                <div className="grid gap-4 mb-6">
                  <div className="bg-white dark:bg-white/[0.03] border-2 border-gray-200 dark:border-white/8 rounded-2xl p-6 text-center hover:border-yellow-400 dark:hover:border-yellow-500/40 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(250,204,21,0.08)] transition-all">
                    <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Monthly</h3>
                    <p className="text-3xl font-black text-yellow-500 mb-1">₹99</p>
                    <p className="text-xs text-gray-700 dark:text-gray-400 font-medium mb-4">per month</p>
                    <button
                      onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_RAZORPAY_PLAN_MONTHLY!)}
                      disabled={subscribing}
                      className="w-full px-10 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-xl transition-colors shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.15)] disabled:opacity-50 min-h-[44px]"
                    >
                      {subscribing ? 'Creating...' : 'Subscribe Monthly'}
                    </button>
                  </div>

                  <div className="bg-white dark:bg-white/[0.03] border-2 border-yellow-300 dark:border-yellow-500/20 rounded-2xl p-6 text-center hover:border-yellow-400 dark:hover:border-yellow-500/40 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(250,204,21,0.08)] transition-all relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-gray-900 text-xs px-2 py-0.5 rounded-full font-bold">
                      Best Value
                    </div>
                    <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Annual</h3>
                    <p className="text-3xl font-black text-yellow-500 mb-1">₹999</p>
                    <p className="text-xs text-gray-700 dark:text-gray-400 font-medium mb-1">per year</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold mb-4">₹83.25/mo (save 16%)</p>
                    <button
                      onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ANNUAL!)}
                      disabled={subscribing}
                      className="w-full px-10 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-xl transition-colors shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.15)] disabled:opacity-50 min-h-[44px]"
                    >
                      {subscribing ? 'Creating...' : 'Subscribe Annual'}
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-white/[0.03] border-2 border-gray-200 dark:border-white/8 rounded-2xl p-6">
                  <p className="text-gray-700 dark:text-gray-400 text-sm text-center mb-4 font-medium">
                    Unlock powerful move analysis for every game
                  </p>
                  <div className="grid gap-3">
                    <FeatureRow icon="🔍" title="Unlimited Move Insights" desc="See why a move won or lost — every turn" />
                    <FeatureRow icon="🤖" title="AI Position Analysis" desc="Stockfish-powered positional breakdown" />
                    <FeatureRow icon="📊" title="Advanced Stats" desc="Per-player accuracy trends and comparisons" />
                    <FeatureRow icon="🎯" title="Best Move Suggestions" desc="Engine-recommended alternatives" />
                    <FeatureRow icon="♾️" title="No Reveal Limits" desc="Unlimited insights, every game" />
                  </div>
                </div>

                <div className="text-center text-xs text-gray-700 dark:text-gray-400 font-medium">
                  3 free insights per account. No payment required to play.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 text-left p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border-2 border-gray-200 dark:border-white/[0.04]">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div>
        <p className="text-gray-900 dark:text-white text-sm font-semibold">{title}</p>
        <p className="text-gray-700 dark:text-gray-400 text-xs font-medium">{desc}</p>
      </div>
    </div>
  )
}
