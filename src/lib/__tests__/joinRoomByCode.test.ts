import { joinRoomByCode, messageForDuoJoinError, type DuoJoinError } from '../roomActions'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { getSession: jest.fn() },
  },
}))

const mockRpc = supabase.rpc as jest.Mock
const mockGetSession = supabase.auth.getSession as jest.Mock

const successRow = {
  room_id: '11111111-1111-1111-1111-111111111111',
  code: 'ABC123',
  team: 'BLACK',
  slot: 1,
  status: 'waiting',
  mode: 'online',
  host_team: 'BLACK',
  created_by: '22222222-2222-2222-2222-222222222222',
  time_seconds: 600,
  game_id: null,
  game_status: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
})

describe('joinRoomByCode', () => {
  it('normalizes (trims + uppercases) the code before calling the RPC', async () => {
    mockRpc.mockResolvedValue({ data: [successRow], error: null })
    await joinRoomByCode('  abc123  ')
    expect(mockRpc).toHaveBeenCalledWith('join_room_by_code', { p_code: 'ABC123' })
  })

  it('maps a single result row to the typed result', async () => {
    mockRpc.mockResolvedValue({ data: [successRow], error: null })
    const result = await joinRoomByCode('ABC123')
    expect(result).toEqual({
      roomId: '11111111-1111-1111-1111-111111111111',
      code: 'ABC123',
      team: 'BLACK',
      slot: 1,
      status: 'waiting',
      mode: 'online',
      hostTeam: 'BLACK',
      createdBy: '22222222-2222-2222-2222-222222222222',
      timeSeconds: 600,
      gameId: null,
      gameStatus: null,
    })
  })

  it('accepts a bare object result (not wrapped in an array)', async () => {
    mockRpc.mockResolvedValue({ data: successRow, error: null })
    const result = await joinRoomByCode('ABC123')
    expect(result.team).toBe('BLACK')
  })

  it('throws a DuoJoinError carrying the underlying code and message', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'P0003', message: 'ROOM_FULL' },
    })
    let err: DuoJoinError | undefined
    try {
      await joinRoomByCode('ABC123')
    } catch (e) {
      err = e as DuoJoinError
    }
    expect(err!.code).toBe('P0003')
    expect(err!.rawMessage).toBe('ROOM_FULL')
    expect(err!.message).toBe('Room is full')
  })

  it('maps an empty RPC result to ROOM_NOT_FOUND', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    let err: DuoJoinError | undefined
    try {
      await joinRoomByCode('ABC123')
    } catch (e) {
      err = e as DuoJoinError
    }
    expect(err!.code).toBe('P0001')
    expect(err!.message).toBe('Room not found — check the code')
  })
})

describe('messageForDuoJoinError', () => {
  const cases: Array<[string, string]> = [
    ['42501', 'Please sign in to join a room'],
    ['P0001', 'Room not found — check the code'],
    ['P0002', 'Room has expired'],
    ['P0003', 'Room is full'],
    ['P0004', 'Room is no longer available'],
  ]
  it.each(cases)('maps code %s to %s', (code, message) => {
    expect(messageForDuoJoinError({ code })).toBe(message)
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(messageForDuoJoinError({ code: 'UNKNOWN' })).toBe('Something went wrong — try again')
    expect(messageForDuoJoinError(null)).toBe('Something went wrong — try again')
  })
})
