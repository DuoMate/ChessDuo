import type { BillingProvider, PurchaseResult, SubscriptionPlan, SubscriptionInfo } from './types'
import { getAppBaseUrl } from '@/lib/appUrl'
import {
  BILLING_AUTH_TIMEOUT_MS,
  BILLING_VERIFY_TIMEOUT_MS,
  PREMIUM_MONTHLY_PRODUCT_ID,
  PREMIUM_YEARLY_PRODUCT_ID,
} from '@/features/shared/gameConstants'

const MONTHLY_PRODUCT_ID = PREMIUM_MONTHLY_PRODUCT_ID
const YEARLY_PRODUCT_ID = PREMIUM_YEARLY_PRODUCT_ID

let provider: BillingProvider | null = null
let initialized = false
let cachedStatus: SubscriptionInfo | null = null
let statusCheckedAt = 0
const STATUS_CACHE_MS = 30_000

function getApiBase(): string {
  return getAppBaseUrl()
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    // Bounded: AuthService.getSession() must never hang the purchase flow.
    // A slow session read surfaces as a retryable verification error, never
    // an infinite spinner.
    const { AuthService } = await import('@/lib/authService')
    const session = await withTimeout(
      AuthService.getSession(),
      BILLING_AUTH_TIMEOUT_MS,
      null,
    )
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch { /* session unavailable — API route falls back to cookie auth */ }
  return headers
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<T>(resolve => {
    timer = setTimeout(() => resolve(fallback), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = BILLING_VERIFY_TIMEOUT_MS): Promise<Response> {
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

async function verifyPurchase(result: PurchaseResult): Promise<PurchaseResult> {
  if (!result.purchaseToken || !result.productId) {
    return { success: false, error: 'Purchase verification data is missing', errorDetail: 'verification' }
  }

  // eslint-disable-next-line no-console
  console.log(`[PREMIUM][ENTITLEMENT] verification_start productId=${result.productId}`)
  try {
    const headers = await getAuthHeaders()
    const response = await fetchWithTimeout(`${getApiBase()}/api/subscription/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        purchaseToken: result.purchaseToken,
        productId: result.productId,
        orderId: result.orderId,
      }),
    })
    const data = await response.json() as { success?: boolean; error?: string }
    if (!response.ok || data.success !== true) {
      console.warn(`[PREMIUM][ERROR] stage=verification code=${response.status} message=${data.error || 'verify-rejected'}`)
      return {
        success: false,
        error: data.error || 'Purchase could not be verified. Please try again.',
        errorDetail: 'verification',
      }
    }
    // eslint-disable-next-line no-console
    console.log('[PREMIUM][ENTITLEMENT] verification_result success=true')
    return result
  } catch {
    console.warn('[PREMIUM][ERROR] stage=verification code=network message=verify-request-failed')
    return { success: false, error: 'Purchase verification failed. Please try again.', errorDetail: 'verification' }
  }
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

  invalidate(): void {
    cachedStatus = null
    statusCheckedAt = 0
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
      const anyRestored = restored.some(r => r.success && r.purchaseToken && r.productId)
      if (anyRestored) {
        cachedStatus = await fetchServerStatus()
        statusCheckedAt = Date.now()
      }
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
    if (!result.success) return result

    if (result.checkoutUrl) {
      return { success: true, checkoutUrl: result.checkoutUrl, productId }
    }

    const verified = await verifyPurchase(result)
    if (!verified.success) return verified

    return verified
  },

  async restore(): Promise<boolean> {
    if (!provider) return false
    const restored = await provider.restorePurchases()

    const verifiedPurchases = await Promise.all(
      restored
        .filter(r => r.success && r.purchaseToken && r.productId)
        .map(r => verifyPurchase(r)),
    )
    const anyRestored = verifiedPurchases.some(r => r.success)
    if (anyRestored) {
      cachedStatus = null
      statusCheckedAt = 0
      await this.isPremium()
    }

    return anyRestored
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
