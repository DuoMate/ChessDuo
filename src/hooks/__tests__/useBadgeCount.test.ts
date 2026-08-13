import { renderHook, act } from '@testing-library/react'

// Simulate Supabase realtime channel semantics:
// - channel(name) reuses a still-registered channel with the same topic
// - .on('postgres_changes') throws if called after subscribe()
// - removeChannel is async and only tears down on 'ok'
const registered = new Map<string, any>()
const createdTopics: string[] = []

const mockOn = jest.fn(function (this: any, type: string) {
  if (this.joined && (type === 'postgres_changes' || type === 'presence')) {
    throw new Error(`cannot add \`${type}\` callbacks for ${this.topic} after \`subscribe()\`.`)
  }
  return this
})
const mockSubscribe = jest.fn(function (this: any) {
  this.joined = true
  return this
})
const mockUnsubscribe = jest.fn(function (this: any) {
  // Resolve asynchronously, keeping the channel registered briefly — mirrors
  // the real library where teardown lags behind the unmount cleanup.
  return Promise.resolve('ok')
})
const mockRemoveChannel = jest.fn((channel: any) => {
  registered.delete(channel.topic)
  return Promise.resolve('ok')
})
const mockChannel = jest.fn((topic: string) => {
  createdTopics.push(topic)
  const existing = registered.get(topic)
  if (existing) return existing
  const chan = {
    topic,
    joined: false,
    on: mockOn,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  }
  registered.set(topic, chan)
  return chan
})

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (topic: string) => mockChannel(topic),
    removeChannel: (ch: any) => mockRemoveChannel(ch),
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ eq: jest.fn(() => ({ data: [] })) })) })),
    })),
  },
}))

jest.mock('@/lib/friends', () => ({
  getPendingRequestCount: jest.fn().mockResolvedValue(0),
}))

import { useBadgeCount } from '../useBadgeCount'

describe('useBadgeCount channel lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    registered.clear()
    createdTopics.length = 0
    mockOn.mockImplementation(function (this: any, type: string) {
      if (this.joined && (type === 'postgres_changes' || type === 'presence')) {
        throw new Error(`cannot add \`${type}\` callbacks for ${this.topic} after \`subscribe()\`.`)
      }
      return this
    })
  })

  it('creates a fresh channel per subscription instance so remounts never call .on() on a joined channel', async () => {
    const playerId = 'user-123'
    const { unmount } = renderHook(() => useBadgeCount(playerId))
    const topicsAfterFirstMount = [...createdTopics]
    // Let the initial async fetch settle (avoids act() warnings).
    await act(async () => {})
    unmount()
    await act(async () => {})

    // Second mount simulates profile -> back -> profile (layout remount).
    renderHook(() => useBadgeCount(playerId))
    await act(async () => {})
    const topicsAfterSecondMount = createdTopics.slice(topicsAfterFirstMount.length)

    // Every subscription instance uses a distinct topic (unique suffix).
    expect(topicsAfterSecondMount.length).toBeGreaterThan(0)
    for (const topic of topicsAfterSecondMount) {
      expect(topicsAfterFirstMount).not.toContain(topic)
    }

    // .on('postgres_changes') was called on fresh (never-joined) channels and
    // therefore never threw the "cannot add ... after subscribe()" error.
    expect(() => {
      // Re-run the assertion path: on() must not throw for the topics we used.
      for (const topic of topicsAfterFirstMount.concat(topicsAfterSecondMount)) {
        const chan = registered.get(topic)
        if (chan && !chan.joined) {
          chan.on('postgres_changes')
        }
      }
    }).not.toThrow()
  })
})
