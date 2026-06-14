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
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rzp_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rzp_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

        -- Create rooms table
        CREATE TABLE IF NOT EXISTS rooms (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            code TEXT UNIQUE NOT NULL,
              status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
                mode TEXT DEFAULT 'online' CHECK (mode IN ('online', 'fourplayer')),
                  created_by TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );

                  -- Create room_players table
                  CREATE TABLE IF NOT EXISTS room_players (
                    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
                      player_id TEXT NOT NULL,
                        team TEXT CHECK (team IN ('WHITE', 'BLACK')),
                          slot INTEGER CHECK (slot IN (0, 1)),
                            status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'joined', 'ready', 'locked')),
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

-- De-duplicate existing 'Player' usernames before adding unique constraint
-- This handles rows inserted before the trigger was concurrency-safe
DO $$
DECLARE
  dup RECORD;
  new_name TEXT;
BEGIN
  FOR dup IN
    SELECT id FROM profiles WHERE username = 'Player'
    ORDER BY created_at
    OFFSET 1  -- keep the oldest profile as 'Player', rename the rest
  LOOP
    LOOP
      new_name := 'Player_' || substr(md5(random()::text), 1, 6);
      BEGIN
        UPDATE profiles SET username = new_name WHERE id = dup.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- collision on random suffix, try again
      END;
    END LOOP;
  END LOOP;
END $$;

-- Unique constraint on username
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_unique;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Username format constraint: 3-30 chars, alphanumeric + underscore only
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$');

-- Lowercase username column for case-insensitive lookups
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_lower TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles(username_lower);

-- Backfill username_lower for existing rows
UPDATE profiles SET username_lower = LOWER(username) WHERE username_lower IS NULL;

-- Add challenge_id to completed_games
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenge_links(id) ON DELETE SET NULL;

-- Ensure move_comparisons column exists (may be missing if table created before schema update)
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS move_comparisons JSONB DEFAULT '[]'::jsonb;

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
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS time_seconds INTEGER DEFAULT 600;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'online';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_players') THEN
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_pkey;
    ALTER TABLE room_players ADD CONSTRAINT room_players_pkey PRIMARY KEY (room_id, player_id);
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_room_fk;
    ALTER TABLE room_players ADD CONSTRAINT room_players_room_fk FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
    ALTER TABLE room_players ALTER COLUMN team DROP NOT NULL;
    ALTER TABLE room_players ALTER COLUMN slot DROP NOT NULL;
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_team_check;
    ALTER TABLE room_players ADD CONSTRAINT room_players_team_check CHECK (team IS NULL OR team IN ('WHITE', 'BLACK'));
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_slot_check;
    ALTER TABLE room_players ADD CONSTRAINT room_players_slot_check CHECK (slot IS NULL OR slot IN (0, 1));
    ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_status_check;
    ALTER TABLE room_players ADD CONSTRAINT room_players_status_check CHECK (status IN ('waiting', 'joined', 'ready', 'locked'));
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

                                                                                                           -- RPC: query room_players without RLS (SECURITY DEFINER = owner privileges)
                                                                                                           CREATE OR REPLACE FUNCTION public.get_room_players(p_room_id UUID)
                                                                                                           RETURNS TABLE(player_id TEXT, team TEXT)
                                                                                                           LANGUAGE plpgsql
                                                                                                           SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.is_room_member(p_room_id) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT rp.player_id, rp.team
    FROM room_players rp
    WHERE rp.room_id = p_room_id;
END;
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

-- Function to auto-create profile on signup
-- Client validates username uniqueness before signup, so this just inserts directly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
 DECLARE
   base_username TEXT;
 BEGIN
  base_username := NEW.raw_user_meta_data->>'username';
  IF base_username IS NOT NULL THEN
    IF base_username !~ '^[a-zA-Z0-9_]{3,30}$' THEN
      base_username := 'player_' || substr(md5(random()::text), 1, 6);
    END IF;
    INSERT INTO public.profiles (id, username, username_lower)
      VALUES (NEW.id, base_username, LOWER(base_username))
      ON CONFLICT (id) DO NOTHING;
  END IF;
   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;

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

-- ============================================
-- Account Deletion Function
-- ============================================
-- Deploy: Run this if not already deployed.
-- Called by /api/delete-account endpoint via supabase.rpc().
-- SECURITY DEFINER runs with owner privileges (bypasses RLS).
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  my_id TEXT;
BEGIN
  my_id := auth.uid()::text;

  IF my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM messages WHERE sender_id = my_id OR receiver_id = my_id;
  DELETE FROM friendships WHERE sender_id = my_id OR receiver_id = my_id;
  DELETE FROM challenge_links WHERE creator_id = my_id;
  DELETE FROM duel_games WHERE player_white = my_id OR player_black = my_id;
  DELETE FROM profiles WHERE id = my_id;

  DELETE FROM room_players WHERE player_id = my_id;

  DELETE FROM completed_games
    WHERE room_id IN (SELECT id FROM rooms WHERE created_by = my_id);

  DELETE FROM rooms WHERE created_by = my_id;

  DELETE FROM auth.users WHERE id = my_id::uuid;
END;
$$;

-- Only authenticated users should call delete_my_account
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;

-- ============================================
-- Security Advisory Fixes
-- Fixes flagged by Supabase Database Advisor.
-- Can be safely re-run (uses IF EXISTS).
-- ============================================

-- Drop dashboard-added "Allow all" on rooms
-- SQL-defined policies already cover SELECT/INSERT/UPDATE.
DROP POLICY IF EXISTS "Allow all" ON public.rooms;

-- Drop dashboard-added "Allow all" on room_players
-- SQL-defined policies cover SELECT/INSERT/DELETE/UPDATE.
DROP POLICY IF EXISTS "Allow all" ON public.room_players;

-- Drop dashboard-added "Anyone can insert completed games"
-- SQL-defined "Authenticated users can insert" is the correct policy.
DROP POLICY IF EXISTS "Anyone can insert completed games" ON public.completed_games;
                                                                                                                                                                                    