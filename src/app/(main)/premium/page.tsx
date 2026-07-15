'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDetailModal } from '@/components/ErrorDetailModal'
import { BackButton } from '@/components/BackButton'
import { Calendar, Star, Crown, BarChart3, Zap, Gamepad2, Ban, Lock, ChevronRight, RefreshCw } from 'lucide-react'
import { SubscriptionService } from '@/features/billing'
import type { SubscriptionPlan, SubscriptionInfo } from '@/features/billing'

interface ErrorDetail {
  title: string
  message: string
  details?: string
}

export default function PremiumPage() {
  const [isPremium, setIsPremium] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<ErrorDetail | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [status, setStatus] = useState<SubscriptionInfo | null>(null)
  const mountedRef = useRef(true)

  const monthlyPlan = plans.find(p => p.billingPeriod === 'monthly')
  const yearlyPlan = plans.find(p => p.billingPeriod === 'yearly')

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    Promise.all([
      SubscriptionService.getStatus(),
      SubscriptionService.getPlans(),
    ]).then(([subStatus, subPlans]) => {
      if (!mountedRef.current) return
      setStatus(subStatus)
      setIsPremium(subStatus.isPremium)
      setSubscriptionStatus(subStatus.subscriptionStatus)
      setPlans(subPlans)
      setPlansLoading(false)
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setPlansLoading(false)
      setLoading(false)
    })
  }, [])

  const handleSubscribe = useCallback(async (productId: string) => {
    setSubscribing(true)
    setError(null)

    try {
      const result = productId.includes('yearly')
        ? await SubscriptionService.purchaseYearly()
        : await SubscriptionService.purchaseMonthly()

      if (!result.success) {
        if (result.errorDetail === 'cancelled') {
          setError('Purchase cancelled. You can try again anytime.')
        } else if (result.errorDetail === 'already_owned') {
          await SubscriptionService.restore()
          const newStatus = await SubscriptionService.getStatus()
          if (newStatus.isPremium) {
            setIsPremium(true)
            setSubscriptionStatus('active')
            setStatus(newStatus)
          }
        } else if (result.errorDetail === 'verification') {
          setError(result.error || 'Purchase succeeded but verification is pending. Premium features will activate shortly.')
        } else {
          setError(result.error || 'Purchase failed. Please try again.')
        }
        return
      }

      const newStatus = await SubscriptionService.getStatus()
      if (newStatus.isPremium) {
        setIsPremium(true)
        setSubscriptionStatus('active')
        setStatus(newStatus)
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      setErrorDetail({
        title: 'Purchase Failed',
        message: err.message || 'An unexpected error occurred',
        details: err.stack || JSON.stringify(err),
      })
    } finally {
      setSubscribing(false)
    }
  }, [])

  const handleRestore = useCallback(async () => {
    setRestoring(true)
    setError(null)
    try {
      const restored = await SubscriptionService.restore()
      if (restored) {
        const newStatus = await SubscriptionService.getStatus()
        if (newStatus.isPremium) {
          setIsPremium(true)
          setSubscriptionStatus('active')
          setStatus(newStatus)
        }
      } else {
        setError('No active subscriptions found. Start a new subscription to unlock Premium.')
      }
    } catch {
      setError('Failed to restore purchases. Please try again.')
    } finally {
      setRestoring(false)
    }
  }, [])

  if (loading) {
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
              <div className="relative">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 44L12 20L22 32L32 16L42 32L52 20L56 44H8Z" fill="url(#crownGradient)" stroke="url(#crownStroke)" strokeWidth="2"/>
                  <rect x="8" y="44" width="48" height="8" rx="2" fill="url(#baseGradient)"/>
                  <circle cx="20" cy="48" r="2" fill="#ef4444"/>
                  <circle cx="32" cy="48" r="2" fill="#3b82f6"/>
                  <circle cx="44" cy="48" r="2" fill="#22c55e"/>
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
                    {status?.subscriptionPlan === 'yearly' ? 'Annual plan — ' : 'Monthly plan — '}
                    Unlimited move insights, AI analysis, and all premium features.
                  </p>
                  {subscriptionStatus === 'cancelling' && (
                    <p className="text-amber-400 text-xs mt-2">
                      Your subscription will end at the current billing period.
                    </p>
                  )}
                  {status?.subscriptionProvider === 'GOOGLE_PLAY' && (
                    <p className="text-slate-500 text-xs mt-3 flex items-center justify-center gap-1">
                      <Lock size={10} />
                      Managed by Google Play
                    </p>
                  )}
                </div>
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
                          {plansLoading ? (
                            <div className="h-10 w-32 bg-slate-700/50 rounded-lg animate-pulse" />
                          ) : (
                            <>
                              <span className="text-3xl font-black text-blue-400">
                                {monthlyPlan?.price || '\u20B999'}
                              </span>
                              <span className="text-slate-400 text-sm ml-2">per month</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handleSubscribe('premium_monthly')}
                          disabled={plansLoading}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
                        >
                          <Crown size={16} />
                          Upgrade to Premium
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Annual Card */}
                    <div className="relative rounded-[24px] border border-emerald-500/30 bg-slate-800/50 p-5 mb-6 overflow-hidden">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                        Best Value
                      </div>
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
                          {plansLoading ? (
                            <div className="h-10 w-32 bg-slate-700/50 rounded-lg animate-pulse" />
                          ) : (
                            <>
                              <span className="text-3xl font-black text-emerald-400">
                                {yearlyPlan?.price || '\u20B9999'}
                              </span>
                              <span className="text-slate-400 text-sm ml-2">per year</span>
                            </>
                          )}
                        </div>
                        {!plansLoading && yearlyPlan && (
                          <p className="text-xs text-emerald-400 font-semibold mb-4">
                            Save with annual billing
                          </p>
                        )}
                        <button
                          onClick={() => handleSubscribe('premium_yearly')}
                          disabled={plansLoading}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
                        >
                          <Crown size={16} />
                          Upgrade to Premium
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

                    {/* Restore + Managed by Google */}
                    <div className="text-center text-xs text-slate-400 space-y-2">
                      <p>3 free insights per account. No payment required to play.</p>
                      <button
                        onClick={handleRestore}
                        disabled={restoring}
                        className="text-blue-400 hover:text-blue-300 transition-colors min-h-[44px] px-4 py-2 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={restoring ? 'animate-spin' : ''} />
                        {restoring ? 'Restoring...' : 'Restore Purchases'}
                      </button>
                      <div className="flex items-center justify-center gap-1">
                        <Lock size={12} />
                        Managed by Google Play
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
        Loading premium...
      </p>
    </div>
  )
}
