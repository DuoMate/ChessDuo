import type { BillingProvider, PurchaseResult, SubscriptionPlan } from './types'
import {
  BILLING_PRODUCT_QUERY_TIMEOUT_MS,
  BILLING_RESTORE_TIMEOUT_MS,
  GOOGLE_PLAY_BASE_PLAN_IDS,
} from '@/features/shared/gameConstants'

interface NativePurchasesPlugin {
  getProducts(options: { productIdentifiers: string[]; productType: string }): Promise<{ products: NativeProduct[] }>
  getPurchases?(options: { productType: string }): Promise<{ purchases: NativeTransaction[] }>
  purchaseProduct(options: { productIdentifier: string; productType: string; planIdentifier?: string }): Promise<NativeTransaction>
  restorePurchases(): Promise<{ purchases?: NativeTransaction[] } | void>
}

interface NativeProduct {
  identifier: string
  title: string
  description: string
  price: number
  currencyCode: string
  priceString?: string
  subscriptionPeriod?: { unitString: string }
}

interface NativeTransaction {
  productIdentifier: string
  transactionId?: string
  purchaseToken?: string
  jwsRepresentation?: string
}

let plugin: NativePurchasesPlugin | null = null

function billingLog(stage: string, detail: string): void {
  // Structured diagnostics — never include tokens, auth material, or PII.
  // eslint-disable-next-line no-console
  console.log(`[PREMIUM][BILLING] ${stage} ${detail}`)
}

function billingError(stage: string, code: string, message: string): void {
  console.warn(`[PREMIUM][ERROR] stage=${stage} code=${code} message=${message}`)
}

export function resolveBasePlanId(productId: string): string {
  return GOOGLE_PLAY_BASE_PLAN_IDS[productId] ?? productId
}

async function getPlugin(): Promise<NativePurchasesPlugin | null> {
  if (plugin) return plugin
  billingLog('connection_start', '')
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) {
      billingLog('connection_result', 'responseCode=UNAVAILABLE debugMessage=not-native-platform')
      return null
    }
    const mod = await import('@capgo/native-purchases')
    plugin = mod.NativePurchases as unknown as NativePurchasesPlugin
    billingLog('connection_result', 'responseCode=OK debugMessage=plugin-loaded')
    return plugin
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    billingLog('connection_result', `responseCode=FAILED debugMessage=${message}`)
    return null
  }
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

function isYearly(productId: string, prod: NativeProduct): boolean {
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
    if (!p) {
      billingError('product_query', 'billing_unavailable', 'native billing plugin unavailable')
      return []
    }

    billingLog('query_start', `productIds=${productIds.join(',')} productType=subs`)
    try {
      const result = await withTimeout(
        p.getProducts({
          productIdentifiers: productIds,
          productType: 'subs',
        }),
        BILLING_PRODUCT_QUERY_TIMEOUT_MS,
        { products: [] },
      )

      billingLog('query_result', `productCount=${result.products.length}`)
      for (const prod of result.products) {
        // eslint-disable-next-line no-console
        console.log(`[PREMIUM][PRODUCT] query_result productId=${prod.identifier} productType=subs`)
      }
      if (result.products.length === 0) {
        billingError('product_query', 'product_unavailable', 'store returned zero products for requested ids')
      }

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      billingError('product_query', 'failed', message)
      return []
    }
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    const p = await getPlugin()
    if (!p) {
      billingError('purchase', 'billing_unavailable', 'native billing plugin unavailable')
      return { success: false, error: 'Google Play Billing is not available on this device.', errorDetail: 'billing_unavailable' }
    }

    // NOTE: the Play base-plan ID differs from the subscription product ID
    // (premium_monthly -> monthlybase). Passing the product ID as the plan was
    // the production launch failure — resolve it here, never at the call site.
    const planIdentifier = resolveBasePlanId(productId)
    billingLog('launch_start', `productId=${productId} productType=subs planIdentifier=${planIdentifier}`)

    try {
      // No timeout here by design: the native Play sheet waits on the user for
      // an unbounded time. A race timeout would fake-fail an in-progress
      // purchase. Termination is guaranteed by the plugin settling (result or
      // throw) plus the UI-level 30s safety net as a last resort.
      const result = await p.purchaseProduct({
        productIdentifier: productId,
        productType: 'subs',
        planIdentifier,
      })

      if (!result || !result.productIdentifier) {
        billingError('purchase', 'failed', 'empty purchase result from store')
        return { success: false, error: 'Google Play purchase could not be started. Please check your Google Play account and try again.', errorDetail: 'failed' }
      }

      billingLog('callback', `responseCode=OK productId=${result.productIdentifier}`)

      const purchaseToken = result.purchaseToken
        || result.jwsRepresentation
        || ''

      if (!purchaseToken) {
        billingError('purchase', 'failed', 'purchase completed without token')
        return { success: false, error: 'Google Play purchase could not be completed. Please try again.', errorDetail: 'failed' }
      }

      return {
        success: true,
        purchaseToken,
        productId: result.productIdentifier,
        orderId: result.transactionId,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      billingLog('callback', `responseCode=ERROR debugMessage=${msg}`)
      if (msg.includes('cancelled') || msg.includes('cancel') || msg.includes('CANCEL') || msg.includes('USER_CANCEL')) {
        return { success: false, error: 'Purchase cancelled', errorDetail: 'cancelled' }
      }
      if (msg.includes('already') || msg.includes('ALREADY_OWN') || msg.includes('ITEM_ALREADY_OWNED')) {
        return { success: false, error: 'Already owned', errorDetail: 'already_owned' }
      }
      if (msg.includes('network') || msg.includes('timeout') || msg.includes('NETWORK') || msg.includes('SERVICE_UNAVAILABLE') || msg.includes('SERVICE_DISCONNECTED')) {
        billingError('purchase', 'network', msg)
        return { success: false, error: 'Network error. Please check your connection and try again.', errorDetail: 'network' }
      }
      if (msg.includes('UNAVAILABLE') || msg.includes('BILLING_UNAVAILABLE') || msg.includes('FEATURE_NOT_SUPPORTED')) {
        billingError('purchase', 'billing_unavailable', msg)
        return { success: false, error: 'Google Play Billing is not available on this device or account.', errorDetail: 'billing_unavailable' }
      }
      if (msg.includes('ITEM_NOT_FOUND') || msg.includes('NOT_FOUND') || msg.includes('INVALID') || msg.includes('DEVELOPER_ERROR')) {
        billingError('purchase', 'product_unavailable', msg)
        return { success: false, error: 'This subscription is not available for your account or region right now.', errorDetail: 'product_unavailable' }
      }
      billingError('purchase', 'failed', msg)
      return { success: false, error: 'Google Play purchase could not be started. Please check your Google Play account and try again.', errorDetail: 'failed' }
    }
  },

  async restorePurchases(): Promise<PurchaseResult[]> {
    const p = await getPlugin()
    if (!p) return []

    try {
      const restored = await withTimeout(
        p.restorePurchases(),
        BILLING_RESTORE_TIMEOUT_MS,
        undefined,
      )
      if (restored && 'purchases' in restored && restored.purchases) {
        billingLog('restore_result', `purchaseCount=${restored.purchases.length}`)
        return restored.purchases.map(toPurchaseResult)
      }
      if (!p.getPurchases) return []
      const current = await withTimeout(
        p.getPurchases({ productType: 'subs' }),
        BILLING_RESTORE_TIMEOUT_MS,
        { purchases: [] },
      )
      billingLog('restore_result', `purchaseCount=${current.purchases.length}`)
      return current.purchases.map(toPurchaseResult)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      billingError('restore', 'failed', message)
      return []
    }
  },

  async acknowledgePurchase(): Promise<void> {
    // Acknowledgement is performed server-side (/api/subscription/verify) so
    // entitlement is only granted after Google verification. No-op here.
  },
}

function toPurchaseResult(transaction: NativeTransaction): PurchaseResult {
  const purchaseToken = transaction.purchaseToken || transaction.jwsRepresentation || ''
  return {
    success: Boolean(purchaseToken && transaction.productIdentifier),
    purchaseToken,
    productId: transaction.productIdentifier,
    orderId: transaction.transactionId,
  }
}
