/**
 * @jest-environment node
 */

const mockCheckoutsRetrieve = jest.fn()
const mockFrom = jest.fn()
const mockGetAuthClient = jest.fn()

jest.mock('creem', () => ({
  Creem: jest.fn().mockImplementation(() => ({
    checkouts: {
      retrieve: mockCheckoutsRetrieve,
    },
  })),
}))

jest.mock('@/lib/apiAuth', () => ({
  getAuthClient: mockGetAuthClient,
}))

jest.mock('@/lib/rateLimit', () => ({
  applyRateLimit: jest.fn().mockReturnValue(null),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}))

const ORIGINAL_ENV = process.env

describe('GET /api/creem/verify-checkout', () => {
  let route: typeof import('../route')

  beforeAll(async () => {
    jest.resetModules()
    route = await import('../route')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
    process.env.CREEM_API_KEY = 'creem_test_key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockGetAuthClient.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      supabase: { from: mockFrom },
      error: null,
    })

    mockFrom.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('grants premium when checkout is completed and belongs to the user', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      status: 'completed',
      metadata: { referenceId: 'user-1', plan: 'monthly' },
      product: { billingPeriod: 'every-month' },
      subscription: { current_period_end_date: '2026-08-30T00:00:00.000Z' },
    })

    const request = new Request('https://chessduo.app/api/creem/verify-checkout?session_id=sess-1', {
      headers: { Authorization: 'Bearer test-token' },
    })

    const res = await route.GET(request)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.verified).toBe(true)
    expect(data.status.isPremium).toBe(true)
    expect(data.status.subscriptionPlan).toBe('monthly')
    expect(data.status.subscriptionExpiryDate).toBe('2026-08-30T00:00:00.000Z')

    const upsert = mockFrom().upsert
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        is_premium: true,
        subscription_provider: 'CREEM',
        subscription_plan: 'monthly',
        purchase_token: 'sess-1',
      }),
      { onConflict: 'id' },
    )
  })

  it('maps every-year billing to yearly plan', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      status: 'completed',
      metadata: { referenceId: 'user-1' },
      product: { billingPeriod: 'every-year' },
    })

    const request = new Request('https://chessduo.app/api/creem/verify-checkout?session_id=sess-2', {
      headers: { Authorization: 'Bearer test-token' },
    })

    const res = await route.GET(request)
    const data = await res.json()
    expect(data.status.subscriptionPlan).toBe('yearly')
  })

  it('returns not verified when checkout is still processing', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      status: 'processing',
      metadata: { referenceId: 'user-1' },
    })

    const request = new Request('https://chessduo.app/api/creem/verify-checkout?session_id=sess-3', {
      headers: { Authorization: 'Bearer test-token' },
    })

    const res = await route.GET(request)
    const data = await res.json()
    expect(data.verified).toBe(false)
    expect(data.status).toBe('processing')
    expect(mockFrom().upsert).not.toHaveBeenCalled()
  })

  it('grants when the subscription is completed even if checkout status is transient (Bug 40)', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      status: 'pending',
      metadata: { referenceId: 'user-1' },
      subscription: { status: 'paid', current_period_end_date: '2026-09-01T00:00:00.000Z' },
    })

    const request = new Request('https://chessduo.app/api/creem/verify-checkout?session_id=sess-3b', {
      headers: { Authorization: 'Bearer test-token' },
    })

    const res = await route.GET(request)
    const data = await res.json()
    expect(data.verified).toBe(true)
    expect(mockFrom().upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', is_premium: true, purchase_token: 'sess-3b' }),
      { onConflict: 'id' },
    )
  })

  it('rejects checkout belonging to another user', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      status: 'completed',
      metadata: { referenceId: 'user-999' },
    })

    const request = new Request('https://chessduo.app/api/creem/verify-checkout?session_id=sess-4', {
      headers: { Authorization: 'Bearer test-token' },
    })

    const res = await route.GET(request)
    expect(res.status).toBe(403)
    expect(mockFrom().upsert).not.toHaveBeenCalled()
  })

  it('rejects missing session_id', async () => {
    const request = new Request('https://chessduo.app/api/creem/verify-checkout', {
      headers: { Authorization: 'Bearer test-token' },
    })

    const res = await route.GET(request)
    expect(res.status).toBe(400)
  })

  it('returns 500 when Supabase update fails', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      status: 'completed',
      metadata: { referenceId: 'user-1' },
    })
    mockFrom.mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: new Error('db down') }),
    })

    const request = new Request('https://chessduo.app/api/creem/verify-checkout?session_id=sess-5', {
      headers: { Authorization: 'Bearer test-token' },
    })

    const res = await route.GET(request)
    expect(res.status).toBe(500)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthClient.mockResolvedValue({ user: null, supabase: null, error: 'not authed' })

    const request = new Request('https://chessduo.app/api/creem/verify-checkout?session_id=sess-6', {})
    const res = await route.GET(request)
    expect(res.status).toBe(401)
  })
})

export {}
