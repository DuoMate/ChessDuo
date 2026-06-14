-- Deploy in Supabase SQL Editor
-- Run this SQL once to create the function.
-- Then the /api/delete-account endpoint calls it via supabase.rpc().
-- SECURITY DEFINER means it runs with owner privileges (bypasses RLS).

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

-- Only authenticated users should be able to call this function.
-- Revoking EXECUTE from anon ensures unauthenticated requests
-- are rejected at the database level.
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;
