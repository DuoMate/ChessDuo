-- ============================================================================
-- ChessDuo — Supabase One-Shot Setup (supabase.sql)
-- ============================================================================
-- The single source of truth for the ChessDuo database: schema (DDL), data
-- backfills (DML), functions/RPCs, RLS policies, grants, triggers, scheduled
-- cleanup (pg_cron) and the realtime publication pin.
--
-- Run this entire file in the Supabase SQL Editor (as the postgres role).
-- Idempotent: every statement uses IF NOT EXISTS / DROP IF EXISTS /
-- CREATE OR REPLACE, so it is safe to re-run. It ends with a non-fatal RLS
-- self-check that RAISEs a WARNING (never an error) if a minimum-privilege
-- policy is missing or a permissive "Allow all" policy is present.
-- ============================================================================

-- ============================================================================
-- 1. Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Tables (idempotent creates)
-- ============================================================================

-- Profiles (standalone - no auth dependency for now)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  insights_reveals_used INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  mode TEXT DEFAULT 'online' CHECK (mode IN ('online', 'fourplayer')),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room players
CREATE TABLE IF NOT EXISTS room_players (
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  team TEXT CHECK (team IN ('WHITE', 'BLACK')),
  slot INTEGER CHECK (slot IN (0, 1)),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'joined', 'ready', 'locked')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);

-- Games (state persistence)
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

-- Completed games (match history/stats)
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

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (sender_id, receiver_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Challenge links
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

-- Duel games (1v1 challenge feature)
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

-- Push notification device tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- Turn submissions (server-authoritative move record; composite PK enforces at
-- most one submission per player per turn at the database level)
CREATE TABLE IF NOT EXISTS turn_submissions (
  game_id UUID NOT NULL,
  turn_number INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  move_san TEXT NOT NULL,
  move_from TEXT NOT NULL,
  move_to TEXT NOT NULL,
  piece TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (game_id, turn_number, player_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- App errors (append-only observability, P0-2)
CREATE TABLE IF NOT EXISTS app_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message TEXT NOT NULL,
  stack TEXT,
  error_type TEXT,
  source TEXT,
  line INTEGER,
  col INTEGER,
  platform TEXT,
  app_version TEXT,
  session_id TEXT,
  user_id TEXT,
  route TEXT,
  game_id TEXT,
  room_id TEXT,
  turn_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push send audit log (P0-4, service-role only)
CREATE TABLE IF NOT EXISTS push_send_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game lifecycle trace (append-only event log, P0-1/P1)
CREATE TABLE IF NOT EXISTS game_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT,
  stage TEXT,
  game_id TEXT,
  room_id TEXT,
  turn_number INTEGER,
  player_id TEXT,
  team TEXT,
  color TEXT,
  coordinator_id TEXT,
  duration_ms INTEGER,
  timeout BOOLEAN,
  fallback_used BOOLEAN,
  extra JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Schema evolution (idempotent column adds / constraints / backfills)
-- ============================================================================

-- profiles: columns that may be missing on existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insights_reveals_used INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_provider TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS purchase_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expiry_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_renew_status BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS purchase_state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_verified_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_checkout_id TEXT;

-- Drop old Razorpay columns (safe to re-run)
ALTER TABLE profiles DROP COLUMN IF EXISTS rzp_customer_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS rzp_subscription_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS rzp_payment_id;

-- games: timer columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS match_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS match_time_limit_seconds INTEGER;

-- games: Phase 1 game-engine sync columns (turn tracking, coordinator)
ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_number INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS coordinator_id TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_phase TEXT DEFAULT 'SUBMITTING';
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_resolved_move TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_human_resolution JSONB;

-- Backfill turn_number from existing move_history JSONB array length
UPDATE games
  SET turn_number = jsonb_array_length(COALESCE(move_history, '[]'::jsonb))
  WHERE turn_number = 0 AND move_history IS NOT NULL;

-- challenge_links: room_id for instant room creation in duel feature
ALTER TABLE challenge_links ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- completed_games: challenge linkage + move_comparisons backfill guard
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenge_links(id) ON DELETE SET NULL;
ALTER TABLE completed_games ADD COLUMN IF NOT EXISTS move_comparisons JSONB DEFAULT '[]'::jsonb;

-- messages: message_type for challenge vs chat distinction
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'challenge'));

-- push_tokens: ensure 'web' platform is allowed on pre-existing databases
ALTER TABLE push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_platform_check,
  ADD CONSTRAINT push_tokens_platform_check CHECK (platform IN ('android', 'ios', 'web'));

-- profiles: username de-duplication before enforcing unique constraint
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

-- profiles: unique constraint on username (wrapped: ignore errors on re-runs)
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_unique;
  ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profiles_username_unique error (safe): %', SQLERRM;
END $$;

-- profiles: username format 3-30 chars, alphanumeric + underscore (wrapped)
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
  ALTER TABLE profiles ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profiles_username_format error (safe): %', SQLERRM;
END $$;

-- profiles: lowercase username column for case-insensitive lookups
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_lower TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles(username_lower);
UPDATE profiles SET username_lower = LOWER(username) WHERE username_lower IS NULL;

-- rooms / room_players / games: constraints + extra columns (wrapped, idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms') THEN
    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_code_unique;
    ALTER TABLE rooms ADD CONSTRAINT rooms_code_unique UNIQUE (code);
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS time_seconds INTEGER DEFAULT 600;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'online';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_team TEXT;
    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_host_team_check;
    ALTER TABLE rooms ADD CONSTRAINT rooms_host_team_check CHECK (host_team IS NULL OR host_team IN ('WHITE', 'BLACK'));
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

  -- One completed_games row per room (idempotent history upsert). NULL room_id
  -- (offline games) is treated as distinct, so those keep inserting fresh rows.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'completed_games') THEN
    ALTER TABLE completed_games DROP CONSTRAINT IF EXISTS completed_games_room_id_key;
    ALTER TABLE completed_games ADD CONSTRAINT completed_games_room_id_key UNIQUE (room_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration block error (safe to ignore): %', SQLERRM;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_games_room ON public.games(room_id);
CREATE INDEX IF NOT EXISTS idx_completed_games_played_at ON public.completed_games(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_sender ON friendships(sender_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_links_code ON challenge_links(code);
CREATE INDEX IF NOT EXISTS idx_challenge_links_creator ON challenge_links(creator_id);
CREATE INDEX IF NOT EXISTS idx_turn_submissions_game ON public.turn_submissions(game_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_app_errors_created ON app_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_send_log_sender_type_time ON push_send_log(sender_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_traces_room_turn ON game_traces(room_id, turn_number, created_at);

-- ============================================================================
-- 4. Functions & RPCs (CREATE OR REPLACE, idempotent)
-- ============================================================================

-- Helper: checks room membership without RLS (avoids recursion).
-- DROP + CASCADE first so dependent policies are removed cleanly before the
-- consolidated policy section re-creates them.
DROP FUNCTION IF EXISTS public.is_room_member(UUID) CASCADE;
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

-- RPC: public join-state for a room code (no membership gate — rooms are public
-- by design; lets an invitee pick the opposite team and detect a full/duplicate
-- room before inserting themselves)
CREATE OR REPLACE FUNCTION public.get_room_join_state(p_room_id UUID)
RETURNS TABLE(player_count BIGINT, white_count BIGINT, black_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(*)::BIGINT,
         COUNT(*) FILTER (WHERE team = 'WHITE')::BIGINT,
         COUNT(*) FILTER (WHERE team = 'BLACK')::BIGINT
  FROM room_players
  WHERE room_id = p_room_id;
$$;

-- ============================================================
-- RPC: atomic Duo room-join (SECURITY DEFINER)
-- Fixes the post-P0-1 join regression: a client-side room_players
-- upsert is rejected because PostgREST upserts evaluate the member-only
-- SELECT policy as a WITH-CHECK (false for a fresh joiner). This RPC locks
-- the room row FOR UPDATE, computes capacity/team/slot server-side under the
-- lock, inserts exactly once, and returns the authoritative room/team/slot/
-- game state. Identity is always auth.uid(); no client-supplied team/slot/
-- player_id is trusted. RLS table policies remain hardened.
-- Error codes: 42501 UNAUTHORIZED | P0001 ROOM_NOT_FOUND/INVALID_CODE |
-- P0002 ROOM_EXPIRED | P0003 ROOM_FULL | P0004 ROOM_NOT_JOINABLE | P0005 fourplayer.
-- NOTE: every rooms column reference is qualified with v_room.<col> because the
-- RETURNS TABLE output columns (code/status/mode/...) shadow PL/pgSQL names and
-- would otherwise make `WHERE code = ...` ambiguous.
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_room_by_code(p_code text)
RETURNS TABLE (
  room_id      uuid,
  code         text,
  team         text,
  slot         integer,
  status       text,
  mode         text,
  host_team    text,
  created_by   text,
  time_seconds integer,
  game_id      uuid,
  game_status  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid    text := auth.uid()::text;
  v_room   public.rooms%ROWTYPE;
  v_team   text;
  v_slot   integer;
  v_total  integer;
  v_white  integer;
  v_black  integer;
  v_code   text := upper(btrim(p_code));
BEGIN
  -- 1. Authenticate
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  -- 2. Code format (charset from generateRoomCode)
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'INVALID_CODE' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Serialize all join attempts on this room (THE concurrency control).
  --    PostgREST wraps each RPC call in its own transaction, so this lock is
  --    held until the insert commits; the next caller sees the updated roster.
  SELECT * INTO v_room FROM public.rooms WHERE public.rooms.code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Validate room (four-player uses its seat lobby; reject here)
  IF v_room.mode = 'fourplayer' THEN
    RAISE EXCEPTION 'ROOM_NOT_JOINABLE' USING ERRCODE = 'P0005';
  END IF;
  IF v_room.status <> 'waiting' THEN
    RAISE EXCEPTION 'ROOM_NOT_JOINABLE' USING ERRCODE = 'P0004';
  END IF;
  IF v_room.expires_at IS NOT NULL AND v_room.expires_at < now() THEN
    RAISE EXCEPTION 'ROOM_EXPIRED' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Idempotent re-join: return existing assignment, never duplicate
  SELECT rp.team, rp.slot INTO v_team, v_slot
    FROM public.room_players rp
   WHERE rp.room_id = v_room.id AND rp.player_id = v_uid;
  IF FOUND THEN
    RETURN QUERY
      SELECT v_room.id, v_room.code, v_team, v_slot, v_room.status, v_room.mode,
             v_room.host_team, v_room.created_by, v_room.time_seconds,
             g.id, g.status::text
      FROM (SELECT 1) x LEFT JOIN public.games g ON g.room_id = v_room.id;
    RETURN;
  END IF;

  -- 6. Capacity + team/slot computed UNDER the lock
  SELECT count(*) FILTER (WHERE rp.team = 'WHITE'),
         count(*) FILTER (WHERE rp.team = 'BLACK'),
         count(*)
    INTO v_white, v_black, v_total
   FROM public.room_players rp WHERE rp.room_id = v_room.id;

  IF v_total >= 4 THEN
    RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0003';
  END IF;

  -- Server-side team assignment (mirrors the legacy client rule; host team first)
  IF v_white < 2 AND v_black < 2 THEN
    v_team := COALESCE(v_room.host_team, 'WHITE');
  ELSIF v_white < 2 THEN
    v_team := 'WHITE';
  ELSIF v_black < 2 THEN
    v_team := 'BLACK';
  ELSE
    RAISE EXCEPTION 'ROOM_FULL' USING ERRCODE = 'P0003';
  END IF;

  v_slot := (SELECT count(*) FROM public.room_players rp
              WHERE rp.room_id = v_room.id AND rp.team = v_team);

  -- 7. Insert exactly once (PK guards against any residual race). Target-less
  --    ON CONFLICT DO NOTHING is used because the room_players PK is the only
  --    unique constraint, and naming columns here would collide with the
  --    RETURNS TABLE output variables (room_id/player_id).
  INSERT INTO public.room_players (room_id, player_id, team, slot, status)
  VALUES (v_room.id, v_uid, v_team, v_slot, 'ready')
  ON CONFLICT DO NOTHING;

  RETURN QUERY
    SELECT v_room.id, v_room.code, v_team, v_slot, v_room.status, v_room.mode,
           v_room.host_team, v_room.created_by, v_room.time_seconds,
           g.id, g.status::text
    FROM (SELECT 1) x LEFT JOIN public.games g ON g.room_id = v_room.id;
END;
$$;

-- Capacity helper: true when the room has space OR the player already has a
-- row (re-join/reconnect after ON CONFLICT DO UPDATE still evaluates the
-- INSERT check). SECURITY DEFINER so the count sees the real roster.
CREATE OR REPLACE FUNCTION public.can_join_room(p_room_id UUID, p_player_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    (SELECT count(*) FROM room_players WHERE room_id = p_room_id) < 4
    OR EXISTS (SELECT 1 FROM room_players WHERE room_id = p_room_id AND player_id = p_player_id)
$$;

-- Function to auto-create profile on signup (handles email/password, OAuth,
-- and anonymous flows; idempotent + collision-safe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
 DECLARE
   base_username TEXT;
   meta_display_name TEXT;
   meta_avatar_url TEXT;
   meta_username TEXT;
   email_prefix TEXT;
 BEGIN
  meta_username := NEW.raw_user_meta_data->>'username';

  IF meta_username IS NOT NULL THEN
    -- Email/password flow
    IF meta_username !~ '^[a-zA-Z0-9_]{3,30}$' THEN
      meta_username := 'player_' || substr(md5(NEW.id::text), 1, 6);
    END IF;
    INSERT INTO public.profiles (id, username, username_lower)
      VALUES (NEW.id, meta_username, LOWER(meta_username))
      ON CONFLICT (id) DO NOTHING;
  ELSE
    -- OAuth or anonymous flow: derive username from email prefix if present
    IF NEW.email IS NOT NULL THEN
      email_prefix := split_part(NEW.email, '@', 1);
      base_username := regexp_replace(email_prefix, '[^a-zA-Z0-9_]', '_', 'g');
      IF length(base_username) < 3 THEN
        base_username := 'player_' || substr(md5(NEW.id::text), 1, 6);
      END IF;
      base_username := left(base_username, 30);
      IF base_username !~ '^[a-zA-Z0-9_]{3,30}$' THEN
        base_username := 'player_' || substr(md5(NEW.id::text), 1, 6);
      END IF;
    ELSE
      -- Anonymous signup: email is NULL, generate a deterministic fallback
      base_username := 'player_' || substr(md5(NEW.id::text), 1, 6);
    END IF;

    meta_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name');
    meta_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

    -- Collision-safe insert: retry with a fresh suffix if the username is taken
    LOOP
      BEGIN
        INSERT INTO public.profiles (id, username, username_lower, display_name, avatar_url)
          VALUES (NEW.id, base_username, LOWER(base_username), meta_display_name, meta_avatar_url)
          ON CONFLICT (id) DO NOTHING;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        base_username := 'player_' || substr(md5(random()::text), 1, 6);
      END;
    END LOOP;
  END IF;

   RETURN NEW;
 END;
 $$ LANGUAGE plpgsql;

-- Account Deletion Function (called by /api/delete-account via supabase.rpc())
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
  DELETE FROM push_tokens WHERE user_id = my_id;
  DELETE FROM profiles WHERE id = my_id;

  DELETE FROM room_players WHERE player_id = my_id;

  DELETE FROM completed_games
    WHERE room_id IN (SELECT id FROM rooms WHERE created_by = my_id);

  DELETE FROM rooms WHERE created_by = my_id;
END;
$$;

-- TTL cleanup: remove stale game data older than 24 hours (run manually or via
-- Supabase cron when needed: SELECT cleanup_stale_game_data();)
CREATE OR REPLACE FUNCTION cleanup_stale_game_data()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM games WHERE updated_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  DELETE FROM rooms WHERE created_at < NOW() - INTERVAL '24 hours' AND status != 'playing';
  RETURN deleted_count;
END;
$$;

-- Function-level privileges (idempotent)
REVOKE EXECUTE ON FUNCTION public.join_room_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_room_by_code(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.join_room_by_code(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE turn_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_traces ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================
-- Drop every known policy name first (current + historical) so CREATE POLICY
-- below never collides on re-runs. Includes the dashboard-added "Allow all"
-- policies removed during P0-1 hardening.
DROP POLICY IF EXISTS "Allow all" ON public.rooms;
DROP POLICY IF EXISTS "Allow all" ON public.room_players;
DROP POLICY IF EXISTS "Allow all" ON public.games;
DROP POLICY IF EXISTS "Allow all" ON public.turn_submissions;
DROP POLICY IF EXISTS "Allow all" ON public.completed_games;
DROP POLICY IF EXISTS "Anyone can insert completed games" ON public.completed_games;

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- rooms
DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room creator can update" ON public.rooms;
DROP POLICY IF EXISTS "Room members can update room status" ON public.rooms;
DROP POLICY IF EXISTS "Room creator can delete room" ON public.rooms;

-- room_players
DROP POLICY IF EXISTS "Room players are viewable by everyone" ON public.room_players;
DROP POLICY IF EXISTS "Room members can view players" ON public.room_players;
DROP POLICY IF EXISTS "Anyone can join rooms" ON public.room_players;
DROP POLICY IF EXISTS "Authenticated users can join rooms" ON public.room_players;
DROP POLICY IF EXISTS "Players can update own record" ON public.room_players;
DROP POLICY IF EXISTS "Players can leave rooms" ON public.room_players;
DROP POLICY IF EXISTS "Players can join rooms" ON public.room_players;
DROP POLICY IF EXISTS "Room creator can update room players" ON public.room_players;
DROP POLICY IF EXISTS "Room creator can delete room players" ON public.room_players;

-- games
DROP POLICY IF EXISTS "Room participants can view game" ON public.games;
DROP POLICY IF EXISTS "Anyone can view game state" ON public.games;
DROP POLICY IF EXISTS "Room members can view game" ON public.games;
DROP POLICY IF EXISTS "Anyone can insert game state" ON public.games;
DROP POLICY IF EXISTS "Room members can insert game" ON public.games;
DROP POLICY IF EXISTS "Anyone can update game state" ON public.games;
DROP POLICY IF EXISTS "Room members can update game" ON public.games;

-- completed_games
DROP POLICY IF EXISTS "Authenticated users can view completed games" ON public.completed_games;
DROP POLICY IF EXISTS "Authenticated users can insert completed games" ON public.completed_games;

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

-- duel_games
DROP POLICY IF EXISTS "Participants can view duel games" ON duel_games;
DROP POLICY IF EXISTS "Participants can insert duel games" ON duel_games;
DROP POLICY IF EXISTS "Participants can update duel games" ON duel_games;

-- push_tokens
DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.push_tokens;

-- turn_submissions
DROP POLICY IF EXISTS "Room members can access turn submissions" ON public.turn_submissions;
DROP POLICY IF EXISTS "Room members can view turn submissions" ON public.turn_submissions;
DROP POLICY IF EXISTS "Players can submit their own moves" ON public.turn_submissions;

-- app_errors / game_traces
DROP POLICY IF EXISTS "Clients can append error reports" ON public.app_errors;
DROP POLICY IF EXISTS "Clients can append game traces" ON public.game_traces;

-- ---------------------------------------------------------------------------
-- Create policies (minimum-privilege set)
-- For anonymous play, the app creates an anonymous Supabase user via
-- signInAnonymously(), which provides a real auth.uid().
-- ---------------------------------------------------------------------------

-- profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid()::text = id);

-- rooms: public discovery via room codes, authenticated creation/edit
CREATE POLICY "Rooms are viewable by everyone" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Room creator can update" ON public.rooms
  FOR UPDATE USING (auth.uid()::text = created_by);

-- rooms: member resignation (update) + creator cleanup (delete)
CREATE POLICY "Room members can update room status" ON public.rooms
  FOR UPDATE USING (auth.uid() IS NOT NULL AND is_room_member(id));

CREATE POLICY "Room creator can delete room" ON public.rooms
  FOR DELETE USING (auth.uid()::text = created_by);

-- room_players: members-only reads, self/creator writes
CREATE POLICY "Room members can view players" ON public.room_players
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_room_member(room_id));

CREATE POLICY "Players can join rooms" ON public.room_players
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid()::text = player_id
    AND public.can_join_room(room_id, player_id)
  );

CREATE POLICY "Players can update own record" ON public.room_players
  FOR UPDATE USING (auth.uid()::text = player_id);

CREATE POLICY "Room creator can update room players" ON public.room_players
  FOR UPDATE USING ((SELECT created_by FROM rooms WHERE id = room_id) = auth.uid()::text);

CREATE POLICY "Players can leave rooms" ON public.room_players
  FOR DELETE USING (auth.uid()::text = player_id);

CREATE POLICY "Room creator can delete room players" ON public.room_players
  FOR DELETE USING ((SELECT created_by FROM rooms WHERE id = room_id) = auth.uid()::text);

-- games: room-members only
CREATE POLICY "Room members can view game" ON public.games
  FOR SELECT USING (is_room_member(room_id));

CREATE POLICY "Room members can insert game" ON public.games
  FOR INSERT WITH CHECK (is_room_member(room_id));

CREATE POLICY "Room members can update game" ON public.games
  FOR UPDATE USING (is_room_member(room_id));

-- completed_games: authenticated users can view and insert
CREATE POLICY "Authenticated users can view completed games" ON public.completed_games
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert completed games" ON public.completed_games
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- friendships
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

-- messages
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

-- challenge_links
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

-- duel_games
CREATE POLICY "Participants can view duel games" ON duel_games
  FOR SELECT USING (auth.uid()::text IN (player_white, player_black));

CREATE POLICY "Participants can insert duel games" ON duel_games
  FOR INSERT WITH CHECK (auth.uid()::text = player_white);

CREATE POLICY "Participants can update duel games" ON duel_games
  FOR UPDATE USING (auth.uid()::text IN (player_white, player_black));

-- push_tokens: owner-only management
CREATE POLICY "Users can manage their own tokens" ON public.push_tokens
  FOR ALL
  USING (user_id = auth.uid()::text);

-- turn_submissions: room members may read; a player may submit their own move
CREATE POLICY "Room members can view turn submissions" ON public.turn_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = turn_submissions.game_id
      AND is_room_member(g.room_id)
    )
  );

CREATE POLICY "Players can submit their own moves" ON public.turn_submissions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid()::text = player_id
    AND EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = turn_submissions.game_id
      AND is_room_member(g.room_id)
    )
  );

-- app_errors / game_traces: clients may append only (no read)
CREATE POLICY "Clients can append error reports" ON public.app_errors
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Clients can append game traces" ON public.game_traces
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- ============================================================================
-- 7. Table-level privileges
-- ============================================================================
-- RLS policies only RESTRICT existing privileges — they cannot grant privileges
-- the role doesn't already have. These GRANTs ensure anon & authenticated have
-- base INSERT/SELECT/UPDATE/DELETE.
GRANT INSERT, SELECT, UPDATE, DELETE ON public.rooms TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.room_players TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.games TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.completed_games TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.friendships TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.messages TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.challenge_links TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.duel_games TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.push_tokens TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.turn_submissions TO anon, authenticated;
GRANT INSERT ON public.app_errors TO anon, authenticated;
GRANT INSERT ON public.game_traces TO anon, authenticated;

-- ============================================================================
-- 8. Trigger + profile backfill
-- ============================================================================

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for auth users who predate the trigger or whose
-- trigger failed (email NULL, collision). Idempotent: safe to re-run.
INSERT INTO public.profiles (id, username, username_lower, created_at)
SELECT u.id::text,
       'player_' || substr(md5(u.id::text), 1, 6),
       'player_' || substr(md5(u.id::text), 1, 6),
       u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id::text
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Collision-safe retry for the backfill above (username taken): rename stragglers
DO $$
DECLARE
  orphan RECORD;
  new_name TEXT;
BEGIN
  FOR orphan IN
    SELECT u.id::text AS uid
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id::text
    WHERE p.id IS NULL
  LOOP
    LOOP
      new_name := 'player_' || substr(md5(orphan.uid), 1, 6);
      BEGIN
        INSERT INTO public.profiles (id, username, username_lower, created_at)
        VALUES (orphan.uid, new_name, LOWER(new_name), NOW());
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- suffix collision on existing username, try again
      END;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 9. Scheduled cleanup (pg_cron) + realtime publication pin
-- ============================================================================

-- Stale data cleanup — hourly cron jobs.
-- cron.schedule() throws on a duplicate job name, so unschedule the existing
-- job first (no-op if absent) to keep this file re-runnable.

-- Clean up expired waiting rooms (cascades to games, room_players, duel_games,
-- turn_submissions via FK ON DELETE CASCADE).
SELECT cron.unschedule('cleanup-expired-rooms')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-rooms');

SELECT cron.schedule(
  'cleanup-expired-rooms',
  '0 * * * *',  -- every hour at minute 0
  $$
    DELETE FROM rooms
    WHERE expires_at < NOW()
      AND status != 'playing'
  $$
);

-- Clean up challenge links expired >24h ago (keep recent ones for any
-- retry/reload edge cases).
SELECT cron.unschedule('cleanup-expired-challenges')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-challenges');

SELECT cron.schedule(
  'cleanup-expired-challenges',
  '30 * * * *',  -- every hour at minute 30
  $$
    DELETE FROM challenge_links
    WHERE expires_at < NOW() - INTERVAL '24 hours'
  $$
);

-- Clean up chat messages older than 90 days. Keeps storage bounded and prevents
-- the badge-count query from scanning an ever-growing table.
SELECT cron.unschedule('cleanup-old-messages')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-messages');

SELECT cron.schedule(
  'cleanup-old-messages',
  '45 * * * *',  -- every hour at minute 45
  $$
    DELETE FROM messages
    WHERE created_at < NOW() - INTERVAL '90 days'
  $$
);

-- Clean up completed games older than 90 days (accessible via /history and
-- /replay until then).
SELECT cron.unschedule('cleanup-old-games')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-games');

SELECT cron.schedule(
  'cleanup-old-games',
  '15 * * * *',  -- every hour at minute 15
  $$
    DELETE FROM completed_games
    WHERE played_at < NOW() - INTERVAL '90 days'
  $$
);

-- Pin realtime publication to subscribed tables only. Any NEW table that needs
-- postgres_changes subscriptions MUST be ADDed here, otherwise the client
-- subscription will silently receive no events.
ALTER PUBLICATION supabase_realtime SET TABLE
  public.messages,
  public.friendships,
  public.profiles,
  public.room_players,
  public.games,
  public.turn_submissions,
  public.rooms;

-- ============================================================================
-- 10. RLS self-check (non-fatal, idempotent)
-- ============================================================================
-- Verifies the deployed RLS policies match the minimum-privilege set. Runs at
-- the end of every apply; on a mismatch it RAISEs a WARNING (never an ERROR)
-- so an idempotent re-apply is never blocked, while the problem is still
-- surfaced loudly in the SQL Editor output.
DO $$
DECLARE
  tbl text;
  pol record;
  problems text := '';
BEGIN
  -- 1. No "Allow all" policy may exist on the game-critical tables.
  FOR tbl IN SELECT unnest(ARRAY['room_players','games','turn_submissions']) LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      IF pol.policyname ILIKE 'allow all' THEN
        problems := problems || format('PERMISSIVE POLICY "Allow all" FOUND on %s', tbl) || E'\n';
      END IF;
    END LOOP;
  END LOOP;

  -- 2. Required minimum-privilege policies must be present.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='room_players' AND policyname='Room members can view players') THEN
    problems := problems || 'Missing: room_players "Room members can view players"' || E'\n';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='room_players' AND policyname='Players can join rooms') THEN
    problems := problems || 'Missing: room_players "Players can join rooms"' || E'\n';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='turn_submissions' AND policyname='Players can submit their own moves') THEN
    problems := problems || 'Missing: turn_submissions "Players can submit their own moves"' || E'\n';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='games' AND policyname='Room members can update game') THEN
    problems := problems || 'Missing: games "Room members can update game"' || E'\n';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rooms' AND policyname='Room members can update room status') THEN
    problems := problems || 'Missing: rooms "Room members can update room status"' || E'\n';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_join_room') THEN
    problems := problems || 'Missing: can_join_room() capacity helper' || E'\n';
  END IF;

  IF problems <> '' THEN
    RAISE WARNING 'P0-1 RLS regression FAILED:%', problems;
  ELSE
    RAISE NOTICE 'P0-1 RLS regression PASSED — policies match the minimum-privilege set.';
  END IF;
END
$$;
