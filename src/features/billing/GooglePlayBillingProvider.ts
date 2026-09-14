import type { BillingDiagnostic, BillingProvider, PurchaseResult, SubscriptionPlan } from './types'
import {
  BILLING_PRODUCT_QUERY_TIMEOUT_MS,
  BILLING_RESTORE_TIMEOUT_MS,
  GOOGLE_PLAY_BASE_PLAN_IDS,
} from '@/features/shared/gameConstants'

interface NativePurchasesPlugin {
  getProducts(options: { productIdentifiers: string[]; productType: string }): Promise<{ products: NativeProduct[] }>
  getPurchases?(options: { productType: string }): Promise<{ purchases: NativeTransaction[] }>
  purchaseProduct(options: { productIdentifier: string; productType: string; planIdentifier?: string; offerToken?: string }): Promise<NativeTransaction>
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
  /** Android subscriptions: Google Play product ID tied to this offer/base plan. */
  planIdentifier?: string
  /** Android: offer token required to launch the billing flow for this offer. */
  offerToken?: string
}

interface NativeTransaction {
  productIdentifier: string
  transactionId?: string
  purchaseToken?: string
  jwsRepresentation?: string
}

type ProductQueryResult =
  | { products: NativeProduct[] }
  | { products: NativeProduct[]; timedOut: true }

let plugin: NativePurchasesPlugin | null = null
let lastDiagnostic: BillingDiagnostic | null = null
let nativeOperationQueue: Promise<void> = Promise.resolve()

// Offer tokens returned by getProducts(), keyed by subscription product ID
// (and base-plan ID as fallback). Play Billing requires the offer token to
// launch the flow for a specific base plan/offer — launching without it is
// the remaining "Upgrade spins forever / sheet never opens" cause.
const offerTokenCache: Record<string, string> = {}

function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = nativeOperationQueue.then(operation, operation)
  nativeOperationQueue = result.then(() => undefined, () => undefined)
  return result
}

function diagnosticMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/(token|authorization|bearer)\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 240)
}

function setDiagnostic(diagnostic: BillingDiagnostic | null): void {
  lastDiagnostic = diagnostic
  if (diagnostic) billingError(diagnostic.stage, diagnostic.code, diagnostic.message)
}

function cacheOfferTokens(products: NativeProduct[]): void {
  for (const prod of products) {
    if (!prod.offerToken) continue
    // Per plugin docs, planIdentifier is the subscription product ID.
    if (prod.planIdentifier) offerTokenCache[prod.planIdentifier] = prod.offerToken
    // identifier is the base-plan ID for subscriptions — cache as fallback.
    offerTokenCache[prod.identifier] = prod.offerToken
  }
}

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
    setDiagnostic(null)
    const p = await withTimeout(getPlugin(), 5000, null)
    if (!p) {
      setDiagnostic({
        stage: 'connection',
        code: 'plugin_unavailable',
        message: 'Native Google Play billing plugin was unavailable or timed out.',
        details: 'getPlugin timeout=5000ms',
      })
      return []
    }

    billingLog('query_start', `productIds=${productIds.join(',')} productType=subs`)
    try {
      const result = await withTimeout<ProductQueryResult>(
        runSerialized(() => p.getProducts({
          productIdentifiers: productIds,
          productType: 'subs',
        })),
        BILLING_PRODUCT_QUERY_TIMEOUT_MS,
        { products: [], timedOut: true },
      )

      if ('timedOut' in result && result.timedOut) {
        setDiagnostic({
          stage: 'product_query',
          code: 'product_query_timeout',
          message: `Google Play did not respond within ${BILLING_PRODUCT_QUERY_TIMEOUT_MS} ms.`,
          details: `productIds=${productIds.join(',')} elapsedMs>=${BILLING_PRODUCT_QUERY_TIMEOUT_MS}`,
        })
        return []
      }

      billingLog('query_result', `productCount=${result.products.length}`)
      for (const prod of result.products) {
        // eslint-disable-next-line no-console
        console.log(`[PREMIUM][PRODUCT] query_result productId=${prod.identifier} productType=subs hasOffer=${Boolean(prod.offerToken)}`)
      }
      if (result.products.length === 0) {
        setDiagnostic({
          stage: 'product_query',
          code: 'product_unavailable',
          message: 'Google Play returned zero eligible products.',
          details: `productIds=${productIds.join(',')} response=empty`,
        })
      }
      cacheOfferTokens(result.products)

      return result.products.map((prod) => {
        const productId = prod.planIdentifier ?? prod.identifier
        const isYr = isYearly(productId, prod)
        return {
          productId,
          title: prod.title,
          subtitle: isYr ? 'Most popular choice' : 'Flexible & cancel anytime',
          price: prod.priceString || `${prod.currencyCode} ${prod.price}`,
          description: prod.description,
          billingPeriod: isYr ? 'yearly' : 'monthly',
        }
      })
    } catch (err) {
      setDiagnostic({
        stage: 'product_query',
        code: 'product_query_failed',
        message: diagnosticMessage(err),
        details: `productIds=${productIds.join(',')}`,
      })
      return []
    }
  },

  getLastDiagnostic(): BillingDiagnostic | null {
    return lastDiagnostic
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    const p = await withTimeout(getPlugin(), 5000, null)
    if (!p) {
      billingError('purchase', 'billing_unavailable', 'native billing plugin unavailable or timed out')
      return { success: false, error: 'Google Play Billing is not available on this device.', errorDetail: 'billing_unavailable' }
    }

    try {
      const maybeCheck = (p as unknown as { isBillingSupported?: () => Promise<{ isBillingSupported: boolean }> }).isBillingSupported
      if (maybeCheck) {
        const supported = await withTimeout(runSerialized(() => maybeCheck.call(p)), 3000, { isBillingSupported: true } as { isBillingSupported: boolean })
        if (supported && 'isBillingSupported' in supported && !supported.isBillingSupported) {
          billingError('purchase', 'billing_unavailable', 'Play Billing not supported on this device')
          return { success: false, error: 'Google Play Billing is not available on this device.', errorDetail: 'billing_unavailable' }
        }
      }
    } catch {
      // best-effort only
    }

    // NOTE: the Play base-plan ID differs from the subscription product ID
    // (premium_monthly -> monthlybase). Passing the product ID as the plan was
    // the production launch failure — resolve it here, never at the call site.
    const planIdentifier = resolveBasePlanId(productId)
    // Play Billing also requires the offer token for the selected base
    // plan/offer. Reuse the token cached by queryProductDetails(); if the
    // Premium screen never loaded products (or the cache missed), fetch it
    // now with a bounded query — never block the launch indefinitely.
    let offerToken = offerTokenCache[productId] ?? offerTokenCache[planIdentifier]
    if (!offerToken) {
      billingLog('offer_lookup_start', `productId=${productId}`)
      try {
        const lookup = await withTimeout(
          runSerialized(() => p.getProducts({ productIdentifiers: [productId], productType: 'subs' })),
          BILLING_PRODUCT_QUERY_TIMEOUT_MS,
          { products: [] },
        )
        cacheOfferTokens(lookup.products)
        offerToken = offerTokenCache[productId] ?? offerTokenCache[planIdentifier]
        billingLog('offer_lookup_result', `productId=${productId} hasOffer=${Boolean(offerToken)} products=${lookup.products.length}`)
        if (lookup.products.length === 0) {
          billingError('purchase', 'product_unavailable', `no products for ${productId} - check Play Console pricing/availability`)
          return { success: false, error: 'This subscription is not available for your account or region right now.', errorDetail: 'product_unavailable' }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        billingError('offer_lookup', 'failed', message)
      }
    }
    if (!offerToken) {
      billingError('purchase', 'product_unavailable', `no offerToken for ${productId}/${planIdentifier} - cannot launch billing flow`)
      return { success: false, error: 'This subscription is not available for your account or region right now.', errorDetail: 'product_unavailable' }
    }
    billingLog('launch_start', `productId=${productId} productType=subs planIdentifier=${planIdentifier} hasOffer=${Boolean(offerToken)}`)

    try {
      // No timeout here by design: the native Play sheet waits on the user for
      // an unbounded time. A race timeout would fake-fail an in-progress
      // purchase. Termination is guaranteed by the plugin settling (result or
      // throw) plus the UI-level 30s safety net as a last resort.
      const result = await runSerialized(() => p.purchaseProduct({
        productIdentifier: productId,
        productType: 'subs',
        planIdentifier,
        ...(offerToken ? { offerToken } : {}),
      }))

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
        runSerialized(() => p.restorePurchases()),
        BILLING_RESTORE_TIMEOUT_MS,
        undefined,
      )
      if (restored && 'purchases' in restored && restored.purchases) {
        billingLog('restore_result', `purchaseCount=${restored.purchases.length}`)
        return restored.purchases.map(toPurchaseResult)
      }
      if (!p.getPurchases) return []
      const current = await withTimeout(
        runSerialized(() => p.getPurchases!({ productType: 'subs' })),
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
