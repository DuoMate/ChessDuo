import { checkMyRoomJoined, createQuickMatchRoom } from '../matchmaking'

// ---------------------------------------------------------------------------
// PERF-03: matchmaking queries stay narrow + bounded. checkMyRoomJoined only
// needs to know whether >= 2 rows exist (LIMIT 2 preserves the verdict);
// createQuickMatchRoom's caller consumes id + code only.
// ---------------------------------------------------------------------------

const selectCalls: Array<{ table: string; cols: string }> = []
let limitArg: number | null = null

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'room_players') {
        return {
          insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
          select: jest.fn((cols: string) => {
            selectCalls.push({ table, cols })
            return {
              eq: jest.fn(() => ({
                limit: jest.fn((n: number) => {
                  limitArg = n
                  return Promise.resolve({ data: [{ player_id: 'a' }, { player_id: 'b' }], error: null })
                }),
              })),
            }
          }),
        }
      }
      if (table === 'rooms') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn((cols: string) => {
              selectCalls.push({ table: `${table}:insert`, cols })
              return {
                single: jest.fn(() => Promise.resolve({
                  data: { id: 'room-1', code: 'ABC123' },
                  error: null,
                })),
              }
            }),
          })),
        }
      }
      return { select: jest.fn() }
    }),
  },
}))

jest.mock('@/features/shared/gameTrace', () => ({ emitTrace: jest.fn() }))

beforeEach(() => {
  selectCalls.length = 0
  limitArg = null
  jest.clearAllMocks()
})

describe('matchmaking queries (PERF-03 narrow)', () => {
  it('checkMyRoomJoined bounds the roster scan with LIMIT 2', async () => {
    await expect(checkMyRoomJoined('room-1')).resolves.toBe(true)
    expect(limitArg).toBe(2)
  })

  it('createQuickMatchRoom insert-return selects only id,code', async () => {
    const room = await createQuickMatchRoom('player-1', 600)
    expect(room).not.toBeNull()
    const insertSelect = selectCalls.find(c => c.table === 'rooms:insert')
    expect(insertSelect).toBeDefined()
    expect(insertSelect!.cols).not.toContain('*')
    expect(insertSelect!.cols).toBe('id,code')
  })
})
