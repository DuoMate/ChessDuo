import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[supabase] Missing env vars at runtime')
    return createClient('https://placeholder.supabase.co', 'placeholder')
  }
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = getSupabaseClient()

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
      completed_games: {
        Row: {
          id: string
          room_id: string | null
          winner: 'WHITE' | 'BLACK' | 'DRAW'
          game_result: string
          game_over_reason: string | null
          white_moves: number
          white_sync_rate: number
          white_conflicts: number
          player1_accuracy: number
          player2_accuracy: number
          total_moves: number
          is_online: boolean
          move_comparisons: unknown
          played_at: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id?: string | null
          winner: 'WHITE' | 'BLACK' | 'DRAW'
          game_result: string
          game_over_reason?: string | null
          white_moves?: number
          white_sync_rate?: number
          white_conflicts?: number
          player1_accuracy?: number
          player2_accuracy?: number
          total_moves?: number
          is_online?: boolean
          move_comparisons?: unknown
          played_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomPlayer = Database['public']['Tables']['room_players']['Row']