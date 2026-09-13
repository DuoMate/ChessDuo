'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDetailModal } from '@/components/ErrorDetailModal'
import { BackButton } from '@/components/BackButton'
import { Crown, BarChart3, Zap, Gamepad2, Ban, ChevronRight, RefreshCw, Check, Infinity, Brain, ShieldCheck, ArrowRight, Smartphone, ExternalLink } from 'lucide-react'
import ChessDuoLogo from '@/components/ChessDuoLogo'
import { PageLoading } from '@/components/PageLoading'
import { SubscriptionService } from '@/features/billing'
import type { SubscriptionPlan, SubscriptionInfo } from '@/features/billing'
import { PREMIUM_PURCHASE_SAFETY_NET_MS } from '@/features/shared/gameConstants'

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
  const [isNative, setIsNative] = useState(false)
  const mountedRef = useRef(true)
  // True while a native purchase is in flight. Lets the app-resume handler
  // recover when the Play sheet returns without the bridge promise settling.
  const purchasePendingRef = useRef(false)
  const router = useRouter()

  const monthlyPlan = plans.find(p => p.billingPeriod === 'monthly')
  const yearlyPlan = plans.find(p => p.billingPeriod === 'yearly')

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  useEffect(() => {
    try {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      if (cap?.isNativePlatform?.()) setIsNative(true)
    } catch { /* web */ }
  }, [])

  const runLoad = useCallback(async () => {
    try {
      const subStatus = await SubscriptionService.getStatus()
      const subPlans = await SubscriptionService.getPlans()
      if (!mountedRef.current) return
      setStatus(subStatus)
      setIsPremium(subStatus.isPremium)
      setSubscriptionStatus(subStatus.subscriptionStatus)
      setPlans(subPlans)
    } catch {
      if (!mountedRef.current) return
    } finally {
      if (mountedRef.current) { setPlansLoading(false); setLoading(false) }
    }
  }, [])

  useEffect(() => { runLoad() }, [runLoad])

  // Native only: if the Google Play sheet backgrounds the app and the
  // purchase bridge never settles, re-check entitlement on foreground.
  // Only ever resolves *toward* premium (confirmed grant); every other
  // outcome is left to the in-flight purchase flow so a later cancel/error
  // can never be overwritten by this handler.
  useEffect(() => {
    let handle: { remove: () => void } | null = null
    let cancelled = false
    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        const { App } = await import('@capacitor/app')
        if (cancelled) return
        handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive || !purchasePendingRef.current || !mountedRef.current) return
          SubscriptionService.invalidate()
          SubscriptionService.getStatus().then((resumedStatus) => {
            if (!mountedRef.current || !purchasePendingRef.current) return
            if (resumedStatus.isPremium) {
              purchasePendingRef.current = false
              setIsPremium(true)
              setSubscriptionStatus('active')
              setStatus(resumedStatus)
              setSubscribing(false)
            }
          }).catch(() => { /* leave the in-flight flow to report */ })
        })
      } catch { /* web or App plugin unavailable — no-op */ }
    })()
    return () => { cancelled = true; handle?.remove() }
  }, [])

  const handleSubscribe = useCallback(async (productId: string) => {
    setSubscribing(true)
    setError(null)
    purchasePendingRef.current = true
    // Safety net + DEBUG POPUP: every settled path below reports its real stage/code.
    // For sideload triage we force a 12s debug timeout (prod is 30s) so the
    // hang reason surfaces quickly without logcat. Never hides underlying error.
    // TODO: DEBUG POPUP - restore PREMIUM_PURCHASE_SAFETY_NET_MS after triage
    const DEBUG_SAFETY_NET_MS = 12000
    let safetyNet: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      safetyNet = null
      if (mountedRef.current) {
        const timeoutMsg = 'Google Play purchase timed out. Please check your Google Play account and try again.'
        setSubscribing(false)
        purchasePendingRef.current = false
        setError(timeoutMsg)
        setErrorDetail({ title: 'Purchase Timeout', message: timeoutMsg, details: `productId=${productId} stage=safety_net code=timeout timeoutMs=${DEBUG_SAFETY_NET_MS} (bridge hang - plugin did not settle)` })
      }
    }, DEBUG_SAFETY_NET_MS)
    const clearSafetyNet = () => {
      if (safetyNet) { clearTimeout(safetyNet); safetyNet = null }
    }
    try {
      const result = productId.includes('yearly')
        ? await SubscriptionService.purchaseYearly()
        : await SubscriptionService.purchaseMonthly()

      if (!mountedRef.current) return
      if (!result.success) {
        // TODO: DEBUG POPUP - remove setErrorDetail after triage
        const detailBase = `productId=${productId} code=${result.errorDetail ?? 'unknown'}`
        if (result.errorDetail === 'cancelled') {
          const msg = 'Purchase cancelled. You can try again anytime.'
          setError(msg)
          setErrorDetail({ title: 'Purchase Cancelled', message: msg, details: `${detailBase} stage=purchase` })
        } else if (result.errorDetail === 'already_owned') {
          try {
            await SubscriptionService.restore()
            const newStatus = await SubscriptionService.getStatus()
            if (!mountedRef.current) return
            if (newStatus.isPremium) { setIsPremium(true); setSubscriptionStatus('active'); setStatus(newStatus) }
            else {
              const msg = 'Your existing subscription was found but could not be activated. Please try Restore Purchases.'
              setError(msg)
              setErrorDetail({ title: 'Already Owned', message: msg, details: `${detailBase} stage=restore` })
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            const errMsg = 'Your existing subscription was found but could not be activated. Please try Restore Purchases.'
            setError(errMsg)
            setErrorDetail({ title: 'Already Owned - Restore Failed', message: errMsg, details: `${detailBase} stage=restore error=${msg}` })
          }
        } else if (result.errorDetail === 'billing_unavailable') {
          const msg = 'Google Play Billing is not available on this device or account.'
          setError(msg)
          setErrorDetail({ title: 'Billing Unavailable', message: result.error || msg, details: `${detailBase} stage=purchase` })
        } else if (result.errorDetail === 'product_unavailable') {
          const msg = 'This subscription is not available for your account or region right now.'
          setError(msg)
          setErrorDetail({ title: 'Product Unavailable', message: result.error || msg, details: `${detailBase} stage=purchase` })
        } else if (result.errorDetail === 'network') {
          const msg = 'Network error. Please check your connection and try again.'
          setError(msg)
          setErrorDetail({ title: 'Network Error', message: result.error || msg, details: `${detailBase} stage=purchase` })
        } else if (result.errorDetail === 'verification') {
          const msg = result.error || 'Purchase could not be verified. Please try again.'
          setError(msg)
          setErrorDetail({ title: 'Verification Failed', message: msg, details: `${detailBase} stage=verification` })
        } else {
          const msg = result.error || 'Google Play purchase could not be started. Please check your Google Play account and try again.'
          setError(msg)
          setErrorDetail({ title: 'Purchase Failed', message: msg, details: `${detailBase} stage=purchase` })
        }
        return
      }

      SubscriptionService.invalidate()
      const newStatus = await SubscriptionService.getStatus()
      if (!mountedRef.current) return
      if (newStatus.isPremium) { setIsPremium(true); setSubscriptionStatus('active'); setStatus(newStatus) }
      else {
        // Verified but status not yet refreshed — one bounded retry before
        // surfacing a message (never an endless poll).
        await new Promise(resolve => setTimeout(resolve, 1500))
        SubscriptionService.invalidate()
        const retryStatus = await SubscriptionService.getStatus()
        if (!mountedRef.current) return
        if (retryStatus.isPremium) { setIsPremium(true); setSubscriptionStatus('active'); setStatus(retryStatus) }
        else {
          const msg = 'Purchase verified. Your premium status is refreshing — reopen this screen shortly.'
          setError(msg)
          // TODO: DEBUG POPUP - remove after triage
          setErrorDetail({ title: 'Premium Refresh Pending', message: msg, details: `productId=${productId} stage=entitlement code=refresh_pending` })
        }
      }
    } catch (e: unknown) {
      if (!mountedRef.current) return
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err.message || 'An unexpected error occurred')
      setErrorDetail({ title: 'Purchase Failed', message: err.message || 'An unexpected error occurred', details: `productId=${productId} stage=catch error=${err.message} stack=${(err.stack || '').slice(0, 800)}` })
    } finally {
      clearSafetyNet()
      purchasePendingRef.current = false
      if (mountedRef.current) setSubscribing(false)
    }
  }, [])

  const handleRestore = useCallback(async () => {
    setRestoring(true)
    setError(null)
    try {
      const restored = await SubscriptionService.restore()
      if (restored) {
        const newStatus = await SubscriptionService.getStatus()
        if (newStatus.isPremium) { setIsPremium(true); setSubscriptionStatus('active'); setStatus(newStatus) }
      } else {
        setError('No active subscriptions found. Start a new subscription to unlock Premium.')
      }
    } catch {
      setError('Failed to restore purchases. Please try again.')
    } finally {
      setRestoring(false)
    }
  }, [])

  if (loading) return <PageLoading label="Loading premium..." />

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col pb-20 bg-[var(--color-page-bg)] text-white">
        <div className="flex-1 p-4">
          <div className="max-w-md mx-auto flex flex-col h-full">
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
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">{error}</div>
                )}

                {subscribing ? (
                  <div className="py-12">
                    <PageLoading className="min-h-0 bg-transparent" />
                    <p className="text-center text-xs text-slate-400 mt-3">Contacting Google Play…</p>
                    {error && <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">{error}</div>}
                  </div>
                ) : isNative ? (
                  <>
                    {/* Native pricing cards */}
                    {!plansLoading && plans.length === 0 && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm text-center">Premium products could not be loaded from Google Play. Please check your Google Play account and region, then retry.</div>
                    )}
                    <div className="relative rounded-[24px] border border-slate-700/70 bg-slate-800/50 p-5 mb-4 overflow-hidden">
                      <div className="relative z-10">
                        <div className="flex flex-col items-center gap-3 mb-3">
                          <h3 className="text-lg font-bold text-white">Monthly</h3>
                          <p className="text-xs text-slate-400">Flexible &amp; cancel anytime</p>
                        </div>
                        <div className="mb-4 text-center">
                          {plansLoading ? (
                            <div className="h-10 w-32 bg-slate-700/50 rounded-lg animate-pulse mx-auto" />
                          ) : (
                            <span className="text-3xl font-black text-blue-400">
                              {monthlyPlan?.price || '$1.99'}
                            </span>
                          )}
                          <span className="text-slate-400 text-sm ml-2">per month</span>
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

                    <div className="relative rounded-[24px] border border-emerald-500/30 bg-slate-800/50 p-5 mb-6">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-bold">Best Value</div>
                      <div className="relative z-10">
                        <div className="flex flex-col items-center gap-3 mb-3 mt-2">
                          <h3 className="text-lg font-bold text-white">Annual</h3>
                          <p className="text-xs text-slate-400">Most popular choice</p>
                        </div>
                        <div className="mb-1 text-center">
                          {plansLoading ? (
                            <div className="h-10 w-32 bg-slate-700/50 rounded-lg animate-pulse mx-auto" />
                          ) : (
                            <span className="text-3xl font-black text-emerald-400">
                              {yearlyPlan?.price || '$14.99'}
                            </span>
                          )}
                          <span className="text-slate-400 text-sm ml-2">per year</span>
                        </div>
                        {!plansLoading && yearlyPlan && (
                          <p className="text-xs text-emerald-400 font-semibold mb-4">Save with annual billing</p>
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
                  </>
                ) : (
                  /* Web: download app CTA */
                  <div className="rounded-[24px] border border-slate-700/70 bg-slate-800/50 p-6 mb-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                      <Smartphone size={28} className="text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Premium on Android</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                      Premium subscriptions are available exclusively on the ChessDuo Android app. Download it from Google Play to unlock all premium features.
                    </p>
                    <a
                      href="https://play.google.com/store/apps/details?id=com.navron.chessduo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors min-h-[44px]"
                    >
                      <ExternalLink size={16} />
                      Download on Google Play
                    </a>
                  </div>
                )}

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

                {/* Restore (native only) */}
                {isNative && (
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
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {errorDetail && (
        <ErrorDetailModal open={true} onClose={() => setErrorDetail(null)} title={errorDetail.title} message={errorDetail.message} details={errorDetail.details} />
      )}
    </ErrorBoundary>
  )
}

function PremiumSuccess({
  status, subscriptionStatus, onGoToProfile,
}: {
  status: SubscriptionInfo | null
  subscriptionStatus: string | null
  onGoToProfile: () => void
}) {
  const isYearly = status?.subscriptionPlan === 'yearly'

  return (
    <div className="flex flex-col flex-1">
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Welcome to Premium!</h1>
        <p className="text-slate-400 text-sm">Unlock the best tools.<br />Play smarter. Win more.</p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="rounded-[28px] border border-slate-700/70 bg-slate-800/50 p-6 sm:p-8 text-center">
          <div className="relative inline-flex mb-5">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.35)]">
              <Check size={40} className="text-white" strokeWidth={3} />
            </div>
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl scale-125" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-blue-400 text-xl">&#127793;</span>
            <h2 className="text-2xl sm:text-3xl font-black text-blue-400">You&apos;re Premium!</h2>
            <span className="text-blue-400 text-xl">&#127793;</span>
          </div>

          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-semibold mb-4">
            {isYearly ? 'Annual Plan' : 'Monthly Plan'}
          </div>

          <p className="text-slate-300 text-sm mb-6 max-w-xs mx-auto">
            Unlimited move insights, AI analysis,<br className="hidden sm:block" />
            and all premium features.
          </p>

          {subscriptionStatus === 'cancelling' && (
            <p className="text-amber-400 text-xs mb-4">Your subscription will end at the current billing period.</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <FeatureIcon icon={<Infinity size={24} />} title="Unlimited" subtitle="Move Insights" />
            <FeatureIcon icon={<Brain size={24} />} title="AI" subtitle="Analysis" />
            <FeatureIcon icon={<Crown size={24} />} title="All Premium" subtitle="Features" />
            <FeatureIcon icon={<ShieldCheck size={24} />} title="Secure &" subtitle="Protected" />
          </div>

          {status?.subscriptionProvider === 'GOOGLE_PLAY' && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-2">
              <ShieldCheck size={12} />
              <span>Secured by Google Play</span>
            </div>
          )}
        </div>
      </div>

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
      <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">{icon}</div>
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
      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400">{icon}</div>
      <div className="flex-1 min-w-0 text-center">
        <p className="text-white text-sm font-semibold">{title}</p>
        <p className="text-slate-400 text-xs">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-slate-500 flex-shrink-0" />
    </div>
  )
}
