import { supabase } from './supabase'

interface RoomPlayerInsert {
  room_id: string
  player_id: string
  team: 'WHITE' | 'BLACK'
  slot: number
}

export const RoomService = {
  async upsertRoomPlayer(data: RoomPlayerInsert): Promise<void> {
    const { error } = await supabase.from('room_players').upsert(data, { onConflict: 'room_id,player_id' })
    if (error) throw error
  },

  async insertRoomPlayer(data: RoomPlayerInsert): Promise<void> {
    const { error } = await supabase.from('room_players').insert(data)
    if (error) throw error
  },

  async deleteRoomPlayer(roomId: string, playerId: string): Promise<void> {
    const { error } = await supabase.from('room_players').delete().eq('room_id', roomId).eq('player_id', playerId)
    if (error) throw error
  },

  async deleteAllRoomPlayers(roomId: string): Promise<void> {
    const { error } = await supabase.from('room_players').delete().eq('room_id', roomId)
    if (error) throw error
  },

  async deleteRoom(roomId: string): Promise<void> {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId)
    if (error) throw error
  },
}
