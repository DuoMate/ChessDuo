-- ============================================
-- ChessDuo Security Advisory Fixes
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Revoke anon EXECUTE on delete_my_account
--    Only authenticated users should call this.
--    The function's auth.uid() check already
--    prevents damage for anon callers, but
--    the function shouldn't be callable at all.
-- ============================================
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;

-- ============================================
-- 2. Drop dashboard-added "Allow all" policy on rooms
--    The SQL-defined policies already cover:
--    - SELECT: "Rooms are viewable by everyone"
--    - INSERT: "Authenticated users can create rooms"
--    - UPDATE: "Room creator can update"
--    No app code does direct DELETE on rooms.
-- ============================================
DROP POLICY IF EXISTS "Allow all" ON public.rooms;

-- ============================================
-- 3. Drop dashboard-added "Allow all" on room_players
--    The SQL-defined policies already cover:
--    - SELECT: "Room members can view players"
--    - INSERT: "Authenticated users can join rooms"
--    - DELETE: "Players can leave rooms"
--    - UPDATE: "Players can update own record"
-- ============================================
DROP POLICY IF EXISTS "Allow all" ON public.room_players;

-- ============================================
-- 4. Drop dashboard-added "Anyone can insert completed games"
--    The SQL-defined "Authenticated users can insert completed games"
--    policy already provides proper auth gating.
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert completed games" ON public.completed_games;

-- ============================================
-- 5. Set search_path on handle_new_user
--    Prevents search-path injection attacks where
--    a malicious object in another schema could
--    hijack the function's queries.
-- ============================================
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = public;

-- ============================================
-- Verification queries (uncomment and run to check)
-- ============================================
-- SELECT * FROM pg_policies WHERE tablename IN ('rooms', 'room_players', 'completed_games');
-- SELECT proname, prosrc FROM pg_proc WHERE proname IN ('delete_my_account', 'handle_new_user');
