# COACH MODE — Changelog

Every code change must be recorded. Format per change:

- **Date**:
- **Phase**:
- **Change**:
- **Files created**:
- **Files modified**:
- **Files deleted**:
- **Reason**:
- **Existing behaviour affected?**:
- **Tests**:
- **Regression status**:
- **Rollback approach**:

---

## Change 1 — Control documents
- **Date**: 2026-08-29
- **Phase**: 1 (Architecture)
- **Change**: Added the three project-control documents.
- **Files created**: COACH_MODE_PLAN.md, COACH_MODE_PROGRESS.md, COACH_MODE_CHANGELOG.md
- **Files modified**: none
- **Files deleted**: none
- **Reason**: Mandatory architectural source of truth + phase/progress tracking.
- **Existing behaviour affected?**: No.
- **Tests**: none
- **Regression status**: n/a
- **Rollback approach**: delete the three files.

---

## Change 2 — Coach Mode domain layer (engine, analysis, game, voice, persistence)
- **Date**: 2026-08-29
- **Phase**: 2–7
- **Change**: Implemented the isolated Coach Mode domain module.
- **Files created**: `src/features/coach/coachEngine.ts`, `coachAnalysis.ts`, `coachGame.ts`, `coachVoice.ts`, `coachPersistence.ts`, `index.ts`, `CONTEXT.md`
- **Files modified**: `package.json`, `package-lock.json` (added `@capacitor-community/text-to-speech@8.0.2`)
- **Files deleted**: none
- **Reason**: Core PvE game + Stockfish analysis (top-3, blunder/miss, explanations) + optional voice + isolated persistence.
- **Existing behaviour affected?**: No — all-new module; no production imports from it.
- **Tests**: `coachAnalysis.test.ts`, `coachEngine.test.ts`, `coachGame.test.ts` (24 tests, all pass).
- **Regression status**: `tsc --noEmit` clean.
- **Rollback approach**: delete `src/features/coach/`; revert `package.json`/`package-lock.json`.

## Change 3 — Coach Mode UI + premium gate + route
- **Date**: 2026-08-29
- **Phase**: 8
- **Change**: Coach Mode UI shell, premium gate, and `/coach` route.
- **Files created**: `src/components/coach/CoachGame.tsx`, `CoachPanel.tsx`, `CoachGate.tsx`, `src/app/coach/page.tsx`
- **Files modified**: none
- **Files deleted**: none
- **Reason**: Render the game, show top-3/feedback, enforce premium (client-side, mirroring InsightsGate).
- **Existing behaviour affected?**: No.
- **Tests**: none (component-level; covered by manual smoke).
- **Regression status**: `tsc --noEmit` clean.
- **Rollback approach**: delete `src/components/coach/` and `src/app/coach/`.

## Change 4 — coach_games persistence (DB)
- **Date**: 2026-08-29
- **Phase**: 9
- **Change**: New `coach_games` table + player-scoped RLS + GRANT, all inside `supabase.sql` as a single idempotent block (the whole file is designed to be re-run).
- **Files created**: none
- **Files modified**: `supabase/supabase.sql` (appended self-contained idempotent block)
- **Files deleted**: none
- **Reason**: Isolated Coach Mode history; separate from `games`/`completed_games`; one idempotent file to execute every time.
- **Existing behaviour affected?**: No existing table/policy touched.
- **Tests**: none (DB-level; idempotent SQL).
- **Regression status**: additive + idempotent only.
- **Rollback approach**: `DROP TABLE public.coach_games;`

## Change 5 — Home entry point (frozen file)
- **Date**: 2026-08-29
- **Phase**: 10
- **Change**: Added a "Coach" `GameModeCard` (mobile + desktop) and `handleStartCoach` navigation.
- **Files created**: none
- **Files modified**: `src/app/page.tsx` (additive only)
- **Files deleted**: none
- **Reason**: Discoverable launcher for the premium Coach Mode.
- **Existing behaviour affected?**: No existing mode logic/UI altered.
- **Tests**: none (manual smoke).
- **Regression status**: `tsc --noEmit` clean; existing routes unchanged.
- **Rollback approach**: revert the two added card blocks + `handleStartCoach` in `src/app/page.tsx`.
