import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
        }
      }
      rooms: {
        Row: {
          id: string
          code: string
          status: 'waiting' | 'playing' | 'finished'
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          status?: 'waiting' | 'playing' | 'finished'
          created_by: string
        }
        Update: {
          id?: string
          code?: string
          status?: 'waiting' | 'playing' | 'finished'
        }
      }
      room_players: {
        Row: {
          room_id: string
          player_id: string
          team: 'WHITE' | 'BLACK'
          slot: number
          status: 'waiting' | 'ready' | 'locked'
          joined_at: string
        }
        Insert: {
          room_id: string
          player_id: string
          team: 'WHITE' | 'BLACK'
          slot: number
        }
        Update: {
          status?: 'waiting' | 'ready' | 'locked'
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomPlayer = Database['public']['Tables']['room_players']['Row']