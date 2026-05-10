-- Supabase Database Setup for ChessDuo
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (standalone - no auth dependency for now)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  insights_reveals_used INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent: add columns that may be missing on existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insights_reveals_used INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

        -- Create rooms table
        CREATE TABLE IF NOT EXISTS rooms (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code TEXT UNIQUE NOT NULL,
              status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
                created_by TEXT,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                  );

                  -- Create room_players table
                  CREATE TABLE IF NOT EXISTS room_players (
                    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
                      player_id TEXT NOT NULL,
                        team TEXT NOT NULL CHECK (team IN ('WHITE', 'BLACK')),
                          slot INTEGER NOT NULL,
                            status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'locked')),
                              joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                                PRIMARY KEY (room_id, player_id)
                                );

                                -- Create games table for state persistence
                                CREATE TABLE IF NOT EXISTS games (
                                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
                                      fen TEXT NOT NULL,
                                        current_turn TEXT NOT NULL CHECK (current_turn IN ('WHITE', 'BLACK')),
                                          move_history JSONB DEFAULT '[]'::jsonb,
                                            status TEXT DEFAULT 'PLAYING' CHECK (status IN ('PLAYING', 'GAME_OVER')),
                                              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                                              );

                                              -- Create completed_games table for match history/stats
                                              CREATE TABLE IF NOT EXISTS completed_games (
                                                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                                  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
                                                    winner TEXT NOT NULL CHECK (winner IN ('WHITE', 'BLACK', 'DRAW')),
                                                      game_result TEXT NOT NULL,
                                                        game_over_reason TEXT,
                                                          white_moves INTEGER DEFAULT 0,
                                                            white_sync_rate REAL DEFAULT 0,
                                                              white_conflicts INTEGER DEFAULT 0,
                                                                player1_accuracy REAL DEFAULT 0,
                                                                  player2_accuracy REAL DEFAULT 0,
                                                                    total_moves INTEGER DEFAULT 0,
                                                                      is_online BOOLEAN DEFAULT false,
                                                                        move_comparisons JSONB DEFAULT '[]'::jsonb,
                                                                          played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                                                                            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                                                                            );

                                                                            -- Create indexes
                                                                            CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
                                                                            CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
                                                                            CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_id);
                                                                            CREATE INDEX IF NOT EXISTS idx_completed_games_played_at ON completed_games(played_at DESC);

                                                                            -- Enable Row Level Security (RLS)
                                                                            ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
                                                                            ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
                                                                            ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
                                                                            ALTER TABLE games ENABLE ROW LEVEL SECURITY;
                                                                            ALTER TABLE completed_games ENABLE ROW LEVEL SECURITY;

                                                                            -- RLS Policies (idempotent: drops old policies first)
                                                                            -- profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
                                                                            -- rooms
                                                                            DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON rooms;
                                                                            DROP POLICY IF EXISTS "Anyone can create rooms" ON rooms;
                                                                            DROP POLICY IF EXISTS "Authenticated users can create rooms" ON rooms;
                                                                            DROP POLICY IF EXISTS "Room creator can update" ON rooms;
                                                                            -- room_players
                                                                            DROP POLICY IF EXISTS "Room players are viewable by everyone" ON room_players;
                                                                            DROP POLICY IF EXISTS "Room members can view players" ON room_players;
                                                                            DROP POLICY IF EXISTS "Anyone can join rooms" ON room_players;
                                                                            DROP POLICY IF EXISTS "Authenticated users can join rooms" ON room_players;
                                                                            DROP POLICY IF EXISTS "Players can update own record" ON room_players;
                                                                            DROP POLICY IF EXISTS "Players can leave rooms" ON room_players;
                                                                            -- games
                                                                            DROP POLICY IF EXISTS "Room participants can view game" ON games;
                                                                            DROP POLICY IF EXISTS "Anyone can view game state" ON games;
                                                                            DROP POLICY IF EXISTS "Room members can view game" ON games;
                                                                            DROP POLICY IF EXISTS "Anyone can insert game state" ON games;
                                                                            DROP POLICY IF EXISTS "Room members can insert game" ON games;
                                                                            DROP POLICY IF EXISTS "Anyone can update game state" ON games;
                                                                            DROP POLICY IF EXISTS "Room members can update game" ON games;
                                                                            -- completed_games
                                                                            DROP POLICY IF EXISTS "Authenticated users can view completed games" ON completed_games;
                                                                            DROP POLICY IF EXISTS "Authenticated users can insert completed games" ON completed_games;
                                                                            -- function
                                                                            DROP FUNCTION IF EXISTS public.is_room_member(UUID);

                                                                            -- ============================================
                                                                            -- RLS Policies — Production Hardening
                                                                            -- ============================================
                                                                            -- Policies use auth.uid() for authenticated users.
                                                                            -- For anonymous play, the app creates an anonymous Supabase user
                                                                            -- via signInAnonymously(), which provides a real auth.uid().
                                                                            -- ============================================

                                                                            -- profiles
                                                                            CREATE POLICY "Profiles are viewable by everyone" ON profiles
                                                                              FOR SELECT USING (true);

                                                                              CREATE POLICY "Users can insert own profile" ON profiles
                                                                                FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid()::text = id);

                                                                                CREATE POLICY "Users can update own profile" ON profiles
                                                                                  FOR UPDATE USING (auth.uid()::text = id);

                                                                                  -- rooms: public discovery via room codes, authenticated creation/edit
                                                                                  CREATE POLICY "Rooms are viewable by everyone" ON rooms
                                                                                    FOR SELECT USING (true);

                                                                                    CREATE POLICY "Authenticated users can create rooms" ON rooms
                                                                                      FOR INSERT WITH CHECK (auth.role() = 'authenticated');

                                                                                      CREATE POLICY "Room creator can update" ON rooms
                                                                                        FOR UPDATE USING (auth.uid()::text = created_by);

                                                                                        -- Helper function: checks room membership without RLS (avoids recursion)
                                                                                        CREATE OR REPLACE FUNCTION public.is_room_member(check_room_id UUID)
                                                                                        RETURNS BOOLEAN
                                                                                        LANGUAGE sql
                                                                                        SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_players
                                                                                                  WHERE room_id = check_room_id
                                                                                                        AND player_id = auth.uid()::text
                                                                                                          )
                                                                                                          $$;

                                                                                                          -- room_players: must be room member to view players list
                                                                                                          CREATE POLICY "Room members can view players" ON room_players
                                                                                                            FOR SELECT USING (
                                                                                                                auth.uid() IS NOT NULL
                                                                                                                    AND is_room_member(room_id)
                                                                                                                      );

                                                                                                                      CREATE POLICY "Authenticated users can join rooms" ON room_players
                                                                                                                        FOR INSERT WITH CHECK (
                                                                                                                            auth.role() = 'authenticated'
                                                                                                                                AND auth.uid()::text = player_id
                                                                                                                                  );

                                                                                                                                  CREATE POLICY "Players can leave rooms" ON room_players
                                                                                                                                    FOR DELETE USING (
                                                                                                                                        auth.uid()::text = player_id
                                                                                                                                          );

                                                                                                                                          CREATE POLICY "Players can update own record" ON room_players
                                                                                                                                            FOR UPDATE USING (auth.uid()::text = player_id);

                                                                                                                                            -- games: must be room member for all operations
                                                                                                                                            CREATE POLICY "Room members can view game" ON games
                                                                                                                                              FOR SELECT USING (
                                                                                                                                                  auth.uid() IS NOT NULL AND is_room_member(room_id)
                                                                                                                                                    );

                                                                                                                                                    CREATE POLICY "Room members can insert game" ON games
                                                                                                                                                      FOR INSERT WITH CHECK (
                                                                                                                                                          auth.uid() IS NOT NULL AND is_room_member(room_id)
                                                                                                                                                            );

                                                                                                                                                            CREATE POLICY "Room members can update game" ON games
                                                                                                                                                              FOR UPDATE USING (
                                                                                                                                                                  auth.uid() IS NOT NULL AND is_room_member(room_id)
                                                                                                                                                                    );

                                                                                                                                                                    -- completed_games: authenticated users can view and insert
                                                                                                                                                                    CREATE POLICY "Authenticated users can view completed games" ON completed_games
                                                                                                                                                                      FOR SELECT USING (auth.role() = 'authenticated');

                                                                                                                                                                      CREATE POLICY "Authenticated users can insert completed games" ON completed_games
                                                                                                                                                                        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

                                                                                                                                                                        -- Function to auto-create profile on signup
                                                                                                                                                                        CREATE OR REPLACE FUNCTION public.handle_new_user()
                                                                                                                                                                        RETURNS TRIGGER AS $$
                                                                                                                                                                        BEGIN
                                                                                                                                                                          INSERT INTO public.profiles (id, username)
                                                                                                                                                                              VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Player'));
                                                                                                                                                                                RETURN NEW;
                                                                                                                                                                                END;
                                                                                                                                                                                $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                                                                                                                                -- Trigger for new user signup
                                                                                                                                                                                DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
                                                                                                                                                                                CREATE TRIGGER on_auth_user_created
                                                                                                                                                                                  AFTER INSERT ON auth.users
                                                                                                                                                                                    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
                                                                                                                                                                                    