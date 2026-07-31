/**
 * @jest-environment node
 */

const mockCheckoutsRetrieve = jest.fn()
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn()
const mockSelectMaybeSingle = jest.fn()
let capturedHandlers: Record<string, (...args: any[]) => any> = {}

jest.mock('@creem_io/nextjs', () => ({
  Webhook: jest.fn((config: Record<string, (...args: any[]) => any>) => {
    capturedHandlers = config
    return jest.fn()
  }),
}))

jest.mock('creem', () => ({
  Creem: jest.fn().mockImplementation(() => ({
    checkouts: {
      retrieve: mockCheckoutsRetrieve,
    },
  })),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: mockSelectMaybeSingle,
        }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: mockUpdateEq,
      }),
    })),
  })),
}))

const ORIGINAL_ENV = process.env

describe('POST /api/creem/webhook (handlers)', () => {
  beforeAll(async () => {
    jest.resetModules()
    capturedHandlers = {}
    process.env = { ...ORIGINAL_ENV }
    process.env.CREEM_API_KEY = 'creem_test_key'
    process.env.CREEM_WEBHOOK_SECRET = 'whsec_test'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    await import('../route')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateEq.mockResolvedValue({ error: null })
    // Profile exists — update succeeds and select finds the row
    mockSelectMaybeSingle.mockResolvedValue({ data: { id: 'user-1' }, error: null })
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  function expectGranted(userId: string) {
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_premium: true,
        subscription_provider: 'CREEM',
      }),
    )
  }

  it('onCheckoutCompleted grants from event metadata', async () => {
    await capturedHandlers.onCheckoutCompleted({
      id: 'checkout-1',
      customer: { email: 'buyer@example.com' },
      product: { name: 'ChessDuo Monthly' },
      metadata: { referenceId: 'user-1', plan: 'monthly' },
      subscription: { current_period_end_date: '2026-08-30T00:00:00.000Z' },
    })

    expectGranted('user-1')
    expect(mockCheckoutsRetrieve).not.toHaveBeenCalled()
  })

  it('onCheckoutCompleted falls back to checkouts.retrieve when metadata is empty (Bug 40)', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      metadata: { referenceId: 'user-2' },
    })

    await capturedHandlers.onCheckoutCompleted({
      id: 'checkout-2',
      customer: undefined,
      product: undefined,
      metadata: undefined,
      subscription: null,
    })

    expect(mockCheckoutsRetrieve).toHaveBeenCalledWith('checkout-2')
    expectGranted('user-2')
  })

  it('onCheckoutCompleted resolves 200 (no throw, no upsert) when userId is unresolvable', async () => {
    mockCheckoutsRetrieve.mockResolvedValue({
      metadata: {},
    })

    await expect(
      capturedHandlers.onCheckoutCompleted({
        id: 'checkout-3',
        customer: undefined,
        product: undefined,
        metadata: undefined,
        subscription: null,
      }),
    ).resolves.toBeUndefined()

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('onCheckoutCompleted does not throw when checkouts.retrieve fails', async () => {
    mockCheckoutsRetrieve.mockRejectedValue(new Error('creem down'))

    await expect(
      capturedHandlers.onCheckoutCompleted({
        id: 'checkout-4',
        customer: undefined,
        product: undefined,
        metadata: {},
        subscription: null,
      }),
    ).resolves.toBeUndefined()

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('onGrantAccess grants from metadata.referenceId', async () => {
    await capturedHandlers.onGrantAccess({
      id: 'sub-1',
      metadata: { referenceId: 'user-5' },
      current_period_end_date: '2026-08-30T00:00:00.000Z',
    })

    expectGranted('user-5')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_expiry_date: '2026-08-30T00:00:00.000Z' }),
    )
  })

  it('onGrantAccess does not throw when metadata is missing and no checkout id exists', async () => {
    await expect(
      capturedHandlers.onGrantAccess({
        id: undefined,
        metadata: {},
        current_period_end_date: undefined,
      }),
    ).resolves.toBeUndefined()

    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

export {}
