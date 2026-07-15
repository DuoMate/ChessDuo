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
}

export interface PurchaseResult {
  success: boolean
  purchaseToken?: string
  productId?: string
  orderId?: string
  error?: string
  errorDetail?: 'cancelled' | 'failed' | 'already_owned' | 'network' | 'verification' | 'unknown'
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
}
