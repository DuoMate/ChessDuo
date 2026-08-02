'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { App } from '@capacitor/app'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDetailModal } from '@/components/ErrorDetailModal'
import { BackButton } from '@/components/BackButton'
import { Calendar, Star, Crown, BarChart3, Zap, Gamepad2, Ban, Lock, ChevronRight, RefreshCw, Check, Infinity, Brain, ShieldCheck, ArrowRight } from 'lucide-react'
import ChessDuoLogo from '@/components/ChessDuoLogo'
import { PageLoading } from '@/components/PageLoading'
import { SubscriptionService } from '@/features/billing'
import type { SubscriptionPlan, SubscriptionInfo } from '@/features/billing'
import { getAppBaseUrl } from '@/lib/appUrl'

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
  const checkoutPendingRef = useRef(false)
  const router = useRouter()

  const monthlyPlan = plans.find(p => p.billingPeriod === 'monthly')
  const yearlyPlan = plans.find(p => p.billingPeriod === 'yearly')

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const runLoad = useCallback(async () => {
    try {
      let subStatus = await SubscriptionService.getStatus()
      console.log('[PREMIUM] getStatus:', JSON.stringify(subStatus))

      // If not premium, always attempt verification. The API route now
      // auto-resolves the checkout ID from pending_checkout_id in the DB
      // (Creem doesn't template-replace {CHECKOUT_SESSION_ID} in success URLs).
      if (!subStatus.isPremium) {
        console.log('[PREMIUM] Not premium — running verifyCheckoutSession')
        subStatus = await verifyCheckoutSession()
        console.log('[PREMIUM] After verifyCheckoutSession:', JSON.stringify(subStatus))
        if (subStatus.isPremium) {
          checkoutPendingRef.current = false
          router.replace('/premium')
        }
      }

      const subPlans = await SubscriptionService.getPlans()
      if (!mountedRef.current) return
      setStatus(subStatus)
      setIsPremium(subStatus.isPremium)
      setSubscriptionStatus(subStatus.subscriptionStatus)
      setPlans(subPlans)
    } catch {
      if (!mountedRef.current) return
    } finally {
      if (mountedRef.current) {
        setPlansLoading(false)
        setLoading(false)
      }
    }
  }, [router])

  useEffect(() => {
    runLoad()
  }, [runLoad])

  // Mobile: the checkout opens in the external system browser and the deep-link
  // hand-off back to the app (custom scheme / App Link) is not guaranteed. When the
  // user returns to the app after paying, re-run the verification so the
  // "You're Premium!" success screen appears instead of the stale pricing page.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!cap?.isNativePlatform?.()) return

    let removeListener: (() => void) | undefined
    App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (!isActive || !checkoutPendingRef.current) return
      setLoading(true)
      runLoad()
    }).then((handle) => {
      removeListener = handle.remove
    })

    return () => { removeListener?.() }
  }, [runLoad])

  // The API route auto-resolves the checkout ID from pending_checkout_id in the DB.
  // No session_id param is needed — Creem doesn't template-replace success URLs.
  async function verifyCheckoutSession(): Promise<SubscriptionInfo> {
    console.log('[PREMIUM] verify-checkout API call starting')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { AuthService } = await import('@/lib/authService')
      const session = await AuthService.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    } catch { /* falls back to cookie auth */ }

    const res = await fetch(`${getAppBaseUrl()}/api/creem/verify-checkout`, { headers })
    const data = await res.json()
    console.log('[PREMIUM] verify-checkout response:', res.status, JSON.stringify(data))
    if (res.ok && data.verified && data.status) {
      console.log('[PREMIUM] verify-checkout SUCCESS — premium granted')
      SubscriptionService.invalidate()
      return data.status as SubscriptionInfo
    }

    // Not verified yet — the async webhook grant may still be in flight.
    // Invalidate the 30s status cache and poll briefly so a just-delivered
    // webhook grant is picked up without forcing the user to reload.
    console.log('[PREMIUM] Not verified via API, starting webhook poll (up to 5×1.5s)...')
    SubscriptionService.invalidate()
    const attempts = 5
    for (let i = 0; i < attempts; i++) {
      console.log(`[PREMIUM] Poll attempt ${i + 1}/${attempts}`)
      const fresh = await SubscriptionService.getStatus()
      console.log(`[PREMIUM] Poll result:`, JSON.stringify(fresh))
      if (fresh.isPremium) return fresh
      await new Promise(resolve => setTimeout(resolve, 1500))
      SubscriptionService.invalidate()
    }
    console.log('[PREMIUM] Poll exhausted — returning latest status')
    return SubscriptionService.getStatus()
  }

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

      // Checkout opened (new tab on web, external browser on mobile). Flag the
      // pending checkout so a mobile foreground-resume re-runs verification.
      checkoutPendingRef.current = true
      SubscriptionService.invalidate()
      const newStatus = await SubscriptionService.getStatus()
      if (newStatus.isPremium) {
        checkoutPendingRef.current = false
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
    return <PageLoading label="Loading premium..." />
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col pb-20 bg-[var(--color-page-bg)] text-white">
        <div className="flex-1 p-4">
          <div className="max-w-md mx-auto flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BackButton fallbackHref="/profile" alwaysFallback={isPremium} />
                <div className="flex items-center gap-2">
                  <ChessDuoLogo size="md" />
                  <span className="text-2xl font-black text-amber-400">Premium</span>
                </div>
              </div>
            </div>

            {isPremium ? (
              <PremiumSuccess status={status} subscriptionStatus={subscriptionStatus} onGoToProfile={() => router.replace('/profile')} />
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
                    {error}
                  </div>
                )}

                {subscribing ? (
                  <div className="py-12">
                    <PageLoading className="min-h-0 bg-transparent" />
                  </div>
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
                        <div className="flex flex-col items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Calendar size={20} className="text-blue-400" />
                          </div>
                          <div className="text-center">
                            <h3 className="text-lg font-bold text-white">Monthly</h3>
                            <p className="text-xs text-slate-400">Flexible &amp; cancel anytime</p>
                          </div>
                        </div>
                        <div className="mb-4 text-center">
                          {plansLoading ? (
                            <div className="h-10 w-32 bg-slate-700/50 rounded-lg animate-pulse" />
                          ) : (
                            <>
                              <span className="text-3xl font-black text-blue-400">
                                {monthlyPlan?.price || '$1.99'}
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
                    <div className="relative rounded-[24px] border border-emerald-500/30 bg-slate-800/50 p-5 mb-6">
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
                        <div className="flex flex-col items-center gap-3 mb-3 mt-2">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Star size={20} className="text-emerald-400" />
                          </div>
                          <div className="text-center">
                            <h3 className="text-lg font-bold text-white">Annual</h3>
                            <p className="text-xs text-slate-400">Most popular choice</p>
                          </div>
                        </div>
                        <div className="mb-1 text-center">
                          {plansLoading ? (
                            <div className="h-10 w-32 bg-slate-700/50 rounded-lg animate-pulse" />
                          ) : (
                            <>
                              <span className="text-3xl font-black text-emerald-400">
                                {yearlyPlan?.price || '$14.99'}
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

                    {/* Restore */}
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

function PremiumSuccess({
  status,
  subscriptionStatus,
  onGoToProfile,
}: {
  status: SubscriptionInfo | null
  subscriptionStatus: string | null
  onGoToProfile: () => void
}) {
  const isYearly = status?.subscriptionPlan === 'yearly'

  return (
    <div className="flex flex-col flex-1">
      {/* Hero text */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Welcome to Premium!</h1>
        <p className="text-slate-400 text-sm">
          Unlock the best tools.<br />
          Play smarter. Win more.
        </p>
      </div>

      {/* Success card */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="rounded-[28px] border border-slate-700/70 bg-slate-800/50 p-6 sm:p-8 text-center">
          {/* Checkmark */}
          <div className="relative inline-flex mb-5">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.35)]">
              <Check size={40} className="text-white" strokeWidth={3} />
            </div>
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl scale-125" />
          </div>

          {/* Title with laurel leaves */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-blue-400 text-xl">&#127793;</span>
            <h2 className="text-2xl sm:text-3xl font-black text-blue-400">You&apos;re Premium!</h2>
            <span className="text-blue-400 text-xl">&#127793;</span>
          </div>

          {/* Plan pill */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-semibold mb-4">
            {isYearly ? 'Annual Plan' : 'Monthly Plan'}
          </div>

          {/* Description */}
          <p className="text-slate-300 text-sm mb-6 max-w-xs mx-auto">
            Unlimited move insights, AI analysis,<br className="hidden sm:block" />
            and all premium features.
          </p>

          {subscriptionStatus === 'cancelling' && (
            <p className="text-amber-400 text-xs mb-4">
              Your subscription will end at the current billing period.
            </p>
          )}

          {/* Feature grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <FeatureIcon icon={<Infinity size={24} />} title="Unlimited" subtitle="Move Insights" />
            <FeatureIcon icon={<Brain size={24} />} title="AI" subtitle="Analysis" />
            <FeatureIcon icon={<Crown size={24} />} title="All Premium" subtitle="Features" />
            <FeatureIcon icon={<ShieldCheck size={24} />} title="Secure &" subtitle="Protected" />
          </div>

          {/* Secured by Creem */}
          {status?.subscriptionProvider === 'CREEM' && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-2">
              <Lock size={12} />
              <span>Secured by Creem</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA bar */}
      <div className="mt-6 -mx-4 -mb-4 p-4 bg-gradient-to-r from-blue-600 to-blue-500">
        <div className="max-w-md mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white text-sm text-center sm:text-left">
            Thank you for choosing ChessDuo Premium.<br />
            Let&apos;s play smarter and win more, together!
          </p>
          <button
            onClick={onGoToProfile}
            className="flex-shrink-0 px-5 py-3 bg-white text-blue-600 font-bold rounded-xl flex items-center justify-center gap-2 min-h-[44px] hover:bg-blue-50 transition-colors"
          >
            Go to Dashboard
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function FeatureIcon({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-900/40 border border-white/5">
      <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-white text-xs font-semibold leading-tight">{title}</p>
        <p className="text-slate-400 text-[10px] leading-tight">{subtitle}</p>
      </div>
    </div>
  )
}

function BenefitRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-[18px] border border-slate-700/50 bg-slate-800/30">
      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-center">
        <p className="text-white text-sm font-semibold">{title}</p>
        <p className="text-slate-400 text-xs">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
    </div>
  )
}
