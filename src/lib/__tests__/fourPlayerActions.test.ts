import {
  createFourPlayerRoom,
  joinFourPlayerRoom,
  leaveFourPlayerRoom,
  getFourPlayerSeats,
  areAllSeatsFilled,
  FourPlayerSeat,
} from '../fourPlayerActions'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('fourPlayerActions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createFourPlayerRoom', () => {
    const mockInsert = jest.fn()
    const mockSelect = jest.fn()
    const mockSingle = jest.fn()

    it('should create a room and return correct shape', async () => {
      const roomData = {
        id: 'room-uuid',
        code: 'ABC123',
        status: 'waiting',
        created_by: 'player1',
        time_seconds: 600,
      }
      ;(supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      })
      mockInsert.mockReturnValue({ select: mockSelect })
      mockSelect.mockReturnValue({ single: mockSingle })
      mockSingle.mockResolvedValue({ data: roomData, error: null })

      const result = await createFourPlayerRoom({
        playerId: 'player1',
        timeSeconds: 600,
      })

      expect(result).toEqual({
        roomId: 'room-uuid',
        roomCode: 'ABC123',
        timeSeconds: 600,
      })
      expect(supabase.from).toHaveBeenCalledWith('rooms')
    })

    it('should throw if room creation fails', async () => {
      ;(supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      })
      mockInsert.mockReturnValue({ select: mockSelect })
      mockSelect.mockReturnValue({ single: mockSingle })
      mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })

      await expect(
        createFourPlayerRoom({ playerId: 'player1', timeSeconds: 600 })
      ).rejects.toThrow('DB error')
    })
  })

  describe('joinFourPlayerRoom', () => {
    const mockUpsert = jest.fn()

    it('should join a room seat successfully', async () => {
      ;(supabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      })
      mockUpsert.mockResolvedValue({ error: null })

      await expect(
        joinFourPlayerRoom({
          roomId: 'room-uuid',
          playerId: 'player1',
          team: 'WHITE',
          slot: 0,
        })
      ).resolves.toBeUndefined()

      expect(supabase.from).toHaveBeenCalledWith('room_players')
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          room_id: 'room-uuid',
          player_id: 'player1',
          team: 'WHITE',
          slot: 0,
          status: 'ready',
        },
        { onConflict: 'room_id,player_id' }
      )
    })

    it('should throw if join fails', async () => {
      ;(supabase.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      })
      mockUpsert.mockResolvedValue({ error: { message: 'Seat taken' } })

      await expect(
        joinFourPlayerRoom({
          roomId: 'room-uuid',
          playerId: 'player1',
          team: 'WHITE',
          slot: 0,
        })
      ).rejects.toThrow('Seat taken')
    })
  })

  describe('leaveFourPlayerRoom', () => {
    it('should delete player from room', async () => {
      const mockEq2 = jest.fn().mockResolvedValue({ error: null })
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq1 })
      ;(supabase.from as jest.Mock).mockReturnValue({
        delete: mockDelete,
      })

      await expect(
        leaveFourPlayerRoom({
          roomId: 'room-uuid',
          playerId: 'player1',
        })
      ).resolves.toBeUndefined()

      expect(supabase.from).toHaveBeenCalledWith('room_players')
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('getFourPlayerSeats', () => {
    it('should return 4 seats with correct structure', async () => {
      const mockPlayers = [
        { player_id: 'player1', team: 'WHITE', slot: 0, status: 'ready' },
        { player_id: 'player2', team: 'BLACK', slot: 1, status: 'ready' },
      ]
      const mockProfiles = [
        { id: 'player1', username: 'alice' },
        { id: 'player2', username: 'bob' },
      ]

      const mockIn = jest.fn().mockResolvedValue({ data: mockProfiles, error: null })
      const mockEq = jest.fn().mockResolvedValue({ data: mockPlayers, error: null })

      const mockSelectProfiles = jest.fn().mockReturnValue({ in: mockIn })
      const mockSelectPlayers = jest.fn().mockReturnValue({ eq: mockEq })

      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'room_players') {
          return { select: mockSelectPlayers }
        }
        return { select: mockSelectProfiles }
      })

      const seats = await getFourPlayerSeats('room-uuid')

      expect(seats).toHaveLength(4)
      expect(seats[0]).toMatchObject({
        team: 'WHITE',
        slot: 0,
        playerId: 'player1',
        username: 'alice',
        status: 'ready',
      })
      expect(seats[1]).toMatchObject({
        team: 'WHITE',
        slot: 1,
        playerId: null,
        status: 'empty',
      })
      expect(seats[2]).toMatchObject({
        team: 'BLACK',
        slot: 0,
        playerId: null,
        status: 'empty',
      })
      expect(seats[3]).toMatchObject({
        team: 'BLACK',
        slot: 1,
        playerId: 'player2',
        username: 'bob',
        status: 'ready',
      })
    })

    it('should throw if query fails', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
      ;(supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'room_players') {
          return { select: mockSelect }
        }
        return { select: mockSelect }
      })

      await expect(getFourPlayerSeats('room-uuid')).rejects.toThrow('Query failed')
    })
  })

  describe('areAllSeatsFilled', () => {
    it('should return true when all 4 seats have players', () => {
      const seats: FourPlayerSeat[] = [
        { team: 'WHITE', slot: 0, playerId: 'p1', username: 'alice', status: 'ready' },
        { team: 'WHITE', slot: 1, playerId: 'p2', username: 'bob', status: 'ready' },
        { team: 'BLACK', slot: 0, playerId: 'p3', username: 'charlie', status: 'ready' },
        { team: 'BLACK', slot: 1, playerId: 'p4', username: 'diana', status: 'ready' },
      ]
      expect(areAllSeatsFilled(seats)).toBe(true)
    })

    it('should return false when any seat is empty', () => {
      const seats: FourPlayerSeat[] = [
        { team: 'WHITE', slot: 0, playerId: 'p1', username: 'alice', status: 'ready' },
        { team: 'WHITE', slot: 1, playerId: null, username: null, status: 'empty' },
        { team: 'BLACK', slot: 0, playerId: 'p3', username: 'charlie', status: 'ready' },
        { team: 'BLACK', slot: 1, playerId: 'p4', username: 'diana', status: 'ready' },
      ]
      expect(areAllSeatsFilled(seats)).toBe(false)
    })

    it('should return false when all seats are empty', () => {
      const seats: FourPlayerSeat[] = [
        { team: 'WHITE', slot: 0, playerId: null, username: null, status: 'empty' },
        { team: 'WHITE', slot: 1, playerId: null, username: null, status: 'empty' },
        { team: 'BLACK', slot: 0, playerId: null, username: null, status: 'empty' },
        { team: 'BLACK', slot: 1, playerId: null, username: null, status: 'empty' },
      ]
      expect(areAllSeatsFilled(seats)).toBe(false)
    })
  })
})
