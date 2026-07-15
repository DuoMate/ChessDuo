import type { BillingProvider } from '../types'

const mockCapacitor = {
  Capacitor: {
    isNativePlatform: jest.fn().mockReturnValue(true),
    getPlatform: jest.fn().mockReturnValue('android'),
  },
}

const mockBilling = {
  NativePurchases: {
    getProducts: jest.fn().mockResolvedValue({
      products: [
        { identifier: 'premium_monthly', title: 'Monthly', description: 'Monthly sub', priceString: '\u20B999.00', price: 99, currencyCode: 'INR', subscriptionPeriod: 'P1M' },
      ],
    }),
    purchaseProduct: jest.fn().mockResolvedValue({
      transactionId: 'GPA.1234-5678',
      purchaseToken: 'test-token',
      productIdentifier: 'premium_monthly',
    }),
    acknowledgePurchase: jest.fn().mockResolvedValue(undefined),
    restorePurchases: jest.fn().mockResolvedValue(undefined),
  },
}

jest.doMock('@capacitor/core', () => mockCapacitor, { virtual: true })
jest.doMock('@capgo/native-purchases', () => mockBilling, { virtual: true })

describe('GooglePlayBillingProvider', () => {
  let provider: BillingProvider

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockCapacitor.Capacitor.isNativePlatform.mockReturnValue(true)
    mockBilling.NativePurchases.getProducts.mockResolvedValue({
      products: [
        { identifier: 'premium_monthly', title: 'Monthly', description: 'Monthly sub', priceString: '\u20B999.00', price: 99, currencyCode: 'INR', subscriptionPeriod: 'P1M' },
      ],
    })
    mockBilling.NativePurchases.purchaseProduct.mockResolvedValue({
      transactionId: 'GPA.1234-5678',
      purchaseToken: 'test-token',
      productIdentifier: 'premium_monthly',
    })
    mockBilling.NativePurchases.restorePurchases.mockResolvedValue(undefined)

    const mod = await import('../GooglePlayBillingProvider')
    provider = mod.GooglePlayBillingProvider
  })

  it('isAvailable returns true on Android native', async () => {
    const available = await provider.isAvailable()
    expect(available).toBe(true)
  })

  it('initialize returns true', async () => {
    const result = await provider.initialize()
    expect(result).toBe(true)
  })

  it('queryProductDetails returns mapped plans', async () => {
    const plans = await provider.queryProductDetails(['premium_monthly'])
    expect(plans).toHaveLength(1)
    expect(plans[0].productId).toBe('premium_monthly')
    expect(plans[0].price).toBe('\u20B999.00')
    expect(plans[0].billingPeriod).toBe('monthly')
  })

  it('queryProductDetails detects yearly plans', async () => {
    mockBilling.NativePurchases.getProducts.mockResolvedValueOnce({
      products: [
        { identifier: 'premium_yearly', title: 'Annual', description: 'Annual sub', priceString: '\u20B9999.00', price: 999, currencyCode: 'INR', subscriptionPeriod: 'P1Y' },
      ],
    })
    const plans = await provider.queryProductDetails(['premium_yearly'])
    expect(plans[0].billingPeriod).toBe('yearly')
  })

  it('purchase returns success with token', async () => {
    const result = await provider.purchase('premium_monthly')
    expect(result.success).toBe(true)
    expect(result.purchaseToken).toBe('test-token')
    expect(result.productId).toBe('premium_monthly')
  })

  it('purchase handles cancellation error', async () => {
    mockBilling.NativePurchases.purchaseProduct.mockRejectedValueOnce(new Error('User cancelled purchase'))
    const result = await provider.purchase('premium_monthly')
    expect(result.success).toBe(false)
    expect(result.errorDetail).toBe('cancelled')
  })

  it('purchase handles already owned error', async () => {
    mockBilling.NativePurchases.purchaseProduct.mockRejectedValueOnce(new Error('Item already owned'))
    const result = await provider.purchase('premium_monthly')
    expect(result.success).toBe(false)
    expect(result.errorDetail).toBe('already_owned')
  })

  it('restorePurchases calls the plugin', async () => {
    const results = await provider.restorePurchases()
    expect(mockBilling.NativePurchases.restorePurchases).toHaveBeenCalled()
    expect(results).toEqual([])
  })

  it('acknowledgePurchase does not throw', async () => {
    await expect(provider.acknowledgePurchase('token', 'premium_monthly')).resolves.toBeUndefined()
  })

  it('isAvailable returns false on non-native platform', async () => {
    const { GooglePlayBillingProvider: freshProvider } = await import('../GooglePlayBillingProvider')
    mockCapacitor.Capacitor.isNativePlatform.mockReturnValueOnce(false)
    jest.resetModules()
    const mod = await import('../GooglePlayBillingProvider')
    const fresh = mod.GooglePlayBillingProvider
    const available = await fresh.isAvailable()
    expect(available).toBe(false)
  })

  it('purchase handles network error', async () => {
    mockBilling.NativePurchases.purchaseProduct.mockRejectedValueOnce(new Error('NETWORK_ERROR'))
    const result = await provider.purchase('premium_monthly')
    expect(result.success).toBe(false)
    expect(result.errorDetail).toBe('network')
  })

  it('purchase handles unknown error with default errorDetail', async () => {
    mockBilling.NativePurchases.purchaseProduct.mockRejectedValueOnce(new Error('some random error'))
    const result = await provider.purchase('premium_monthly')
    expect(result.success).toBe(false)
    expect(result.errorDetail).toBe('failed')
  })

  it('purchase returns unknown error when billing not available', async () => {
    jest.resetModules()
    jest.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }), { virtual: true })
    jest.doMock('@capgo/native-purchases', () => ({ NativePurchases: null }), { virtual: true })
    const { GooglePlayBillingProvider: fresh } = await import('../GooglePlayBillingProvider')
    const result = await fresh.purchase('premium_monthly')
    expect(result.success).toBe(false)
  })

  it('queryProductDetails returns empty on error', async () => {
    mockBilling.NativePurchases.getProducts.mockRejectedValueOnce(new Error('fetch failed'))
    const plans = await provider.queryProductDetails(['premium_monthly'])
    expect(plans).toEqual([])
  })

  it('restorePurchases returns empty on error', async () => {
    mockBilling.NativePurchases.restorePurchases.mockRejectedValueOnce(new Error('restore failed'))
    const results = await provider.restorePurchases()
    expect(results).toEqual([])
  })
})
