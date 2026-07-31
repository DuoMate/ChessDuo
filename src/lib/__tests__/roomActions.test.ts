import { generateRoomCode, createOnlineRoom } from '../roomActions'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('generateRoomCode', () => {
  it('should return a 6-character string', () => {
    const code = generateRoomCode()
    expect(typeof code).toBe('string')
    expect(code.length).toBe(6)
  })

  it('should only contain valid characters', () => {
    const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = generateRoomCode()
    for (const char of code) {
      expect(validChars.includes(char)).toBe(true)
    }
  })

  it('should not contain confusing characters', () => {
    const code = generateRoomCode()
    expect(code).not.toMatch(/[IO01]/)
  })

  it('should generate different codes each time', () => {
    const code1 = generateRoomCode()
    const code2 = generateRoomCode()
    expect(code1).not.toBe(code2)
  })
})

describe('createOnlineRoom', () => {
  const mockFrom = jest.fn()
  const mockInsert = jest.fn()
  const mockSelect = jest.fn()
  const mockSingle = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabase.from as jest.Mock).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    })
    mockInsert.mockReturnValue({ select: mockSelect })
  })

  it('should create a room and return correct shape', async () => {
    const roomData = { id: 'room-uuid', code: 'ABC123', status: 'waiting', created_by: 'player1' }
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: roomData, error: null })

    // Mock room_players insert
    const playersInsert = jest.fn().mockResolvedValue({ error: null })
    const playersFrom = jest.fn().mockReturnValue({ insert: playersInsert })
    ;(supabase.from as jest.Mock)
      .mockReturnValueOnce({ insert: mockInsert }) // rooms.from
      .mockReturnValueOnce({ insert: playersInsert }) // room_players.from

    // Reconfigure insert to return select correctly
    mockInsert.mockReturnValue({ select: mockSelect })

    const result = await createOnlineRoom({ playerId: 'player1', timeSeconds: 600 })

    expect(result).toEqual({
      roomId: 'room-uuid',
      roomCode: 'ABC123',
      team: 'WHITE',
      playerId: 'player1',
      time: 600,
    })
  })

  it('should store host_team on the room row so joiners can derive the host team (Bug 39)', async () => {
    const roomData = { id: 'room-uuid', code: 'ABC123', status: 'waiting', created_by: 'player1' }
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: roomData, error: null })

    const playersInsert = jest.fn().mockResolvedValue({ error: null })
    ;(supabase.from as jest.Mock)
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ insert: playersInsert })

    mockInsert.mockReturnValue({ select: mockSelect })

    const result = await createOnlineRoom({ playerId: 'player1', timeSeconds: 600, hostColor: 'black' })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ host_team: 'BLACK' }),
    )
    expect(result.team).toBe('BLACK')
  })

  it('should throw if room creation fails', async () => {
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    mockInsert.mockReturnValue({ select: mockSelect })

    await expect(createOnlineRoom({ playerId: 'player1', timeSeconds: 600 }))
      .rejects.toThrow('DB error')
  })

  it('should throw if player insert fails', async () => {
    const roomData = { id: 'room-uuid', code: 'ABC123', status: 'waiting', created_by: 'player1' }
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: roomData, error: null })

    const playersInsert = jest.fn().mockResolvedValue({ error: { message: 'Player insert error' } })
    ;(supabase.from as jest.Mock)
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ insert: playersInsert })

    mockInsert.mockReturnValue({ select: mockSelect })

    await expect(createOnlineRoom({ playerId: 'player1', timeSeconds: 600 }))
      .rejects.toThrow('Player insert error')
  })
})
