'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDetailModal } from '@/components/ErrorDetailModal'
import { BackButton } from '@/components/BackButton'
import { Calendar, Star, Crown, BarChart3, Zap, Gamepad2, Ban, Lock, ChevronRight } from 'lucide-react'

interface ErrorDetail {
  title: string
  message: string
  details?: string
}

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

function getApiBase(): string {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Capacitor) {
    return process.env.NEXT_PUBLIC_SITE_URL || ''
  }
  return ''
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch { /* session unavailable — API route falls back to cookie auth */ }
  return headers
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
  const [checkingPremium, setCheckingPremium] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<ErrorDetail | null>(null)
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
    if (!playerId) {
      setCheckingPremium(false)
      return
    }
    setCheckingPremium(true)
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
        setCheckingPremium(false)
      }).catch(() => {
        if (mountedRef.current) setCheckingPremium(false)
      })
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

      const headers = await getAuthHeaders()
      const res = await fetch(`${getApiBase()}/api/razorpay/create-subscription`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId }),
      })

      const data = await res.json()
      if (data.error) {
        setSubscribing(false)
        setErrorDetail({
          title: 'Subscription Failed',
          message: data.error,
          details: `Status: ${res.status}\nResponse: ${JSON.stringify(data, null, 2)}`,
        })
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
        handler: async function (response: { razorpay_payment_id: string; razorpay_subscription_id: string }) {
          setIsPremium(true)
          setSubscriptionStatus('active')
          // The webhook at /api/razorpay/webhook is the authoritative source for
          // subscription status. We update the DB only when the webhook confirms.
          // The client-side write below is intentionally removed — it was a payment
          // bypass vector. UI state (setIsPremium) is optimistic; the webhook will
          // set is_premium=true server-side within seconds of a successful payment.
          await supabase
            .from('profiles')
            .update({
              rzp_subscription_id: response.razorpay_subscription_id,
              rzp_payment_id: response.razorpay_payment_id,
            })
            .eq('id', playerId)
        },
        prefill: {
          name: 'ChessDuo Player',
          email: '',
        },
        theme: { color: '#F59E0B' },
      })
      rzp.open()
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setErrorDetail({
        title: 'Subscription Failed',
        message: err.message || 'An unexpected error occurred',
        details: err.stack || JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
      })
    } finally {
      setSubscribing(false)
    }
  }, [playerId])

  const handleCancel = useCallback(async () => {
    setCancelling(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${getApiBase()}/api/razorpay/cancel-subscription`, {
        method: 'POST',
        headers,
      })
      const data = await res.json()
      if (data.error) {
        setErrorDetail({
          title: 'Cancel Failed',
          message: data.error,
          details: `Status: ${res.status}\nResponse: ${JSON.stringify(data, null, 2)}`,
        })
      } else {
        setSubscriptionStatus('canceling')
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setErrorDetail({
        title: 'Cancel Failed',
        message: err.message || 'An unexpected error occurred',
        details: err.stack || JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
      })
    } finally {
      setCancelling(false)
    }
  }, [])

  if (loading || checkingPremium) {
    return (
      <div className="flex min-h-screen items-center justify-center pb-20 bg-[#0a0e1a] px-4 py-6">
        <ChessLoader />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col pb-20 bg-[#0a0e1a] text-white">
        <div className="flex-1 p-4">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BackButton />
                <div>
                  <h1 className="text-2xl font-black">
                    <span className="text-white">ChessDuo </span>
                    <span className="text-amber-400">Premium</span>
                  </h1>
                </div>
              </div>
              {/* Golden Crown with Sparkles */}
              <div className="relative">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Crown body */}
                  <path d="M8 44L12 20L22 32L32 16L42 32L52 20L56 44H8Z" fill="url(#crownGradient)" stroke="url(#crownStroke)" strokeWidth="2"/>
                  {/* Crown base */}
                  <rect x="8" y="44" width="48" height="8" rx="2" fill="url(#baseGradient)"/>
                  {/* Jewels */}
                  <circle cx="20" cy="48" r="2" fill="#ef4444"/>
                  <circle cx="32" cy="48" r="2" fill="#3b82f6"/>
                  <circle cx="44" cy="48" r="2" fill="#22c55e"/>
                  {/* Sparkles */}
                  <circle cx="16" cy="14" r="1.5" fill="#fbbf24" className="animate-pulse"/>
                  <circle cx="48" cy="12" r="1" fill="#fbbf24" className="animate-pulse" style={{animationDelay: '0.3s'}}/>
                  <circle cx="52" cy="22" r="1.5" fill="#fbbf24" className="animate-pulse" style={{animationDelay: '0.6s'}}/>
                  <circle cx="12" cy="24" r="1" fill="#fbbf24" className="animate-pulse" style={{animationDelay: '0.9s'}}/>
                  <defs>
                    <linearGradient id="crownGradient" x1="8" y1="16" x2="56" y2="44" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#fbbf24"/>
                      <stop offset="0.5" stopColor="#f59e0b"/>
                      <stop offset="1" stopColor="#d97706"/>
                    </linearGradient>
                    <linearGradient id="crownStroke" x1="8" y1="16" x2="56" y2="44" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#fde68a"/>
                      <stop offset="1" stopColor="#b45309"/>
                    </linearGradient>
                    <linearGradient id="baseGradient" x1="8" y1="44" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#d97706"/>
                      <stop offset="1" stopColor="#92400e"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <p className="text-slate-400 text-sm mb-6">
              Unlock the best tools.<br />
              Play smarter. Win more.
            </p>

            {isPremium ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-6 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h2 className="text-xl font-black text-amber-400 mb-2">You&apos;re Premium!</h2>
                  <p className="text-slate-300 text-sm mb-1">
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
                      className="text-slate-400 hover:text-rose-400 text-sm transition-colors min-h-[44px] px-4 py-2 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
                    {error}
                  </div>
                )}

                {subscribing ? (
                  <ChessLoader />
                ) : (
                  <>
                    {/* Monthly Card */}
                    <div className="relative rounded-[24px] border border-slate-700/70 bg-slate-800/50 p-5 mb-4 overflow-hidden">
                      {/* Chess Pawn Decoration */}
                      <div className="absolute -right-4 -bottom-4 opacity-10">
                        <svg width="120" height="140" viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <ellipse cx="60" cy="130" rx="35" ry="8" fill="#64748b"/>
                          <rect x="40" y="100" width="40" height="30" rx="4" fill="#475569"/>
                          <rect x="45" y="60" width="30" height="45" rx="3" fill="#475569"/>
                          <circle cx="60" cy="40" r="22" fill="#475569"/>
                          <circle cx="60" cy="40" r="18" fill="#334155"/>
                        </svg>
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Calendar size={20} className="text-blue-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">Monthly</h3>
                            <p className="text-xs text-slate-400">Flexible &amp; cancel anytime</p>
                          </div>
                        </div>
                        <div className="mb-4">
                          <span className="text-3xl font-black text-blue-400">₹99</span>
                          <span className="text-slate-400 text-sm ml-2">per month</span>
                        </div>
                        <button
                          onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_RAZORPAY_PLAN_MONTHLY!)}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                        >
                          <Crown size={16} />
                          Subscribe Monthly
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Annual Card */}
                    <div className="relative rounded-[24px] border border-emerald-500/30 bg-slate-800/50 p-5 mb-6 overflow-hidden">
                      {/* Best Value Badge */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                        Best Value
                      </div>
                      {/* Chess Knight Decoration */}
                      <div className="absolute -right-2 -bottom-4 opacity-15">
                        <svg width="110" height="130" viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <ellipse cx="55" cy="122" rx="32" ry="7" fill="#059669"/>
                          <rect x="35" y="95" width="40" height="27" rx="3" fill="#047857"/>
                          <path d="M35 95L30 60C28 45 35 30 50 25L55 23L60 35L70 30L65 50L75 45L70 65L75 95H35Z" fill="#047857"/>
                          <circle cx="45" cy="45" r="3" fill="#0a0e1a"/>
                          <path d="M50 25L55 15L58 25" fill="#047857"/>
                        </svg>
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3 mt-2">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Star size={20} className="text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">Annual</h3>
                            <p className="text-xs text-slate-400">Most popular choice</p>
                          </div>
                        </div>
                        <div className="mb-1">
                          <span className="text-3xl font-black text-emerald-400">₹999</span>
                          <span className="text-slate-400 text-sm ml-2">per year</span>
                        </div>
                        <p className="text-xs text-emerald-400 font-semibold mb-4">₹83.25/mo (save 16%)</p>
                        <button
                          onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ANNUAL!)}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                        >
                          <Crown size={16} />
                          Subscribe Annual
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Premium Benefits */}
                    <div className="text-center mb-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-amber-400">✦</span>
                        <h3 className="text-lg font-bold text-white">Premium Benefits</h3>
                        <span className="text-amber-400">✦</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <BenefitRow icon={<BarChart3 size={18} />} title="Unlimited Move Insights" desc="See why a move won or lost — every turn" />
                      <BenefitRow icon={<Zap size={18} />} title="AI Position Analysis" desc="Stockfish-powered positional breakdown" />
                      <BenefitRow icon={<Gamepad2 size={18} />} title="Advanced Stats" desc="Per-player accuracy trends and comparisons" />
                      <BenefitRow icon={<Ban size={18} />} title="Best Move Suggestions" desc="Engine-recommended alternatives" />
                    </div>

                    <div className="text-center text-xs text-slate-400 space-y-2">
                      <p>3 free insights per account. No payment required to play.</p>
                      <div className="flex items-center justify-center gap-1">
                        <Lock size={12} />
                        Secure payments. Cancel anytime.
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {errorDetail && (
        <ErrorDetailModal
          open={true}
          onClose={() => setErrorDetail(null)}
          title={errorDetail.title}
          message={errorDetail.message}
          details={errorDetail.details}
        />
      )}
    </ErrorBoundary>
  )
}

function BenefitRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-[18px] border border-slate-700/50 bg-slate-800/30">
      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">{title}</p>
        <p className="text-slate-400 text-xs">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
    </div>
  )
}

function ChessLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative mb-6">
        <div className="text-5xl animate-bounce">♞</div>
        <div className="absolute inset-0 bg-amber-400/20 blur-xl rounded-full scale-50 animate-pulse" />
      </div>
      <p className="text-slate-400 text-sm animate-pulse">
        Setting up secure payment...
      </p>
    </div>
  )
}
