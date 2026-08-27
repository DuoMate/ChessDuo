-- ============================================================================
-- ChessDuo — Periodic Cleanup (run manually in the Supabase SQL Editor)
-- ============================================================================
-- Idempotent and safe to re-run any time. On the Free plan pg_cron is
-- unavailable, so run this by hand (or trigger it from a scheduler) instead.
--
-- Suggested frequency at launch scale:
--   * Every few days: stale games/rooms, expired rooms, expired challenge links
--   * Monthly:         90-day messages, completed games, observability tables
--
-- Deleting rooms cascades to games, room_players, duel_games and
-- turn_submissions via FK ON DELETE CASCADE (completed_games keeps its row
-- via ON DELETE SET NULL, so history survives).
-- ============================================================================

-- TTL cleanup (re-created here so this file is self-contained).
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

-- 1. Stale game state + rooms (>24h, non-playing)
SELECT cleanup_stale_game_data();

-- 2. Expired waiting rooms
DELETE FROM rooms WHERE expires_at < NOW() AND status != 'playing';

-- 3. Expired challenge links (>24h past expiry)
DELETE FROM challenge_links WHERE expires_at < NOW() - INTERVAL '24 hours';

-- 4. Chat messages older than 90 days
DELETE FROM messages WHERE created_at < NOW() - INTERVAL '90 days';

-- 5. Completed games older than 90 days (kept for /history and /replay until then)
DELETE FROM completed_games WHERE played_at < NOW() - INTERVAL '90 days';

-- 6. Observability tables (otherwise grow forever)
DELETE FROM app_errors    WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM game_traces   WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM push_send_log WHERE created_at < NOW() - INTERVAL '30 days';
