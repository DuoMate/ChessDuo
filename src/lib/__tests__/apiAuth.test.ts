/**
 * @jest-environment node
 */

import { getAuthClient } from '../apiAuth'

const mockCookieGetAll = jest.fn()
const mockSupabaseGetUser = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    getAll: mockCookieGetAll,
  })),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, _key: string, opts?: any) => ({
    auth: {
      getUser: mockSupabaseGetUser,
    },
    rpc: jest.fn(),
  })),
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn((_url: string, _key: string, opts: any) => ({
    auth: {
      getUser: mockSupabaseGetUser,
    },
    rpc: jest.fn(),
  })),
}))

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
})

function makeRequest(headers?: Record<string, string>): Request {
  const h = new Headers(headers)
  return new Request('https://test.com/api/test', { method: 'GET', headers: h })
}

describe('getAuthClient (API auth helper)', () => {
  it('uses Bearer token auth when Authorization header is present', async () => {
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@test.com' } },
    })

    const { user, supabase, error } = await getAuthClient(
      makeRequest({ authorization: 'Bearer test-token' }),
      'test-route',
      'req-1',
    )

    expect(error).toBeNull()
    expect(user).toEqual({ id: 'user-1', email: 'test@test.com' })
    expect(supabase).toBeDefined()
    expect(mockSupabaseGetUser).toHaveBeenCalledWith('test-token')
  })

  it('falls back to cookie auth when no Bearer header', async () => {
    mockCookieGetAll.mockReturnValue([])
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: 'cookie-user', email: 'cookie@test.com' } },
    })

    const { user, error } = await getAuthClient(
      makeRequest({ 'content-type': 'application/json' }),
      'test-route',
      'req-2',
    )

    expect(error).toBeNull()
    expect(user).toEqual({ id: 'cookie-user', email: 'cookie@test.com' })
  })

  it('falls back to cookie auth when Authorization header is present but not Bearer', async () => {
    mockCookieGetAll.mockReturnValue([])
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: 'cookie-user' } },
    })

    const { user } = await getAuthClient(
      makeRequest({ authorization: 'Basic xxx' }),
      'test-route',
      'req-3',
    )

    expect(user).toEqual({ id: 'cookie-user' })
  })

  it('returns null user when both auth methods fail', async () => {
    mockSupabaseGetUser.mockResolvedValue({ data: { user: null } })

    const { user } = await getAuthClient(
      makeRequest({ authorization: 'Bearer invalid' }),
      'test-route',
      'req-4',
    )

    expect(user).toBeNull()
  })

  it('handles empty Authorization header gracefully', async () => {
    mockCookieGetAll.mockReturnValue([])
    mockSupabaseGetUser.mockResolvedValue({ data: { user: null } })

    const { user } = await getAuthClient(
      makeRequest({ authorization: '' }),
      'test-route',
      'req-5',
    )

    expect(user).toBeNull()
  })
})
