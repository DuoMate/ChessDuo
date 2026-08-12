-- ============================================
-- Database cleanup: scheduled stale data deletion
-- + explicit realtime publication pin
-- ============================================
-- Deploy via Supabase SQL Editor. Requires pg_cron extension
-- (enable via Dashboard → Extensions → pg_cron).
-- ============================================

-- ============================================
-- 1. Stale data cleanup — hourly cron jobs
-- ============================================

-- Clean up expired waiting rooms (cascades to games, room_players,
-- duel_games, turn_submissions via FK ON DELETE CASCADE).
SELECT cron.schedule(
  'cleanup-expired-rooms',
  '0 * * * *',  -- every hour at minute 0
  $$
    DELETE FROM rooms
    WHERE expires_at < NOW()
      AND status != 'playing'
  $$
);

-- Clean up challenge links expired >24h ago (keep recent ones for
-- any retry/reload edge cases).
SELECT cron.schedule(
  'cleanup-expired-challenges',
  '30 * * * *',  -- every hour at minute 30
  $$
    DELETE FROM challenge_links
    WHERE expires_at < NOW() - INTERVAL '24 hours'
  $$
);

-- Clean up chat messages older than 90 days. Keeps storage bounded
-- and prevents the badge-count query (SELECT sender_id FROM messages
-- WHERE receiver_id = $1 AND read = false) from scanning an
-- ever-growing table. Messages are ephemeral chat — no long-term
-- retention requirement.
SELECT cron.schedule(
  'cleanup-old-messages',
  '45 * * * *',  -- every hour at minute 45
  $$
    DELETE FROM messages
    WHERE created_at < NOW() - INTERVAL '90 days'
  $$
);

-- Clean up completed games older than 90 days. History is preserved
-- for 90 days (accessible via /history page and /replay). Older
-- records are purged to prevent unbounded storage growth.
SELECT cron.schedule(
  'cleanup-old-games',
  '15 * * * *',  -- every hour at minute 15
  $$
    DELETE FROM completed_games
    WHERE played_at < NOW() - INTERVAL '90 days'
  $$
);

-- ============================================
-- 2. Pin realtime publication to subscribed tables only
-- ============================================
-- Reduces WAL scan surface for realtime.list_changes (currently
-- 50.4% of total DB time). Only tables that ChessDuo subscribes to
-- via postgres_changes channels are included.
ALTER PUBLICATION supabase_realtime SET TABLE
  public.messages,
  public.friendships,
  public.profiles,
  public.room_players,
  public.games,
  public.turn_submissions,
  public.rooms;
