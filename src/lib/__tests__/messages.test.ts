import { sendMessage } from '../messages'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn().mockReturnValue({
      send: jest.fn(),
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
  },
}))

import { supabase } from '../supabase'

function mockChain(overrides: Record<string, jest.Mock> = {}) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  }
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('sendMessage', () => {
  it('sends a message and returns data', async () => {
    const msg = {
      id: 'msg1',
      sender_id: 'user1',
      receiver_id: 'user2',
      content: 'Hello!',
      read: false,
      created_at: new Date().toISOString(),
    }

    mockChain({
      single: jest.fn().mockResolvedValueOnce({ data: msg, error: null }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: msg, error: null }),
        }),
      }),
    })

    const result = await sendMessage('user1', 'user2', 'Hello!')
    expect(result.error).toBeNull()
    expect(result.data?.content).toBe('Hello!')
  })

  it('returns error on failure', async () => {
    ;(supabase.from as jest.Mock).mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    const result = await sendMessage('user1', 'user2', 'Hi')
    expect(result.error).toBe('DB error')
    expect(result.data).toBeNull()
  })
})

describe('getConversation', () => {
  it('fetches conversation between two users', async () => {
    const { getConversation } = require('../messages')
    ;(supabase.from as jest.Mock).mockReturnValue({
      select: () => ({
        or: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [
                { id: '1', sender_id: 'user1', content: 'Hi' },
                { id: '2', sender_id: 'user2', content: 'Hey' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    })

    const result = await getConversation('user1', 'user2')
    expect(result.length).toBe(2)
  })
})
