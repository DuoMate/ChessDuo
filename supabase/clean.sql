-- WARNING: Deletes ALL data from ALL tables. Irreversible.
-- Run this in the Supabase SQL Editor to start fresh.

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'duel_games') THEN
    DELETE FROM duel_games;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_links') THEN
    DELETE FROM challenge_links;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
    DELETE FROM messages;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friendships') THEN
    DELETE FROM friendships;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'completed_games') THEN
    DELETE FROM completed_games;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'games') THEN
    DELETE FROM games;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'room_players') THEN
    DELETE FROM room_players;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rooms') THEN
    DELETE FROM rooms;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    DELETE FROM profiles;
  END IF;
END $$;

-- Also clean auth users (optional — remove comment if needed)
-- DELETE FROM auth.users;
