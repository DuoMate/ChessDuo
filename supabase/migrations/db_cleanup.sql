-- ============================================
-- Database cleanup: scheduled stale data deletion
-- + explicit realtime publication pin
-- ============================================
-- Deploy via Supabase SQL Editor. Idempotent — safe to re-run.
-- pg_cron extension is REQUIRED and auto-enabled below (falls back to
-- Dashboard → Extensions → pg_cron if the SQL editor role cannot).
-- ============================================

-- Enable pg_cron (idempotent). Installs the `cron` schema with
-- cron.schedule / cron.unschedule. Schema-qualified calls below resolve
-- regardless of search_path.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- 1. Stale data cleanup — hourly cron jobs
-- ============================================

-- Clean up expired waiting rooms (cascades to games, room_players,
-- duel_games, turn_submissions via FK ON DELETE CASCADE).
-- cron.schedule() throws on a duplicate job name, so unschedule the
-- existing job first (no-op if absent) to keep this file re-runnable.
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

-- Clean up challenge links expired >24h ago (keep recent ones for
-- any retry/reload edge cases).
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

-- Clean up chat messages older than 90 days. Keeps storage bounded
-- and prevents the badge-count query (SELECT sender_id FROM messages
-- WHERE receiver_id = $1 AND read = false) from scanning an
-- ever-growing table. Messages are ephemeral chat — no long-term
-- retention requirement.
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

-- Clean up completed games older than 90 days. History is preserved
-- for 90 days (accessible via /history page and /replay). Older
-- records are purged to prevent unbounded storage growth.
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

-- ============================================
-- 2. Pin realtime publication to subscribed tables only
-- ============================================
-- Reduces WAL scan surface for realtime.list_changes (currently
-- 50.4% of total DB time). Only tables that ChessDuo subscribes to
-- via postgres_changes channels are included.
--
-- NOTE: This publication is pinned to exactly these 7 tables. Any NEW table
-- that needs postgres_changes subscriptions MUST be ADDed here, otherwise the
-- client subscription will silently receive no events.
-- Runs fine as `postgres` on Supabase. If it ever errors with "must be owner
-- of publication supabase_realtime", apply it via Dashboard → Database →
-- Publications instead.
ALTER PUBLICATION supabase_realtime SET TABLE
  public.messages,
  public.friendships,
  public.profiles,
  public.room_players,
  public.games,
  public.turn_submissions,
  public.rooms;
