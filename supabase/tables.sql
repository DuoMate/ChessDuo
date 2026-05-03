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

                                -- Create indexes
                                CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
                                CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);

                                -- Enable Row Level Security (RLS)
                                ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
                                ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
                                ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;

                                -- RLS Policies for profiles
                                CREATE POLICY "Public profiles are viewable by everyone" ON profiles
                                  FOR SELECT USING (true);
                                    
                                    CREATE POLICY "Users can insert their own profile" ON profiles
                                      FOR INSERT WITH CHECK (auth.uid() = id);
                                        
                                        CREATE POLICY "Users can update own profile" ON profiles
                                          FOR UPDATE USING (auth.uid() = id);

                                          -- RLS Policies for rooms
                                          CREATE POLICY "Anyone can view rooms" ON rooms
                                            FOR SELECT USING (true);
                                              
                                              CREATE POLICY "Anyone can create rooms" ON rooms
                                                FOR INSERT WITH CHECK (true);

                                                -- RLS Policies for room_players
                                                CREATE POLICY "Anyone can view room players" ON room_players
                                                  FOR SELECT USING (true);
                                                    
                                                    CREATE POLICY "Anyone can insert room players" ON room_players
                                                      FOR INSERT WITH CHECK (true);
                                                        
                                                        CREATE POLICY "Anyone can update room players" ON room_players
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