'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

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

      const res = await fetch('/api/razorpay/create-subscription', {
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
      const res = await fetch('/api/razorpay/cancel-subscription', {
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">ChessDuo Premium</h1>
            <button
              onClick={() => router.push('/')}
              className="text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 text-sm"
            >
              Home
            </button>
          </div>

          {isPremium ? (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-xl font-bold text-green-400 mb-2">You're Premium!</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
                  Unlimited move insights, AI analysis, and all premium features.
                </p>
                {subscriptionStatus === 'canceling' && (
                  <p className="text-amber-400 text-xs mt-2">
                    Your subscription will end at the current billing period.
                  </p>
                )}
              </div>

              {subscriptionStatus === 'active' && (
                <div className="text-center">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-red-400 border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4 text-center">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="grid gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 border border-yellow-400/30 rounded-lg p-6 text-center hover:border-yellow-400/60 transition-colors">
                  <h3 className="text-lg font-bold mb-1">Monthly</h3>
                  <p className="text-3xl font-bold text-yellow-500 mb-1">₹99</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">per month</p>
                  <button
                    onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_RAZORPAY_PLAN_MONTHLY!)}
                    disabled={subscribing}
                    className="w-full px-6 py-2.5 bg-yellow-500 text-gray-900 text-sm font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                  >
                    {subscribing ? 'Creating...' : 'Subscribe Monthly'}
                  </button>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-yellow-400/30 rounded-lg p-6 text-center hover:border-yellow-400/60 transition-colors relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    Best Value
                  </div>
                  <h3 className="text-lg font-bold mb-1">Annual</h3>
                  <p className="text-3xl font-bold text-yellow-500 mb-1">₹999</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">per year</p>
                  <p className="text-xs text-green-500 mb-4">₹83.25/mo (save 16%)</p>
                  <button
                    onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ANNUAL!)}
                    disabled={subscribing}
                    className="w-full px-6 py-2.5 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50"
                  >
                    {subscribing ? 'Creating...' : 'Subscribe Annual'}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6">
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-4">
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

              <div className="text-center text-xs text-gray-600 dark:text-gray-500">
                3 free insights per account. No payment required to play.
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 text-left p-2 rounded-lg bg-gray-100 dark:bg-gray-700/50">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div>
        <p className="text-gray-900 dark:text-white text-sm font-medium">{title}</p>
        <p className="text-gray-500 text-xs">{desc}</p>
      </div>
    </div>
  )
}
