import type { BillingProvider, PurchaseResult, SubscriptionPlan } from './types'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { AuthService } = await import('@/lib/authService')
    const session = await AuthService.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch { /* session unavailable */ }
  return headers
}

const MONTHLY_PRODUCT_ID = 'premium_monthly'
const YEARLY_PRODUCT_ID = 'premium_yearly'

export const CreemBillingProvider: BillingProvider = {
  async initialize(): Promise<boolean> {
    return true
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    try {
      const { AuthService } = await import('@/lib/authService')
      const session = await AuthService.getSession()
      const userId = session?.user?.id || ''

      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/api/creem/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ productId, userId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { success: false, error: data.error || 'Failed to create checkout', errorDetail: 'failed' }
      }

      const data = await res.json() as { checkoutUrl?: string }
      if (!data.checkoutUrl) {
        return { success: false, error: 'No checkout URL returned', errorDetail: 'failed' }
      }

      const isNative = typeof window !== 'undefined' &&
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
          .Capacitor?.isNativePlatform?.()

      if (isNative) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: data.checkoutUrl, windowName: '_system' })
      } else {
        window.location.href = data.checkoutUrl
      }

      return { success: true, checkoutUrl: data.checkoutUrl, productId }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Purchase failed', errorDetail: 'failed' }
    }
  },

  async queryProductDetails(productIds: string[]): Promise<SubscriptionPlan[]> {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/api/creem/products`, { headers })
      if (!res.ok) return []

      const data = await res.json() as SubscriptionPlan[]
      return data.filter(p => productIds.includes(p.productId))
    } catch {
      return []
    }
  },

  async restorePurchases(): Promise<PurchaseResult[]> {
    try {
      const { AuthService } = await import('@/lib/authService')
      const session = await AuthService.getSession()
      const userId = session?.user?.id || ''
      if (!userId) return []

      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/api/creem/subscriptions?userId=${encodeURIComponent(userId)}`, { headers })
      if (!res.ok) return []

      const data = await res.json() as PurchaseResult[]
      return data
    } catch {
      return []
    }
  },

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/api/creem/products`, { method: 'HEAD' })
      return res.ok
    } catch {
      return false
    }
  },

  async acknowledgePurchase(_purchaseToken: string, _productId: string): Promise<void> {
  },
}
