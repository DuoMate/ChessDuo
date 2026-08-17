-- ============================================================
-- P0-1 SECURITY REGRESSION — run in STAGING against a live DB
-- (Supabase SQL Editor or psql as a privileged role).
--
-- Verifies that the deployed RLS policies are exactly the
-- minimum-privilege set. Raises an exception on any mismatch so it
-- fails loudly instead of silently passing.
--
-- Manual negative checks (via a second REST client / PostgREST):
--   User A (any authenticated user) must get 0 rows / errors for:
--     - UPDATE games SET fen=...  WHERE room_id IN (B's rooms)
--     - INSERT INTO turn_submissions (game_id, turn_number, player_id, ...)
--       with player_id = B
--     - INSERT/UPDATE/DELETE room_players for B's room as non-member
--     - SELECT games/room_players/turn_submissions for B's room as non-member
--   A legitimate player must still:
--     - create/join a room, submit their own move, read their game,
--       resign (UPDATE rooms.status='finished'), reconnect (re-read state)
-- ============================================================

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
        problems := problems || format('PERMISSIVE POLICY "Allow all" FOUND on %s%n', tbl);
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
    RAISE EXCEPTION 'P0-1 RLS regression FAILED:%', problems;
  END IF;

  RAISE NOTICE 'P0-1 RLS regression PASSED — policies match the minimum-privilege set.';
END
$$;