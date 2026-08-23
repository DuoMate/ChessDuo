-- ============================================================================
-- 2026-08-23 — turn_submissions: UPDATE policy for idempotent re-submission
--
-- TARGETED EXTRACTION of the turn_submissions policy block in supabase.sql.
-- supabase.sql remains the canonical source; this file exists so the exact
-- missing-policy fix can be pasted into the production SQL editor without
-- running the full setup script.
--
-- Root cause fixed: the client submits moves via PostgREST UPSERT
-- (`Prefer: resolution=merge-duplicates` → `INSERT ... ON CONFLICT
-- (game_id, turn_number, player_id) DO UPDATE`). PostgreSQL authorizes the
-- conflicting-row branch under the table's UPDATE policy — which did not
-- exist. Every legitimate re-submission of an already-persisted move
-- (retry after a lost response, resubmission after refresh/reconnect)
-- failed with 42501 "new row violates row-level security policy (USING
-- expression)" → HTTP 403 → "Move submission failed" and the turn could
-- never resolve.
--
-- Least privilege preserved: a member may still touch ONLY their own row,
-- ONLY inside a game whose room they belong to, and player_id cannot be
-- changed (WITH CHECK re-applies the same predicate to the new row).
--
-- Fully idempotent: safe to run repeatedly.
-- ============================================================================

DROP POLICY IF EXISTS "Players can update their own moves" ON public.turn_submissions;

CREATE POLICY "Players can update their own moves" ON public.turn_submissions
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid()::text = player_id
    AND EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = turn_submissions.game_id
      AND is_room_member(g.room_id)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid()::text = player_id
    AND EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = turn_submissions.game_id
      AND is_room_member(g.room_id)
    )
  );

-- ---------------------------------------------------------------------------
-- VERIFY (run separately):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'turn_submissions'
--    ORDER BY cmd;
--   -- expect 3 rows:
--   --   "Room members can view turn submissions"  SELECT
--   --   "Players can submit their own moves"      INSERT
--   --   "Players can update their own moves"      UPDATE
-- ---------------------------------------------------------------------------