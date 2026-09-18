-- Perf audit follow-up: RLS init-once form + STABLE helpers + duplicate index drops.
-- REQUIRED MANUAL STEP: apply this in the Supabase dashboard / SQL editor.
-- It is NOT auto-applied by the app.
--
-- What this changes (semantics-preserving, RLS stays enabled everywhere):
--   1. Marks pure helpers STABLE so the planner can inline/cost them
--      (`is_room_member`, `can_join_room`, `get_room_join_state`).
--      `join_room_by_code` / `get_room_players` intentionally stay VOLATILE.
--   2. Rewrites every `auth.uid()` / `auth.role()` policy check to the
--      init-once form `(select auth.uid())` / `(select auth.role())`.
--      Same predicate, same roles — evaluated once per statement instead of
--      once per row. No policy is widened or removed except the duplicate
--      `completed_games` SELECT noted below.
--   3. Drops 4 duplicate indexes (keeps one UNIQUE each; PK-prefix duplicate).
--   4. ANALYZEs tables that reported est_rows = -1 (never vacuumed).
--
-- Rollback: re-run the previous policy definitions from your pg_policies
-- dump; indexes can be re-created with the CREATE INDEX statements below
-- (commented). No data is modified.

-- ============================================================
-- 1. STABLE helpers (pure reads — safe to inline within a statement)
-- ============================================================
ALTER FUNCTION public.is_room_member(uuid) STABLE;
ALTER FUNCTION public.can_join_room(uuid, text) STABLE;
ALTER FUNCTION public.get_room_join_state(uuid) STABLE;

-- ============================================================
-- 2. RLS policies — init-once auth form (same logic, per-statement eval)
-- ============================================================

-- challenge_links
DROP POLICY IF EXISTS "Authenticated users can create challenge links" ON public.challenge_links;
CREATE POLICY "Authenticated users can create challenge links" ON public.challenge_links
  FOR INSERT TO public WITH CHECK ((select auth.role()) = 'authenticated' AND ((select auth.uid()))::text = creator_id);
DROP POLICY IF EXISTS "Creator can deactivate challenge links" ON public.challenge_links;
CREATE POLICY "Creator can deactivate challenge links" ON public.challenge_links
  FOR UPDATE TO public USING (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = creator_id));
-- "Challenge links are viewable by everyone" (SELECT true) — unchanged.

-- coach_games
DROP POLICY IF EXISTS "Owner can delete own coach games" ON public.coach_games;
CREATE POLICY "Owner can delete own coach games" ON public.coach_games
  FOR DELETE TO public USING (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id));
DROP POLICY IF EXISTS "Owner can insert own coach games" ON public.coach_games;
CREATE POLICY "Owner can insert own coach games" ON public.coach_games
  FOR INSERT TO public WITH CHECK (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id));
DROP POLICY IF EXISTS "Owner can update own coach games" ON public.coach_games;
CREATE POLICY "Owner can update own coach games" ON public.coach_games
  FOR UPDATE TO public USING (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id));
DROP POLICY IF EXISTS "Owner can view own coach games" ON public.coach_games;
CREATE POLICY "Owner can view own coach games" ON public.coach_games
  FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id));

-- completed_games: drop the redundant authenticated-SELECT (the public
-- "Anyone can view completed games" (true) already covers it — two
-- permissive SELECTs are evaluated as OR on every row).
DROP POLICY IF EXISTS "Authenticated users can view completed games" ON public.completed_games;
DROP POLICY IF EXISTS "Authenticated users can insert completed games" ON public.completed_games;
CREATE POLICY "Authenticated users can insert completed games" ON public.completed_games
  FOR INSERT TO public WITH CHECK ((select auth.role()) = 'authenticated');
-- "Anyone can view completed games" (SELECT true) — unchanged.

-- duel_games
DROP POLICY IF EXISTS "Participants can insert duel games" ON public.duel_games;
CREATE POLICY "Participants can insert duel games" ON public.duel_games
  FOR INSERT TO public WITH CHECK ((((select auth.uid()))::text = player_white));
DROP POLICY IF EXISTS "Participants can update duel games" ON public.duel_games;
CREATE POLICY "Participants can update duel games" ON public.duel_games
  FOR UPDATE TO public USING (((((select auth.uid()))::text = player_white) OR (((select auth.uid()))::text = player_black)));
DROP POLICY IF EXISTS "Participants can view duel games" ON public.duel_games;
CREATE POLICY "Participants can view duel games" ON public.duel_games
  FOR SELECT TO public USING (((((select auth.uid()))::text = player_white) OR (((select auth.uid()))::text = player_black)));

-- friendships
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships" ON public.friendships
  FOR DELETE TO public USING (((select auth.uid()) IS NOT NULL) AND ((((select auth.uid()))::text = sender_id) OR (((select auth.uid()))::text = receiver_id)));
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT TO public WITH CHECK (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = sender_id));
DROP POLICY IF EXISTS "Users can update received requests" ON public.friendships;
CREATE POLICY "Users can update received requests" ON public.friendships
  FOR UPDATE TO public USING (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = receiver_id));
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL) AND ((((select auth.uid()))::text = sender_id) OR (((select auth.uid()))::text = receiver_id)));

-- games (membership checks via STABLE is_room_member — predicate unchanged)
DROP POLICY IF EXISTS "Room members can insert game" ON public.games;
CREATE POLICY "Room members can insert game" ON public.games
  FOR INSERT TO public WITH CHECK (is_room_member(room_id));
DROP POLICY IF EXISTS "Room members can update game" ON public.games;
CREATE POLICY "Room members can update game" ON public.games
  FOR UPDATE TO public USING (is_room_member(room_id));
DROP POLICY IF EXISTS "Room members can view game" ON public.games;
CREATE POLICY "Room members can view game" ON public.games
  FOR SELECT TO public USING (is_room_member(room_id));

-- messages
DROP POLICY IF EXISTS "Users can mark messages read" ON public.messages;
CREATE POLICY "Users can mark messages read" ON public.messages
  FOR UPDATE TO public USING (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = receiver_id));
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT TO public WITH CHECK (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = sender_id));
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL) AND ((((select auth.uid()))::text = sender_id) OR (((select auth.uid()))::text = receiver_id)));

-- profiles ("Profiles are viewable by everyone" SELECT true — unchanged)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO public WITH CHECK (((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = id));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO public USING ((((select auth.uid()))::text = id));

-- push_tokens
DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.push_tokens;
CREATE POLICY "Users can manage their own tokens" ON public.push_tokens
  FOR ALL TO public USING ((user_id = (select auth.uid())::text));

-- room_players
DROP POLICY IF EXISTS "Players can join rooms" ON public.room_players;
CREATE POLICY "Players can join rooms" ON public.room_players
  FOR INSERT TO public WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id) AND can_join_room(room_id, player_id)));
DROP POLICY IF EXISTS "Players can leave rooms" ON public.room_players;
CREATE POLICY "Players can leave rooms" ON public.room_players
  FOR DELETE TO public USING ((((select auth.uid()))::text = player_id));
DROP POLICY IF EXISTS "Players can update own record" ON public.room_players;
CREATE POLICY "Players can update own record" ON public.room_players
  FOR UPDATE TO public USING ((((select auth.uid()))::text = player_id));
DROP POLICY IF EXISTS "Room creator can delete room players" ON public.room_players;
CREATE POLICY "Room creator can delete room players" ON public.room_players
  FOR DELETE TO public USING (((SELECT rooms.created_by FROM rooms WHERE (rooms.id = room_players.room_id)) = (select auth.uid())::text));
DROP POLICY IF EXISTS "Room creator can update room players" ON public.room_players;
CREATE POLICY "Room creator can update room players" ON public.room_players
  FOR UPDATE TO public USING (((SELECT rooms.created_by FROM rooms WHERE (rooms.id = room_players.room_id)) = (select auth.uid())::text));
DROP POLICY IF EXISTS "Room members can view players" ON public.room_players;
CREATE POLICY "Room members can view players" ON public.room_players
  FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL) AND is_room_member(room_id));

-- rooms ("Rooms are viewable by everyone" SELECT true — unchanged)
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms
  FOR INSERT TO public WITH CHECK ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "Room creator can delete room" ON public.rooms;
CREATE POLICY "Room creator can delete room" ON public.rooms
  FOR DELETE TO public USING ((((select auth.uid()))::text = created_by));
DROP POLICY IF EXISTS "Room creator can update" ON public.rooms;
CREATE POLICY "Room creator can update" ON public.rooms
  FOR UPDATE TO public USING ((((select auth.uid()))::text = created_by));
DROP POLICY IF EXISTS "Room members can update room status" ON public.rooms;
CREATE POLICY "Room members can update room status" ON public.rooms
  FOR UPDATE TO public USING (((select auth.uid()) IS NOT NULL) AND is_room_member(id));

-- turn_submissions (EXISTS + STABLE is_room_member — predicate unchanged)
DROP POLICY IF EXISTS "Players can submit their own moves" ON public.turn_submissions;
CREATE POLICY "Players can submit their own moves" ON public.turn_submissions
  FOR INSERT TO public WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id) AND (EXISTS (SELECT 1 FROM games g WHERE ((g.id = turn_submissions.game_id) AND is_room_member(g.room_id))))));
DROP POLICY IF EXISTS "Players can update their own moves" ON public.turn_submissions;
CREATE POLICY "Players can update their own moves" ON public.turn_submissions
  FOR UPDATE TO public
  USING ((((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id) AND (EXISTS (SELECT 1 FROM games g WHERE ((g.id = turn_submissions.game_id) AND is_room_member(g.room_id))))))
  WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (((select auth.uid()))::text = player_id) AND (EXISTS (SELECT 1 FROM games g WHERE ((g.id = turn_submissions.game_id) AND is_room_member(g.room_id))))));
DROP POLICY IF EXISTS "Room members can view turn submissions" ON public.turn_submissions;
CREATE POLICY "Room members can view turn submissions" ON public.turn_submissions
  FOR SELECT TO public USING ((EXISTS (SELECT 1 FROM games g WHERE ((g.id = turn_submissions.game_id) AND is_room_member(g.room_id)))));

-- ============================================================
-- 3. Duplicate index drops (keep one UNIQUE each)
--
-- NOTE (2026-09-19 fix): some duplicates back UNIQUE table constraints
-- (Postgres refuses DROP INDEX on those with 2BP01). Each duplicate is
-- therefore removed constraint-first, then index-first — both guarded
-- with IF EXISTS, so the section is idempotent regardless of which form
-- the duplicate takes on your database.
-- ============================================================
-- rooms.code is covered 3× — keep rooms_code_unique.
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_code_key;
DROP INDEX IF EXISTS public.rooms_code_key;
DROP INDEX IF EXISTS public.idx_rooms_code;
-- completed_games.room_id unique is covered 2× — keep completed_games_room_id_key.
ALTER TABLE public.completed_games DROP CONSTRAINT IF EXISTS idx_completed_games_room_id_unique;
DROP INDEX IF EXISTS public.idx_completed_games_room_id_unique;
-- games.room_id unique is covered 2× — keep games_room_id_key.
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS idx_games_room;
DROP INDEX IF EXISTS public.idx_games_room;
-- turn_submissions (game_id, turn_number) is a left-prefix of the PK
-- (game_id, turn_number, player_id) — the PK covers it.
DROP INDEX IF EXISTS public.idx_turn_submissions_game;
-- To restore (if ever needed):
-- ALTER TABLE public.rooms ADD CONSTRAINT rooms_code_key UNIQUE USING INDEX rooms_code_unique; -- or recreate standalone:
-- CREATE UNIQUE INDEX rooms_code_key ON public.rooms USING btree (code);
-- CREATE INDEX idx_rooms_code ON public.rooms USING btree (code);
-- CREATE UNIQUE INDEX idx_completed_games_room_id_unique ON public.completed_games USING btree (room_id);
-- CREATE INDEX idx_games_room ON public.games USING btree (room_id);
-- CREATE INDEX idx_turn_submissions_game ON public.turn_submissions USING btree (game_id, turn_number);

-- ============================================================
-- 4. Fresh planner stats (tables reporting est_rows = -1)
-- ============================================================
ANALYZE public.challenge_links;
ANALYZE public.duel_games;
ANALYZE public.coach_games;
ANALYZE public.push_send_log;
