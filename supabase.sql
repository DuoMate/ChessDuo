-- ============================================
-- ChessDuo Security Advisory Fixes
-- Run this once in Supabase SQL Editor
-- ============================================

-- 1. Revoke anon EXECUTE on delete_my_account
--    Prevents unauthenticated users from calling the function.
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;

-- 2. Drop dashboard-added "Allow all" on rooms
--    SQL-defined policies already cover SELECT/INSERT/UPDATE.
DROP POLICY IF EXISTS "Allow all" ON public.rooms;

-- 3. Drop dashboard-added "Allow all" on room_players
--    SQL-defined policies cover SELECT/INSERT/DELETE/UPDATE.
DROP POLICY IF EXISTS "Allow all" ON public.room_players;

-- 4. Drop dashboard-added "Anyone can insert completed games"
--    SQL-defined "Authenticated users can insert" is the correct policy.
DROP POLICY IF EXISTS "Anyone can insert completed games" ON public.completed_games;

-- 5. Set search_path on handle_new_user trigger
--    Prevents search-path injection attacks.
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = public;
