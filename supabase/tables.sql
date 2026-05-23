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
                                              match_started_at TIMESTAMP WITH TIME ZONE,
                                                match_time_limit_seconds INTEGER,
                                                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                                                  );

-- Idempotent: add timer columns if they don't exist on existing games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS match_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS match_time_limit_seconds INTEGER;

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

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (sender_id, receiver_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Challenge links table
CREATE TABLE IF NOT EXISTS challenge_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id TEXT NOT NULL,
  game_mode TEXT NOT NULL,
  time_seconds INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Add room_id to challenge_links (for instant room creation in duel feature)
ALTER TABLE challenge_links ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- Unique constraint on username
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_unique;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Add challenge_id to completed_games
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenge_links(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_completed_games_played_at ON completed_games(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_sender ON friendships(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_links_code ON challenge_links(code);
CREATE INDEX IF NOT EXISTS idx_challenge_links_creator ON challenge_links(creator_id);

-- Constraints (idempotent: safe for CI/CD re-runs)
-- Wrap in DO block to handle missing tables gracefully
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms') THEN
    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_code_unique;
    ALTER TABLE rooms ADD CONSTRAINT rooms_code_unique UNIQUE (code);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_players') THEN
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_pkey;
    ALTER TABLE room_players ADD CONSTRAINT room_players_pkey PRIMARY KEY (room_id, player_id);
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_room_fk;
    ALTER TABLE room_players ADD CONSTRAINT room_players_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games') THEN
    ALTER TABLE games DROP CONSTRAINT IF EXISTS games_room_fk;
    ALTER TABLE games ADD CONSTRAINT games_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;
END $$;


                                                                             -- Enable Row Level Security (RLS)
                                                                             ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
                                                                             ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
                                                                             ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
                                                                             ALTER TABLE games ENABLE ROW LEVEL SECURITY;
                                                                             ALTER TABLE completed_games ENABLE ROW LEVEL SECURITY;
                                                                             ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
                                                                             ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
                                                                             ALTER TABLE challenge_links ENABLE ROW LEVEL SECURITY;

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
                                                                             -- friendships
                                                                             DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
                                                                             DROP POLICY IF EXISTS "Users can send friend requests" ON friendships;
                                                                             DROP POLICY IF EXISTS "Users can update received requests" ON friendships;
                                                                             DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
                                                                             -- messages
                                                                             DROP POLICY IF EXISTS "Users can view own messages" ON messages;
                                                                             DROP POLICY IF EXISTS "Users can send messages" ON messages;
                                                                             DROP POLICY IF EXISTS "Users can mark messages read" ON messages;
                                                                             -- challenge_links
                                                                             DROP POLICY IF EXISTS "Challenge links are viewable by everyone" ON challenge_links;
                                                                             DROP POLICY IF EXISTS "Authenticated users can create challenge links" ON challenge_links;
                                                                             DROP POLICY IF EXISTS "Creator can deactivate challenge links" ON challenge_links;
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

          -- Allow guest players (no auth session) to join rooms too
          DROP POLICY IF EXISTS "Anyone can join rooms" ON room_players;
          CREATE POLICY "Anyone can join rooms" ON room_players
            FOR INSERT WITH CHECK (true);

                                                                                                                                  CREATE POLICY "Players can leave rooms" ON room_players
                                                                                                                                    FOR DELETE USING (
                                                                                                                                        auth.uid()::text = player_id
                                                                                                                                          );

                                                                                                                                          CREATE POLICY "Players can update own record" ON room_players
                                                                                                                                            FOR UPDATE USING (auth.uid()::text = player_id);

                                                                                                                                            -- games: must be room member for all operations
CREATE POLICY "Room members can view game" ON games
  FOR SELECT USING (is_room_member(room_id));

CREATE POLICY "Room members can insert game" ON games
  FOR INSERT WITH CHECK (is_room_member(room_id));

CREATE POLICY "Room members can update game" ON games
  FOR UPDATE USING (is_room_member(room_id));

                                                                                                                                                                    -- completed_games: authenticated users can view and insert
                                                                                                                                                                    CREATE POLICY "Authenticated users can view completed games" ON completed_games
                                                                                                                                                                      FOR SELECT USING (auth.role() = 'authenticated');

                                                                                                                                                                      CREATE POLICY "Authenticated users can insert completed games" ON completed_games
                                                                                                                                                                        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow anonymous users too (players who skip sign-up)
DROP POLICY IF EXISTS "Anyone can view completed games" ON completed_games;
CREATE POLICY "Anyone can view completed games" ON completed_games
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert completed games" ON completed_games;
CREATE POLICY "Anyone can insert completed games" ON completed_games
  FOR INSERT WITH CHECK (true);

                                                                                                                                                                        -- Function to auto-create profile on signup
                                                                                                         CREATE OR REPLACE FUNCTION public.handle_new_user()
                                                                                                         RETURNS TRIGGER AS $$
                                                                                                          DECLARE
                                                                                                            base_username TEXT;
                                                                                                            final_username TEXT;
                                                                                                          BEGIN
                                                                                                          base_username := COALESCE(NEW.raw_user_meta_data->>'username', 'Player');
                                                                                                            final_username := base_username;
                                                                                                            WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
                                                                                                              final_username := base_username || '_' || substr(md5(random()::text), 1, 6);
                                                                                                            END LOOP;
                                                                                                           INSERT INTO public.profiles (id, username)
                                                                                                               VALUES (NEW.id, final_username);
                                                                                                                 RETURN NEW;
                                                                                                                 END;
                                                                                                                 $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                                                                                                                         -- Trigger for new user signup
                                                                                                                                                                         DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
                                                                                                                                                                         CREATE TRIGGER on_auth_user_created
                                                                                                                                                                           AFTER INSERT ON auth.users
                                                                                                                                                                             FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- friendships RLS
-- ============================================

CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = sender_id OR auth.uid()::text = receiver_id
    )
  );

CREATE POLICY "Users can send friend requests" ON friendships
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid()::text = sender_id
  );

CREATE POLICY "Users can update received requests" ON friendships
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND auth.uid()::text = receiver_id
  );

CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = sender_id OR auth.uid()::text = receiver_id
    )
  );

-- ============================================
-- messages RLS
-- ============================================

CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth.uid()::text = sender_id OR auth.uid()::text = receiver_id
    )
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid()::text = sender_id
  );

CREATE POLICY "Users can mark messages read" ON messages
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND auth.uid()::text = receiver_id
  );

-- ============================================
-- challenge_links RLS
-- ============================================

CREATE POLICY "Challenge links are viewable by everyone" ON challenge_links
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create challenge links" ON challenge_links
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND auth.uid()::text = creator_id
  );

CREATE POLICY "Creator can deactivate challenge links" ON challenge_links
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND auth.uid()::text = creator_id
  );

-- ============================================
-- duel_games table for 1v1 challenge feature
-- ============================================
CREATE TABLE IF NOT EXISTS duel_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
  player_white TEXT NOT NULL,
  player_black TEXT,
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'game_over')),
  winner TEXT CHECK (winner IN ('white', 'black', 'draw')),
  game_result TEXT,
  game_over_reason TEXT,
  time_limit_seconds INTEGER DEFAULT 600,
  white_time_remaining INTEGER,
  black_time_remaining INTEGER,
  move_history JSONB DEFAULT '[]'::jsonb,
  player1_accuracy REAL DEFAULT 0,
  player2_accuracy REAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE duel_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view duel games" ON duel_games;
CREATE POLICY "Participants can view duel games" ON duel_games
  FOR SELECT USING (auth.uid()::text IN (player_white, player_black));

DROP POLICY IF EXISTS "Participants can insert duel games" ON duel_games;
CREATE POLICY "Participants can insert duel games" ON duel_games
  FOR INSERT WITH CHECK (auth.uid()::text = player_white);

DROP POLICY IF EXISTS "Participants can update duel games" ON duel_games;
CREATE POLICY "Participants can update duel games" ON duel_games
  FOR UPDATE USING (auth.uid()::text IN (player_white, player_black));

-- Add message_type to messages for challenge vs chat distinction
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'challenge'));
                                                                                                                                                                                    