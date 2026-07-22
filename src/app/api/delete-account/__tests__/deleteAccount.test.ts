/**
 * @jest-environment node
 */

globalThis.Request = class Request {
  url: string
  method: string
  headers: Headers
  body: any
  constructor(input: string | URL, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.toString()
    this.method = init?.method || 'GET'
    this.headers = new Headers(init?.headers as Record<string, string>)
    this.body = init?.body
  }
} as any

const mockDeleteUser = jest.fn()
const mockRpc = jest.fn()
const mockSignOut = jest.fn()
const mockGetUser = jest.fn()
const mockCookieGetAll = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, key: string, _opts?: any) => {
    if (key === 'service-role-key') {
      return {
        auth: {
          admin: {
            deleteUser: mockDeleteUser,
          },
        },
      }
    }
    return {
      auth: {
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
      rpc: mockRpc,
    }
  }),
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn((_url: string, _key: string, _opts: any) => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
    rpc: mockRpc,
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    getAll: () => mockCookieGetAll(),
  })),
}))

const { POST } = require('../route')

function mockRequest(authHeader?: string) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (authHeader) headers.set('authorization', authHeader)
  return new Request('https://chessduo.com/api/delete-account', {
    method: 'POST',
    headers,
  })
}

describe('DELETE /api/delete-account', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    mockCookieGetAll.mockReturnValue([])
  })

  it('returns 401 when no auth is provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Not authenticated')
  })

  it('calls delete_my_account RPC then admin.deleteUser with Bearer token', async () => {
    const userId = 'user-abc-123'
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })
    mockRpc.mockResolvedValue({ error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
    mockSignOut.mockResolvedValue({ error: null })

    const res = await POST(mockRequest('Bearer valid-token'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('delete_my_account')
    expect(mockDeleteUser).toHaveBeenCalledWith(userId)
  })

  it('calls signOut after successful deletion via cookies', async () => {
    const userId = 'user-def-456'
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })
    mockRpc.mockResolvedValue({ error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
    mockSignOut.mockResolvedValue({ error: null })

    const res = await POST(mockRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('returns 500 if delete_my_account RPC fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ error: { message: 'RPC failed' } })
    mockDeleteUser.mockResolvedValue({ error: null })

    const res = await POST(mockRequest('Bearer token'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('RPC failed')
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('returns 500 if admin.deleteUser fails after RPC succeeds', async () => {
    const userId = 'user-ghi-789'
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })
    mockRpc.mockResolvedValue({ error: null })
    mockDeleteUser.mockResolvedValue({
      error: { message: 'Failed to delete auth user' },
    })

    const res = await POST(mockRequest('Bearer token'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('Failed to delete auth user')
  })

  it('returns 500 if SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ error: null })

    const res = await POST(mockRequest('Bearer token'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('Service role key is not configured')
  })

  it('still returns 200 if signOut warns but deletion succeeded', async () => {
    const userId = 'user-jkl'
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } })
    mockRpc.mockResolvedValue({ error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
    mockSignOut.mockResolvedValue({ error: { message: 'Session not found' } })

    const res = await POST(mockRequest('Bearer token'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
