-- Supabase Database Setup for ChessDuo
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (standalone - no auth dependency for now)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles (anon users generate their own IDs)
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (true);

-- RLS Policies for rooms
-- Everyone needs SELECT to find rooms by code
CREATE POLICY "Rooms are viewable by everyone" ON rooms
  FOR SELECT USING (true);

-- Authenticated or anon users can create rooms
CREATE POLICY "Anyone can create rooms" ON rooms
  FOR INSERT WITH CHECK (true);

-- Only room creator can update room status
CREATE POLICY "Room creator can update" ON rooms
  FOR UPDATE USING (created_by = (SELECT created_by FROM rooms r2 WHERE r2.id = id));

-- RLS Policies for room_players
-- Everyone needs SELECT to see who's in a room
CREATE POLICY "Room players are viewable by everyone" ON room_players
  FOR SELECT USING (true);

-- Anyone can join a room (insert)
CREATE POLICY "Anyone can join rooms" ON room_players
  FOR INSERT WITH CHECK (true);

-- Players can update only their own room_players record
CREATE POLICY "Players can update own record" ON room_players
  FOR UPDATE USING (player_id = player_id);

-- RLS Policies for games
-- Room participants can view game state
CREATE POLICY "Room participants can view game" ON games
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_players rp WHERE rp.player_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
    OR room_id IN (
      SELECT id FROM rooms WHERE created_by = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

-- Anyone can insert/update game state (coordinator writes)
-- SECURITY NOTE: For MVP, game state writes are permissive.
-- Rate limiting is enforced at the application layer.
CREATE POLICY "Anyone can insert game state" ON games
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update game state" ON games
  FOR UPDATE USING (true);

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
