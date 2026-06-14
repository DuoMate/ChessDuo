import { createBrowserClient } from '@supabase/ssr'

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[supabase] Missing env vars at runtime')
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder')
  }
  
  if (supabaseInstance) return supabaseInstance
  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
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
          insights_reveals_used: number
          is_premium: boolean
          rzp_customer_id: string | null
          rzp_subscription_id: string | null
          rzp_payment_id: string | null
          subscription_status: string
          created_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          insights_reveals_used?: number
          is_premium?: boolean
          rzp_customer_id?: string | null
          rzp_subscription_id?: string | null
          rzp_payment_id?: string | null
          subscription_status?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          insights_reveals_used?: number
          is_premium?: boolean
          rzp_customer_id?: string | null
          rzp_subscription_id?: string | null
          rzp_payment_id?: string | null
          subscription_status?: string
        }
      }
      rooms: {
        Row: {
          id: string
          code: string
          status: 'waiting' | 'playing' | 'finished'
          created_by: string
          created_at: string
          time_seconds: number
          expires_at: string | null
          mode: string | null
        }
        Insert: {
          id?: string
          code: string
          status?: 'waiting' | 'playing' | 'finished'
          created_by: string
          time_seconds?: number
          expires_at?: string | null
          mode?: string
        }
        Update: {
          id?: string
          code?: string
          status?: 'waiting' | 'playing' | 'finished'
          time_seconds?: number
          expires_at?: string | null
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
          challenge_id: string | null
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
          challenge_id?: string | null
          played_at?: string
        }
      }
      friendships: {
        Row: {
          sender_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          sender_id: string
          receiver_id: string
          status?: 'pending' | 'accepted' | 'blocked'
        }
        Update: {
          status?: 'pending' | 'accepted' | 'blocked'
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          content: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          content: string
          read?: boolean
        }
        Update: {
          read?: boolean
        }
      }
      challenge_links: {
        Row: {
          id: string
          creator_id: string
          game_mode: string
          time_seconds: number
          code: string
          created_at: string
          expires_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          creator_id: string
          game_mode: string
          time_seconds: number
          code: string
          expires_at: string
          is_active?: boolean
        }
        Update: {
          is_active?: boolean
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomPlayer = Database['public']['Tables']['room_players']['Row']
export type Friendship = Database['public']['Tables']['friendships']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type ChallengeLink = Database['public']['Tables']['challenge_links']['Row']