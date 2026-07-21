import type { BillingProvider, PurchaseResult, SubscriptionPlan, SubscriptionInfo } from './types'
import { transition } from './SubscriptionStateMachine'

const MONTHLY_PRODUCT_ID = 'premium_monthly'
const YEARLY_PRODUCT_ID = 'premium_yearly'

let provider: BillingProvider | null = null
let initialized = false
let cachedStatus: SubscriptionInfo | null = null
let statusCheckedAt = 0
const STATUS_CACHE_MS = 30_000

function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch { /* session unavailable — API route falls back to cookie auth */ }
  return headers
}

async function verifyPurchase(purchaseToken: string, productId: string, orderId: string): Promise<{ success: boolean; state?: string; plan?: string; expiryDate?: string }> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${getApiBase()}/api/subscription/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ purchaseToken, productId, orderId }),
    })
    const data = await res.json()
    if (res.ok && data.success) {
      return { success: true, state: data.state, plan: data.plan, expiryDate: data.expiryDate }
    }
    return { success: false }
  } catch {
    return { success: false }
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchServerStatus(): Promise<SubscriptionInfo> {
  try {
    const headers = await getAuthHeaders()
    const res = await fetchWithTimeout(`${getApiBase()}/api/subscription/status`, { headers })
    if (res.ok) {
      const data = await res.json() as SubscriptionInfo
      return data
    }
    if (res.status === 401) {
      const retryHeaders = await getAuthHeaders()
      const retryRes = await fetchWithTimeout(`${getApiBase()}/api/subscription/status`, { headers: retryHeaders })
      if (retryRes.ok) {
        return retryRes.json() as Promise<SubscriptionInfo>
      }
    }
  } catch { /* network error or timeout — use cached */ }
  return getDefaultStatus()
}

function getDefaultStatus(): SubscriptionInfo {
  return {
    isPremium: false,
    subscriptionProvider: null,
    subscriptionPlan: null,
    purchaseToken: null,
    subscriptionExpiryDate: null,
    autoRenewStatus: false,
    purchaseState: null,
    lastVerifiedDate: null,
    subscriptionStatus: null,
  }
}

export const SubscriptionService = {
  setProvider(p: BillingProvider): void {
    provider = p
  },

  async initialize(): Promise<void> {
    if (initialized) return
    initialized = true

    if (!provider) return

    try {
      await provider.initialize()
    } catch { /* billing unavailable on this platform */ }

    cachedStatus = await fetchServerStatus()
    statusCheckedAt = Date.now()

    if (!cachedStatus.isPremium) {
      const restored = await provider.restorePurchases()
      for (const r of restored) {
        if (r.success && r.purchaseToken && r.productId) {
          await verifyPurchase(r.purchaseToken, r.productId, r.orderId || '')
        }
      }
      cachedStatus = await fetchServerStatus()
      statusCheckedAt = Date.now()
    }
  },

  async purchaseMonthly(): Promise<PurchaseResult> {
    if (!provider) return { success: false, error: 'Billing not available', errorDetail: 'unknown' }
    return this._purchase(MONTHLY_PRODUCT_ID)
  },

  async purchaseYearly(): Promise<PurchaseResult> {
    if (!provider) return { success: false, error: 'Billing not available', errorDetail: 'unknown' }
    return this._purchase(YEARLY_PRODUCT_ID)
  },

  async _purchase(productId: string): Promise<PurchaseResult> {
    if (!provider) return { success: false, error: 'Billing not available', errorDetail: 'unknown' }

    const result = await provider.purchase(productId)
    if (!result.success || !result.purchaseToken) return result

    const verifyResult = await verifyPurchase(result.purchaseToken, result.productId || productId, result.orderId || '')
    if (!verifyResult.success) {
      return { success: false, error: 'Purchase verified but server confirmation failed. Your subscription will be restored on next launch.', errorDetail: 'verification' }
    }

    cachedStatus = null
    return { success: true, productId: result.productId, orderId: result.orderId }
  },

  async restore(): Promise<boolean> {
    if (!provider) return false
    const restored = await provider.restorePurchases()
    if (restored.length === 0) return false

    let anyVerified = false
    for (const r of restored) {
      if (r.success && r.purchaseToken && r.productId) {
        const verified = await verifyPurchase(r.purchaseToken, r.productId, r.orderId || '')
        if (verified.success) anyVerified = true
      }
    }

    if (anyVerified) {
      cachedStatus = null
      statusCheckedAt = 0
      await this.isPremium()
    }

    return anyVerified
  },

  async isPremium(): Promise<boolean> {
    const now = Date.now()
    if (cachedStatus && (now - statusCheckedAt) < STATUS_CACHE_MS) {
      return cachedStatus.isPremium
    }

    cachedStatus = await fetchServerStatus()
    statusCheckedAt = now
    return cachedStatus.isPremium
  },

  async getPlans(): Promise<SubscriptionPlan[]> {
    if (!provider) {
      return [
        {
          productId: MONTHLY_PRODUCT_ID,
          title: 'Monthly',
          subtitle: 'Flexible & cancel anytime',
          price: 'Price unavailable',
          description: 'Monthly premium subscription',
          billingPeriod: 'monthly',
        },
        {
          productId: YEARLY_PRODUCT_ID,
          title: 'Annual',
          subtitle: 'Most popular choice',
          price: 'Price unavailable',
          description: 'Annual premium subscription',
          billingPeriod: 'yearly',
        },
      ]
    }

    try {
      return await provider.queryProductDetails([MONTHLY_PRODUCT_ID, YEARLY_PRODUCT_ID])
    } catch {
      return []
    }
  },

  async getStatus(): Promise<SubscriptionInfo> {
    if (cachedStatus && (Date.now() - statusCheckedAt) < STATUS_CACHE_MS) {
      return cachedStatus
    }
    cachedStatus = await fetchServerStatus()
    statusCheckedAt = Date.now()
    return cachedStatus
  },
}
