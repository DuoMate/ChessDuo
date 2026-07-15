import type { BillingProvider, PurchaseResult, SubscriptionPlan } from '../types'

const mockProvider: BillingProvider = {
  initialize: jest.fn().mockResolvedValue(true),
  purchase: jest.fn().mockResolvedValue({ success: true, purchaseToken: 'test-token', productId: 'premium_monthly', orderId: 'order-1' }),
  queryProductDetails: jest.fn().mockResolvedValue([
    { productId: 'premium_monthly', title: 'Monthly', subtitle: 'Flexible', price: '\u20B999.00', description: 'Monthly sub', billingPeriod: 'monthly' },
    { productId: 'premium_yearly', title: 'Annual', subtitle: 'Best value', price: '\u20B9999.00', description: 'Annual sub', billingPeriod: 'yearly' },
  ]),
  restorePurchases: jest.fn().mockResolvedValue([]),
  isAvailable: jest.fn().mockResolvedValue(true),
  acknowledgePurchase: jest.fn().mockResolvedValue(undefined),
}

const mockFetch = jest.fn()
global.fetch = mockFetch

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}))

describe('SubscriptionService', () => {
  let SubscriptionService: typeof import('../SubscriptionService').SubscriptionService

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ isPremium: false, subscriptionProvider: null }) })

    const mod = await import('../SubscriptionService')
    SubscriptionService = mod.SubscriptionService
    SubscriptionService.setProvider(mockProvider)
  })

  describe('getPlans', () => {
    it('returns plans from provider', async () => {
      const plans = await SubscriptionService.getPlans()
      expect(plans).toHaveLength(2)
      expect(plans[0].productId).toBe('premium_monthly')
      expect(plans[1].productId).toBe('premium_yearly')
    })

    it('returns fallback plans when provider is null', async () => {
      SubscriptionService.setProvider(null as unknown as BillingProvider)
      const plans = await SubscriptionService.getPlans()
      expect(plans).toHaveLength(2)
      expect(plans[0].billingPeriod).toBe('monthly')
      expect(plans[1].billingPeriod).toBe('yearly')
    })

    it('returns empty array when provider throws', async () => {
      const errorProvider: BillingProvider = {
        ...mockProvider,
        queryProductDetails: jest.fn().mockRejectedValue(new Error('network error')),
      }
      SubscriptionService.setProvider(errorProvider)
      const plans = await SubscriptionService.getPlans()
      expect(plans).toEqual([])
    })
  })

  describe('purchase', () => {
    it('purchaseMonthly calls provider.purchase with correct productId', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })
      await SubscriptionService.purchaseMonthly()
      expect(mockProvider.purchase).toHaveBeenCalledWith('premium_monthly')
    })

    it('purchaseYearly calls provider.purchase with correct productId', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })
      await SubscriptionService.purchaseYearly()
      expect(mockProvider.purchase).toHaveBeenCalledWith('premium_yearly')
    })

    it('returns failure when purchase fails', async () => {
      (mockProvider.purchase as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'User cancelled',
        errorDetail: 'cancelled',
      } as PurchaseResult)

      const result = await SubscriptionService.purchaseMonthly()
      expect(result.success).toBe(false)
      expect(result.errorDetail).toBe('cancelled')
    })

    it('returns verification error when server verification fails', async () => {
      (mockProvider.purchase as jest.Mock).mockResolvedValueOnce({
        success: true,
        purchaseToken: 'bad-token',
        productId: 'premium_monthly',
        orderId: 'order-1',
      })
      mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'invalid' }) })

      const result = await SubscriptionService.purchaseMonthly()
      expect(result.success).toBe(false)
      expect(result.errorDetail).toBe('verification')
    })

    it('handles null provider gracefully', async () => {
      SubscriptionService.setProvider(null as unknown as BillingProvider)
      const result = await SubscriptionService.purchaseMonthly()
      expect(result.success).toBe(false)
      expect(result.error).toBe('Billing not available')
    })
  })

  describe('restore', () => {
    it('returns false when no purchases to restore', async () => {
      (mockProvider.restorePurchases as jest.Mock).mockResolvedValueOnce([])
      const result = await SubscriptionService.restore()
      expect(result).toBe(false)
    })

    it('verifies restored purchases', async () => {
      (mockProvider.restorePurchases as jest.Mock).mockResolvedValueOnce([
        { success: true, purchaseToken: 'restored-token', productId: 'premium_yearly', orderId: 'order-2' },
      ])
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, state: 'purchased' }) })

      const result = await SubscriptionService.restore()
      expect(result).toBe(true)
    })

    it('returns false when provider is null', async () => {
      SubscriptionService.setProvider(null as unknown as BillingProvider)
      const result = await SubscriptionService.restore()
      expect(result).toBe(false)
    })
  })

  describe('isPremium', () => {
    it('returns false before initialization', async () => {
      const premium = await SubscriptionService.isPremium()
      expect(premium).toBe(false)
    })

    it('returns true when server says premium', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ isPremium: true, subscriptionProvider: 'GOOGLE_PLAY' }) })
      const premium = await SubscriptionService.isPremium()
      expect(premium).toBe(true)
    })

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'))
      const premium = await SubscriptionService.isPremium()
      expect(premium).toBe(false)
    })
  })

  describe('initialize', () => {
    it('initializes provider and fetches status', async () => {
      await SubscriptionService.initialize()
      expect(mockProvider.initialize).toHaveBeenCalled()
    })

    it('does not re-initialize', async () => {
      await SubscriptionService.initialize()
      ;(mockProvider.initialize as jest.Mock).mockClear()
      await SubscriptionService.initialize()
      expect(mockProvider.initialize).not.toHaveBeenCalled()
    })

    it('tries restore when not premium', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ isPremium: false, subscriptionProvider: null }) })
      await SubscriptionService.initialize()
      expect(mockProvider.restorePurchases).toHaveBeenCalled()
    })
  })

  describe('getStatus', () => {
    it('fetches server status', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ isPremium: true, subscriptionProvider: 'GOOGLE_PLAY', subscriptionPlan: 'monthly' }) })
      const status = await SubscriptionService.getStatus()
      expect(status.isPremium).toBe(true)
      expect(status.subscriptionProvider).toBe('GOOGLE_PLAY')
    })

    it('handles server error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: 'server error' }) })
      const status = await SubscriptionService.getStatus()
      expect(status.isPremium).toBe(false)
    })
  })
})
