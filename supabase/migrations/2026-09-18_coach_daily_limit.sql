-- AI Coach daily free allowance: N games per UTC calendar day.
-- REQUIRED MANUAL STEP: apply this in the Supabase dashboard / SQL editor.
-- It is NOT auto-applied by the app. Pre-migration, the app runs in
-- local-mirror mode (per-user localStorage) plus the legacy
-- `coach_last_free_game_at` timestamp, and premium status is unaffected.
--
-- Pairs with the central product configuration:
--   src/features/shared/gameConstants.ts → AI_COACH_FREE_DAILY_LIMIT (= 3)
-- Changing that constant (e.g. 3 → 5) flips quota enforcement and all
-- derived messaging with no further edits.
--
-- RLS: `profiles` already allows own-row SELECT/UPDATE (auth.uid()::text = id),
-- so no new policies are needed. These columns are written only by the owning
-- user (trial claim) and read by the server-side status route.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_free_day TEXT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_free_count INTEGER NOT NULL DEFAULT 0;

-- Optional: index for future analytics (not required for the per-user lookup).
-- CREATE INDEX IF NOT EXISTS profiles_coach_free_day_idx ON public.profiles (coach_free_day);
