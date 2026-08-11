import type { BillingProvider, PurchaseResult, SubscriptionPlan } from './types'
import type { NativePurchasesPlugin, PURCHASE_TYPE, Product, Transaction } from '@capgo/native-purchases'

const BILLING_TIMEOUT_MS = 5000

let plugin: NativePurchasesPlugin | null = null

async function getPlugin(): Promise<NativePurchasesPlugin | null> {
  if (plugin) return plugin
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return null
    const mod = await import('@capgo/native-purchases')
    plugin = mod.NativePurchases
    return plugin
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

function isYearly(productId: string, prod: Product): boolean {
  if (productId.includes('yearly')) return true
  if (prod.subscriptionPeriod?.unitString === 'year') return true
  return false
}

export const GooglePlayBillingProvider: BillingProvider = {
  async initialize(): Promise<boolean> {
    const p = await getPlugin()
    return p !== null
  },

  async isAvailable(): Promise<boolean> {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return false
      const p = await getPlugin()
      return p !== null
    } catch {
      return false
    }
  },

  async queryProductDetails(productIds: string[]): Promise<SubscriptionPlan[]> {
    const p = await getPlugin()
    if (!p) return []

    try {
      const result = await withTimeout(
        p.getProducts({
          productIdentifiers: productIds,
          productType: 'subs' as PURCHASE_TYPE,
        }),
        BILLING_TIMEOUT_MS,
        { products: [] },
      )

      return result.products.map((prod) => {
        const isYr = isYearly(prod.identifier, prod)
        return {
          productId: prod.identifier,
          title: prod.title,
          subtitle: isYr ? 'Most popular choice' : 'Flexible & cancel anytime',
          price: prod.priceString || `${prod.currencyCode} ${prod.price}`,
          description: prod.description,
          billingPeriod: isYr ? 'yearly' : 'monthly',
        }
      })
    } catch {
      return []
    }
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    const p = await getPlugin()
    if (!p) {
      return { success: false, error: 'Billing not available', errorDetail: 'unknown' }
    }

    try {
      const result = await withTimeout(
        p.purchaseProduct({
          productIdentifier: productId,
          productType: 'subs' as PURCHASE_TYPE,
        }),
        BILLING_TIMEOUT_MS,
        null,
      )

      if (!result) {
        return { success: false, error: 'Billing timed out. Please try again.', errorDetail: 'network' }
      }

      const purchaseToken = (result as unknown as Transaction).purchaseToken
        || (result as unknown as Transaction & { jwsRepresentation?: string }).jwsRepresentation
        || ''

      return {
        success: true,
        purchaseToken,
        productId: result.productIdentifier,
        orderId: result.transactionId,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('cancelled') || msg.includes('cancel') || msg.includes('CANCEL')) {
        return { success: false, error: 'Purchase cancelled', errorDetail: 'cancelled' }
      }
      if (msg.includes('already') || msg.includes('ALREADY_OWN')) {
        return { success: false, error: 'Already owned', errorDetail: 'already_owned' }
      }
      if (msg.includes('network') || msg.includes('timeout') || msg.includes('NETWORK')) {
        return { success: false, error: 'Network error', errorDetail: 'network' }
      }
      return { success: false, error: msg, errorDetail: 'failed' }
    }
  },

  async restorePurchases(): Promise<PurchaseResult[]> {
    const p = await getPlugin()
    if (!p) return []

    try {
      await p.restorePurchases()
      return []
    } catch {
      return []
    }
  },

  async acknowledgePurchase(_purchaseToken: string, _productId: string): Promise<void> {
    // @capgo/native-purchases auto-acknowledges by default
  },
}
