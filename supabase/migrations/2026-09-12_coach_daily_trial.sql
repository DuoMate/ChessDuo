-- AI Coach daily free game (rolling 24h window).
-- REQUIRED MANUAL STEP: apply this in the Supabase dashboard / SQL editor.
-- It is NOT auto-applied by the app. Pre-migration, the app runs in
-- local-mirror mode (per-user localStorage) and premium status is unaffected.
--
-- RLS: `profiles` already allows own-row SELECT/UPDATE (auth.uid()::text = id),
-- so no new policies are needed. This column is written only by the owning user
-- (trial claim) and by the server-side verify route (premium grant path untouched).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_last_free_game_at TIMESTAMPTZ NULL;

-- Optional: index for future analytics (not required for the per-user lookup).
-- CREATE INDEX IF NOT EXISTS profiles_coach_trial_idx ON public.profiles (coach_last_free_game_at);
