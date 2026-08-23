-- ============================================================================
-- 2026-08-23 — games: resolution-state columns (ADR-005 + turn tracking)
--
-- TARGETED EXTRACTION of the idempotent block in supabase.sql (lines 238-252).
-- supabase.sql remains the canonical source; this file exists so the exact
-- missing-column fix can be pasted into the production SQL editor without
-- running the full setup script.
--
-- Root cause fixed: FE (commit f5fab63) reads/writes games.last_human_resolution
-- while a prod DB created from an older supabase.sql lacks the column. Every
-- loadGameState SELECT then fails ("No saved state for room") and every
-- _finishResolution upsert is rejected — the authoritative row never advances
-- and lagging clients cannot re-sync (Invalid move: <SAN> divergence).
--
-- Fully idempotent: safe to run repeatedly.
-- ============================================================================

-- games: timer columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS match_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS match_time_limit_seconds INTEGER;

-- games: game-engine sync columns (turn tracking, coordinator, resolution)
ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_number INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS coordinator_id TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_phase TEXT DEFAULT 'SUBMITTING';
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_resolved_move TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_human_resolution JSONB;

-- Backfill turn_number from existing move_history JSONB array length
UPDATE games
  SET turn_number = jsonb_array_length(COALESCE(move_history, '[]'::jsonb))
  WHERE turn_number = 0 AND move_history IS NOT NULL;

-- ---------------------------------------------------------------------------
-- VERIFY (run separately):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'games'
--      AND column_name IN ('turn_number','coordinator_id','turn_phase',
--                          'last_resolved_move','last_human_resolution',
--                          'match_started_at','match_time_limit_seconds');
--   -- expect 7 rows
--
--   SELECT policyname, tablename FROM pg_policies WHERE tablename = 'games';
--   -- expect: Room members can view game / insert game / update game
--   -- (member-only SELECT is correct; do NOT widen it)
-- ---------------------------------------------------------------------------
