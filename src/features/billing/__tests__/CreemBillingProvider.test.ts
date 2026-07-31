import type { BillingProvider } from '../types'

const ORIGINAL_FETCH = global.fetch

function mockFetchOnce(data: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

function mockFetchError() {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('network error'))
}

describe('CreemBillingProvider', () => {
  let CreemBillingProvider: BillingProvider

  beforeAll(async () => {
    jest.resetModules()
    const mod = await import('../CreemBillingProvider')
    CreemBillingProvider = mod.CreemBillingProvider
  })

  beforeEach(() => {
    global.fetch = ORIGINAL_FETCH
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.fetch = ORIGINAL_FETCH
  })

  describe('initialize', () => {
    it('returns true', async () => {
      const result = await CreemBillingProvider.initialize()
      expect(result).toBe(true)
    })
  })

  describe('purchase', () => {
    it('creates checkout and returns checkoutUrl', async () => {
      mockFetchOnce({ checkoutUrl: 'https://checkout.creem.io/test-session' })

      jest.mock('@/lib/authService', () => ({
        AuthService: { getSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }) },
      }))

      const result = await CreemBillingProvider.purchase('premium_monthly')
      expect(result.success).toBe(true)
      expect(result.checkoutUrl).toBe('https://checkout.creem.io/test-session')
      expect(result.productId).toBe('premium_monthly')
    })

    it('passes isNative true and opens the system browser on Capacitor', async () => {
      mockFetchOnce({ checkoutUrl: 'https://checkout.creem.io/test-session' })

      jest.mock('@/lib/authService', () => ({
        AuthService: { getSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }) },
      }))
      jest.mock('@capacitor/browser', () => ({
        Browser: { open: jest.fn() },
      }))

      const nativeWindow = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
      nativeWindow.Capacitor = { isNativePlatform: () => true }

      try {
        const { Browser } = await import('@capacitor/browser')
        const result = await CreemBillingProvider.purchase('premium_monthly')

        expect(result.success).toBe(true)
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/creem/checkout'),
          expect.objectContaining({
            body: JSON.stringify({ productId: 'premium_monthly', userId: 'user-1', isNative: true }),
          }),
        )
        expect(Browser.open).toHaveBeenCalledWith({
          url: 'https://checkout.creem.io/test-session',
          windowName: '_system',
        })
      } finally {
        delete nativeWindow.Capacitor
      }
    })

    it('returns failure when checkout creation fails', async () => {
      mockFetchOnce({ error: 'server error' }, false)

      const result = await CreemBillingProvider.purchase('premium_yearly')
      expect(result.success).toBe(false)
    })

    it('handles fetch error gracefully', async () => {
      mockFetchError()

      const result = await CreemBillingProvider.purchase('premium_monthly')
      expect(result.success).toBe(false)
    })
  })

  describe('queryProductDetails', () => {
    it('returns filtered product details', async () => {
      mockFetchOnce([
        { productId: 'premium_monthly', title: 'Monthly', price: '$1.99', billingPeriod: 'monthly' },
        { productId: 'premium_yearly', title: 'Annual', price: '$14.99', billingPeriod: 'yearly' },
      ])

      const plans = await CreemBillingProvider.queryProductDetails(['premium_monthly'])
      expect(plans).toHaveLength(1)
      expect(plans[0].productId).toBe('premium_monthly')
    })
  })

  describe('restorePurchases', () => {
    it('returns empty array when no user session', async () => {
      const result = await CreemBillingProvider.restorePurchases()
      expect(result).toEqual([])
    })
  })

  describe('isAvailable', () => {
    it('returns true when products endpoint responds', async () => {
      mockFetchOnce(null, true)
      const available = await CreemBillingProvider.isAvailable()
      expect(available).toBe(true)
    })
  })

  describe('acknowledgePurchase', () => {
    it('is a no-op', async () => {
      await expect(CreemBillingProvider.acknowledgePurchase('token', 'prod-1')).resolves.toBeUndefined()
    })
  })
})
