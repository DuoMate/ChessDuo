import { RoomService } from '../roomService'

const mockUpsert = jest.fn()
const mockInsert = jest.fn()
const mockDelete = jest.fn()
const mockEq = jest.fn()
const mockSelect = jest.fn()

function makeDeleteChain() {
  const chain: any = () => chain
  chain.then = (resolve: (v: any) => void) => resolve({ error: null })
  chain.eq = () => chain
  return chain
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockUpsert,
      insert: mockInsert,
      delete: jest.fn(() => makeDeleteChain()),
      eq: mockEq.mockReturnThis(),
      select: mockSelect.mockReturnThis(),
    })),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('RoomService', () => {
  describe('upsertRoomPlayer', () => {
    it('upserts a room player with correct data', async () => {
      mockUpsert.mockResolvedValue({ error: null })

      await RoomService.upsertRoomPlayer({ room_id: 'room-1', player_id: 'user-1', team: 'WHITE', slot: 0 })

      expect(mockUpsert).toHaveBeenCalledWith(
        { room_id: 'room-1', player_id: 'user-1', team: 'WHITE', slot: 0 },
        { onConflict: 'room_id,player_id' },
      )
    })

    it('throws on error', async () => {
      mockUpsert.mockResolvedValue({ error: new Error('DB fail') })

      await expect(RoomService.upsertRoomPlayer({ room_id: 'room-1', player_id: 'user-1', team: 'WHITE', slot: 0 }))
        .rejects.toThrow('DB fail')
    })
  })

  describe('insertRoomPlayer', () => {
    it('inserts a room player', async () => {
      mockInsert.mockResolvedValue({ error: null })

      await RoomService.insertRoomPlayer({ room_id: 'room-1', player_id: 'user-2', team: 'BLACK', slot: 1 })

      expect(mockInsert).toHaveBeenCalledWith({ room_id: 'room-1', player_id: 'user-2', team: 'BLACK', slot: 1 })
    })
  })

  describe('deleteRoomPlayer', () => {
    it('deletes matching room player', async () => {
      mockDelete.mockReturnValue(makeDeleteChain())

      await RoomService.deleteRoomPlayer('room-1', 'user-1')
    })
  })

  describe('deleteRoom', () => {
    it('deletes room by id', async () => {
      mockDelete.mockReturnValue(makeDeleteChain())

      await RoomService.deleteRoom('room-1')
    })
  })

  describe('deleteAllRoomPlayers', () => {
    it('deletes all players for a room', async () => {
      mockDelete.mockReturnValue(makeDeleteChain())

      await RoomService.deleteAllRoomPlayers('room-1')
    })
  })
})
