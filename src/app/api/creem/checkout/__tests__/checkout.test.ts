/**
 * @jest-environment node
 */

const mockCheckoutsCreate = jest.fn()
const mockGetAuthClientCheckout = jest.fn()

jest.mock('creem', () => ({
  Creem: jest.fn().mockImplementation(() => ({
    checkouts: {
      create: mockCheckoutsCreate,
    },
  })),
}))

jest.mock('@/lib/apiAuth', () => ({
  getAuthClient: mockGetAuthClientCheckout,
}))

jest.mock('@/lib/rateLimit', () => ({
  applyRateLimit: jest.fn().mockReturnValue(null),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  })),
}))

const ORIGINAL_CHECKOUT_ENV = process.env

describe('POST /api/creem/checkout', () => {
  let route: typeof import('../route')

  beforeAll(async () => {
    process.env = { ...ORIGINAL_CHECKOUT_ENV }
    process.env.CREEM_API_KEY = 'creem_test_key'
    process.env.CREEM_PRODUCT_ID_MONTHLY = 'prod-monthly'
    process.env.CREEM_PRODUCT_ID_YEARLY = 'prod-yearly'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://chessduo.workers.dev'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    jest.resetModules()
    route = await import('../route')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_CHECKOUT_ENV }
    process.env.CREEM_API_KEY = 'creem_test_key'
    process.env.CREEM_PRODUCT_ID_MONTHLY = 'prod-monthly'
    process.env.CREEM_PRODUCT_ID_YEARLY = 'prod-yearly'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://chessduo.workers.dev'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockGetAuthClientCheckout.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      supabase: null,
      error: null,
    })

    mockCheckoutsCreate.mockResolvedValue({ id: 'checkout-id-1', checkoutUrl: 'https://checkout.creem.io/sess-1' })
  })

  afterAll(() => {
    process.env = ORIGINAL_CHECKOUT_ENV
  })

  it('creates a checkout with the web success URL by default', async () => {
    const request = new Request('https://chessduo.workers.dev/api/creem/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ productId: 'premium_monthly', userId: 'user-1' }),
    })

    const res = await route.POST(request)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.checkoutUrl).toBe('https://checkout.creem.io/sess-1')
    expect(mockCheckoutsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-monthly',
        successUrl: 'https://chessduo.workers.dev/premium',
      }),
    )
  })

  it('uses the redirect-bridge success URL when isNative is true', async () => {
    const request = new Request('https://chessduo.workers.dev/api/creem/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ productId: 'premium_yearly', userId: 'user-1', isNative: true }),
    })

    const res = await route.POST(request)
    expect(res.status).toBe(200)

    expect(mockCheckoutsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-yearly',
        successUrl: 'https://chessduo.workers.dev/api/creem/return',
      }),
    )
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthClientCheckout.mockResolvedValue({ user: null, supabase: null, error: 'not authed' })

    const request = new Request('https://chessduo.workers.dev/api/creem/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'premium_monthly' }),
    })

    const res = await route.POST(request)
    expect(res.status).toBe(401)
  })
})
