export type SubscriptionState =
  | 'active'
  | 'grace_period'
  | 'on_hold'
  | 'pending'
  | 'expired'
  | 'cancelled'

export type SubscriptionEvent =
  | 'check'
  | 'purchase'
  | 'restore'
  | 'expire'
  | 'grace'
  | 'hold'
  | 'cancel'
  | 'pause'

export interface SubscriptionPlan {
  productId: string
  title: string
  subtitle: string
  price: string
  description: string
  billingPeriod: 'monthly' | 'yearly'
}

export interface SubscriptionInfo {
  isPremium: boolean
  subscriptionProvider: 'GOOGLE_PLAY' | 'APPLE' | 'WEB' | null
  subscriptionPlan: 'monthly' | 'yearly' | null
  purchaseToken: string | null
  subscriptionExpiryDate: string | null
  autoRenewStatus: boolean
  purchaseState: SubscriptionState | null
  lastVerifiedDate: string | null
  subscriptionStatus: string | null
  /** ISO timestamp of the last consumed AI Coach daily free game (server time). Optional until migration is applied. */
  coachLastFreeGameAt?: string | null
  /** Server-computed rolling-24h eligibility for the AI Coach daily free game. */
  coachFreeEligible?: boolean
  /** ISO timestamp when the next daily free game becomes available (server time). */
  coachNextEligibleAt?: string | null
}

export interface PurchaseResult {
  success: boolean
  checkoutUrl?: string
  purchaseToken?: string
  productId?: string
  orderId?: string
  error?: string
  errorDetail?: 'cancelled' | 'failed' | 'already_owned' | 'network' | 'verification' | 'billing_unavailable' | 'product_unavailable' | 'unknown'
}

export type BillingDiagnosticCode =
  | 'plugin_unavailable'
  | 'product_query_timeout'
  | 'product_unavailable'
  | 'product_query_failed'

export interface BillingDiagnostic {
  stage: 'connection' | 'product_query'
  code: BillingDiagnosticCode
  message: string
  details?: string
}

export interface BillingProvider {
  /** Connect to the billing service. Returns true if billing is available. */
  initialize(): Promise<boolean>
  /** Launch native purchase flow for a product. */
  purchase(productId: string): Promise<PurchaseResult>
  /** Query product details (prices, titles) from the store. */
  queryProductDetails(productIds: string[]): Promise<SubscriptionPlan[]>
  /** Restore previously purchased subscriptions. */
  restorePurchases(): Promise<PurchaseResult[]>
  /** Whether the billing provider is available on this platform. */
  isAvailable(): Promise<boolean>
  /** Acknowledge a purchase (some stores require this). */
  acknowledgePurchase(purchaseToken: string, productId: string): Promise<void>
  /** Last non-sensitive diagnostic from a billing operation, when available. */
  getLastDiagnostic?(): BillingDiagnostic | null
}
