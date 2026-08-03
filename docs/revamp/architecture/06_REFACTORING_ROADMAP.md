# CHESSDUO — PHASE 5: REFACTORING ROADMAP

> **Engineering roadmap deliverable.** Execution plan for resolving the architectural debt identified in `05_ARCHITECTURAL_REVIEW.md`: refactoring principles, migration strategy, phased workstreams (A–I), risk matrix, rollback plan, testing strategy, and acceptance criteria.
> This document is **documentation only** — no implementation changes were made.
> Pairs with: `05_ARCHITECTURAL_REVIEW.md` (P5 Part 1), `04_EVENT_FLOW.md` (P4), `03_STATE_OWNERSHIP.md` (P3), `02_MODULE_ARCHITECTURE.md` (P2), `01_REPOSITORY_DISCOVERY.md` (P1).

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Refactoring Principles](#2-refactoring-principles)
3. [Migration Strategy](#3-migration-strategy)
4. [Roadmap Phases A–I](#4-roadmap-phases-ai)
5. [Risk Matrix](#5-risk-matrix)
6. [Rollback Strategy](#6-rollback-strategy)
7. [Testing Strategy](#7-testing-strategy)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Sequencing Rationale](#9-sequencing-rationale)
10. [Appendix](#10-appendix)

---

## 1. EXECUTIVE SUMMARY

Phase 5 identified **61 debt items** (5 CRITICAL, 22 HIGH) across six categories and an architecture health score of **42/100**. This roadmap converts the 20 recommendations from `05_ARCHITECTURAL_REVIEW.md` §10 into **nine ordered workstreams (Phases A–I)**, sequenced by *payoff ÷ risk* and grouped so that mechanical, low-risk moves land first and high-risk correctness work is guarded by tests.

### Phase map at a glance

| Phase | Name | Focus | Debt resolved | Risk |
|-------|------|-------|---------------|------|
| **A** | Layering & Structural Quick Wins | Layer violations, shared types, SSOT consolidation | S-09..S-14, D-07/D-08, V8 | LOW |
| **B** | Behavior-Preserving Dedup (Hooks) | Audio, sounds, game-over save | D-04..D-06 | LOW |
| **C** | Move Resolution Unification | `resolveLegacy`, `ResolutionService`, `TurnManager` | S-04/S-05, D1–D3, V3/V9 | HIGH |
| **D** | Timer Unification | Authoritative `TimerService` | S-06, D-03, V1, R18 | HIGH |
| **E** | Shared GameShell | Duel island collapse | S-07/S-08, V10 | MEDIUM |
| **F** | Multiplayer Correctness | Event versioning, lock timeout, reconnect | R1–R3, R-04 | HIGH |
| **G** | Data Layer & Security | `Database` types, RLS | R-01/R-02/R-05 | MEDIUM |
| **H** | Test Backfill | Regression shield for M17/M18/M16/M12 | T-01..T-09 | LOW |
| **I** | Observability & Cleanup | Event log, crash analytics, orphan removal | R-04, DOC-06 | LOW |

**Completion order rule:** Phases A, B, H can be interleaved. **H must be largely complete before C and D begin.** Phases C, D, F are the highest-risk and must each land behind the test shield + feature flag where possible. Phase G may run early if RLS work is time-critical but must respect the documented anonymous Quick Play staging caveat.

---

## 2. REFACTORING PRINCIPLES

1. **No behavior change.** Every refactor must be behavior-preserving. Game resolution semantics (move ordering, winner determination, checkmate short-circuit) are frozen during all refactors (P5 §10.2).
2. **Strangler Fig, not Big Bang.** Never rewrite `Game.tsx` (M17), `onlineGame.ts` (M15), or the resolution pipeline wholesale. Decompose via extraction: pull logic out into hooks/services while the orchestrator shrinks incrementally.
3. **Tests before risk.** No high-risk phase (C, D, F) starts until the regression shield (Phase H) covers the affected paths. No refactor ships with a red or skipped relevant suite.
4. **One owner per state.** Every extracted service must own its state. Match timer, resolved move, and move comparison (the three ❌ SSOT states) each receive exactly one authoritative owner.
5. **Shared types live in `features/shared/`.** No type that crosses a module boundary may be defined in an implementation module (`localGame.ts`, `components/`).
6. **`lib/` is framework-free.** No React hooks, no `'use client'`, no JSX in `lib/`. React-coupled code belongs in `hooks/` or `components/`.
7. **Boundaries over convenience.** No new direct `supabase.from('profiles')` / `from('rooms')` reads in UI. Route through services (M02, M08). No new Realtime channels outside the M28 factory.
8. **Every landing must be shippable.** Each phase leaves the app deployable. No long-lived branches; incremental PRs per step.
9. **Document with the code.** Each phase updates the affected `CONTEXT.md` files (Recent Changes) and checks off resolved entries in the P5 debt register.
10. **Validate against P5 before each phase.** Re-read `05_ARCHITECTURAL_REVIEW.md` and confirm the target debt items are still unresolved and unchanged before starting.

---

## 3. MIGRATION STRATEGY

### 3.1 Extraction-first decomposition

All large-module work follows the same pattern:

```
1. Identify cohesive cluster in the god object (e.g., timer, sounds, game-over save).
2. Write tests capturing current behavior (Phase H) — green on current code.
3. Extract the cluster into a hook/service with identical behavior.
4. Wire the orchestrator to the new unit; delete the inline copy.
5. Run full suite + manual smoke of all modes (online, offline, duel, vs-bot).
6. Check off debt entries; update CONTEXT.md.
```

### 3.2 Feature-flag guardrails

For behavior-adjacent work (Phases C, D, F), use lightweight feature flags or dual-path comparisons where a single PR is too large:

- **Parallel implementations:** New service runs alongside legacy path; a debug logger compares outputs in dev/staging until N consecutive matches, then the legacy path is removed.
- **Coordinator election:** Keep alphabetical order unchanged (H2) unless Phase F explicitly changes it — do not reorder election and resolution in the same PR.

### 3.3 Sequencing of cross-module changes

- Type moves (Phase A) must be coordinated with their importers in the **same PR** to keep `tsc` green.
- `GameInterface.ts` stays the sole gateway for `Game.tsx` at all times — **never `as any`** during migration.
- Dead-code removal (orphaned deps, `resolveLegacy` call sites) is staged in the same phase as the replacement, never earlier.

### 3.4 Definition of "done" per phase

Each phase completes when: (1) all its steps landed, (2) targeted debt entries checked off, (3) full suite + lint + typecheck green, (4) all four modes smoke-tested, (5) CONTEXT.md updated, (6) acceptance criteria in §8 pass.

---

## 4. ROADMAP PHASES A–I

### PHASE A — Layering & Structural Quick Wins

**Goal:** Restore layer integrity and type ownership with mechanical, behavior-preserving moves. Lowest risk, highest early payoff.
**Risk:** LOW. **Effort:** Small–Medium. **Debt resolved:** S-09, S-10, S-11, S-13, S-14, S-15, D-07, D-08, V8.

Steps:

1. **Move `features/auth/` React code to the correct layers** (Rec 4, BV1/BV2).
   - `AuthGate.tsx` → `src/components/AuthGate.tsx`.
   - `useAuthSession.ts` → `src/hooks/useAuthSession.ts`.
   - Update all importers in one PR; no behavior change.
2. **Split `lib/settings.ts`** (Rec 5, BV3).
   - Pure localStorage utilities stay in `lib/settingsStorage.ts`.
   - `useSettings()` hook → `src/hooks/useSettings.ts` (with `'use client'`).
   - Update `Game.tsx`, `DuelGame.tsx`, layout importers in the same PR.
3. **Move shared types to `features/shared/`** (Rec 6, BV5, S4).
   - `GameStatus`, `MoveComparison` from `localGame.ts` → `features/shared/gameTypes.ts`.
   - `PromotionPiece` from `components/ChessBoard.tsx` → `features/shared/gameConstants.ts` (or `gameTypes.ts`).
   - Re-export from legacy locations temporarily if needed, then delete the re-exports once importers migrate.
   - Removes the `GameInterface → localGame` and `chessUtils → components` inversions.
4. **Consolidate room creation to one path** (Rec 19, D7, V8).
   - Single `createRoom()` in `lib/roomActions.ts` used by online, four-player, and matchmaking flows.
   - Replace duplicated `ROOM_EXPIRY_MS` (24h vs 60s) with named constants in `gameConstants.ts`.
5. **Adopt `profileService` everywhere** (Rec 20, BV6, D-08).
   - Route all 12+ direct `supabase.from('profiles')` call sites through M02 `profileService`.
   - Leave RLS untouched (deferred to Phase G).
6. **Resolve `friends.ts` vs `friendService.ts` overlap** (S-15) — pick one owner, forward-delegate from the other, then remove.
7. **Fix documentation drift DOC-01..DOC-05** (MultiPV 2→6, SvelteKit template, `src/proxy.ts`→`src/middleware.ts`, settings sync, `&amp;`) as small follow-ups.

**Exit criteria:** Zero React in `features/auth/` and `lib/`; zero type imports crossing implementation boundaries; one room-creation path; all `profiles` reads routed through M02; `tsc --noEmit` green; no test regressions.

---

### PHASE B — Behavior-Preserving Dedup (Hooks)

**Goal:** Remove the largest UI-layer duplications between `Game.tsx` and `DuelGame.tsx` by extracting shared hooks. No logic changes.
**Risk:** LOW. **Effort:** Small–Medium. **Debt resolved:** D-04, D-05, D-06.

Steps:

1. **Extract `useAudioInit()`** (D-05) — the `tryResumeAudio` AudioContext-resume pattern (~18×2) into `src/hooks/useAudioInit.ts`.
2. **Extract `useGameSounds()`** (D-07) — the FEN/captured-diff sound triggers (~30×2) into a hook, parameterized by mode.
3. **Extract `useGameOverSave()`** (D-08) — the game-over save orchestration (~66×2), preserving the `gameSavedRef` dedupe semantics.
4. **Optionally extract `usePromotion()`** (D-11, auto-queen + modal) if the split is clean.
5. Wire both shells to the hooks; delete inline copies; confirm sound/audio behavior identical in all four modes.

**Exit criteria:** No duplicate sound/audio/save logic between M17 and M18; hooks tested at least at unit level where feasible; behavior identical (verified by manual smoke).

---

### PHASE C — Move Resolution Unification

**Goal:** Collapse the 4 move-resolution implementations into one `ResolutionService` and eliminate the CRITICAL `resolveLegacy` duplication.
**Risk:** HIGH — this is the core correctness path for every game mode.
**Effort:** Medium–Large. **Debt resolved:** S-04, S-05, D1–D3, V3, V9, B-05.

**Prerequisite:** Phase H tests for `onlineGame.resolvePendingMoves`, `localGame.resolvePendingMoves`, and the checkmate short-circuit must be green first.

Steps:

1. **Delete `resolveLegacy`** (Rec 1, D1) — remove the ~170-line near-verbatim copy and its call sites (`Game.tsx executeBotMove`), switching the bot path to the pending-moves API.
   - This is the single highest line-savings-per-risk change in the roadmap.
2. **Extract `buildMoveComparison()` factory** (Rec 2, D-02/D3) — the 20+ prop `MoveComparison` construction (~25×3) into one pure factory in `features/shared/` (or the resolution module).
3. **Extract the checkmate short-circuit helper** (Rec 3, D-01/D2) — the temp-Chess `tryMove → isCheckmate → MoveComparison w/ CHECKMATE_SCORE` block (~55×3).
4. **Extract `ResolutionService`** (Rec 10, V3) — pure `(a, b, fen) → MoveComparison` shared by online, offline, and duel engines.
   - Duel (`duelGame.ts:makeMove`) becomes the last consumer to adopt it, since it currently has a single-move path with inline accuracy.
5. **Extract `TurnManager`** (Rec 11, V9, B-05) — engine-level turn advancement + bot continuation, removing the UI-driven refs (`pendingOpponentTurnRef`, `initialBotTurnTriggeredRef`, `opponentInProgressRef`) from `Game.tsx`.

**Do NOT change** resolution semantics, winner determination, or ordering during this phase.

**Exit criteria:** Exactly one resolution implementation; `resolveLegacy` gone; zero bot-continuation logic in `Game.tsx`; Phase H resolution tests still green.

---

### PHASE D — Timer Unification

**Goal:** End the 4-owner timer split (V1) and the dual-timer timeout race (R18 / S2) with a single authoritative `TimerService`.
**Risk:** HIGH — timeout winner determination affects match outcomes.
**Effort:** Large. **Debt resolved:** S-06, D-03, V1, S2, R18.

**Prerequisite:** Phase H tests covering `Game.tsx tickMatchTimer` and `OnlineGame startMatchTimer`, including the captured-piece timeout-winner comparison, must be green.

Steps:

1. **Design the authoritative clock** — one `TimerService` instance per match owned by M22, with elapsed-time deltas synced from the engine on reconnect (absorbing D-12/D-17 reconnect restoration).
2. **Move timeout-winner determination into the service** — the captured-piece comparison currently duplicated in `Game.tsx` + `onlineGame.ts` (+ duel variant) lives in exactly one place.
3. **Migrate consumers** — `Game.tsx`, `DuelGame.tsx`, `onlineGame.ts`, `duelGame.ts` subscribe to `TimerService` events instead of running their own countdowns.
4. **Remove the `DEFAULT_MOVE_TIMER_SECONDS` dead constant** (S7) or wire it only if a feature requires it.

**Exit criteria:** One timer owner; no countdown logic in shells; timeout winner determinism verified by the Phase H race tests (R18) passing; no drift after reconnect in manual multi-client smoke.

---

### PHASE E — Shared GameShell

**Goal:** Collapse the Duel island (V10) and remove the M17/M18 duplication (S-08) behind a shared `GameShell`.
**Risk:** MEDIUM. **Effort:** Large. **Debt resolved:** S-07, S-08, D-18/D-22, V10.

Steps:

1. **Move `duelGame.ts` from `lib/` to `features/duel/`** (BV4) and give it a shared contract (implements `GameInterface`-style methods rather than an island API).
2. **Extract the common shell** — the shared modal set, nav guard (`useNavigationGuard` + `LeaveConfirmModal`), back-button pattern, promotion handling, and board wiring into `GameShell` components/hooks parameterized by engine.
3. **Migrate `Game.tsx` and `DuelGame.tsx`** to compose the shell, keeping mode-specific orchestration in thin wrappers.
4. Leave mode-specific logic (matchmaking vs quick-play vs 1v1) in dedicated hooks; do not force identical flows where rules differ.

**Exit criteria:** `DuelGame.tsx` shrinks to a thin wrapper; no duplicated modal/nav/board wiring; duel engine lives in `features/`; both modes smoke-tested.

---

### PHASE F — Multiplayer Correctness

**Goal:** Harden realtime correctness: event ordering (R1 — the 2026-08-03 broadcast bug), lock timeouts (R3), and reconnect consistency (R2).
**Risk:** HIGH — live multiplayer behavior.
**Effort:** Medium. **Debt resolved:** R1–R3.

**Prerequisite:** Phase H tests for broadcast-ordering scenarios and reconnect are in place.

Steps:

1. **Event versioning / sequence numbers** (Rec 13, R1) — attach a monotonic sequence to `player_locked` / `turn_resolved` broadcasts so stale messages are rejected; add the ordering rule set from P4 §8.
2. **Engine-level lock timeout** (Rec 14, R3) — bounded wait for `waitForTeammateLock` so a dropped teammate doesn't stall a turn forever; reuse the named timeout constants.
3. **Versioned reconnect sync** (Rec 15, R2) — `syncGameState` merges in-flight broadcasts with the DB load using sequence/version info instead of blind overwrite.
4. **Address M28 bypasses** (BV22) — route duel + chat channels through the `subscriptionManager` factory.

**Exit criteria:** The R1 bug scenario is covered by a green regression test; lock timeouts bounded; reconnect no longer overwrites fresher state (R2 test green).

---

### PHASE G — Data Layer & Security

**Goal:** Close the "Allow all" RLS holes and type drift.
**Risk:** MEDIUM. **Effort:** Medium. **Debt resolved:** R-01, R-02, R-05.

Steps:

1. **Regenerate `Database` types** (R-02, R-05) from the actual schema (`games`, `duel_games`, `message_type` included) so hand-maintained drift disappears.
2. **Tighten RLS** (R-01) on `room_players` and `games` — from allow-all to authenticated+participant policies.
3. **Stage anonymous Quick Play tests** before and after the RLS change (documented P0 caveat) — anonymous users must still create/join/play.
4. **Keep the `host_team` + `get_room_join_state` RPC contract (H3) intact** when adding policies.

**Exit criteria:** No allow-all policies on `room_players`/`games`; `Database` type matches schema; anonymous Quick Play regression suite green; existing multiplayer manual smoke passes.

---

### PHASE H — Test Backfill

**Goal:** Build the regression shield that de-risks Phases C, D, F and protects every future change.
**Risk:** LOW (tests only). **Effort:** Large. **Debt resolved:** T-01..T-09.

Steps:

1. **Un-skip the 22 `describe.skip` blocks** (~1,950 lines) — starting with `gameState.ts` (entire suite skipped), then `accuracyAndMoveTrail`, `botIntegration`, `gameOver`, `moveValidation`. Audit each skip first; fix the underlying failures rather than deleting tests.
2. **Write `Game.tsx` critical-path tests** (T-01) with mocked engines/`supabase` — turn lifecycle, bot continuation, timer tick, game-over save.
3. **Write `DuelGame.tsx` + `duelGame.ts` tests** (T-02) — the 1v1 engine is currently unguarded.
4. **OnlineGame reconnect tests** (T-05) — reconnect + `syncGameState`.
5. **Broadcast-ordering scenario tests** (T-06) — the R1 regression scenario.
6. **Push, middleware, deep-link tests** (T-07..T-09) — small coverage for the remaining gaps.

**Exit criteria:** Zero skipped core-suite blocks; M17/M18/M16/M12 covered at critical-path level; R1/R2/R18 race tests exist and are green.

---

### PHASE I — Observability & Cleanup

**Goal:** Structured logging, crash analytics, and removal of orphaned dependencies.
**Risk:** LOW. **Effort:** Small–Medium. **Debt resolved:** R-04, DOC-06, §3.5 orphans.

Steps:

1. **Structured event log** (Rec 18) — replace ad-hoc toast/`console` handling with a structured log service feeding crash analytics; add client-side rate limiting to `/api/log-crash` (R-04).
2. **Remove orphaned dependencies** (P5 §3.5): Render Stockfish server (`server/`), `BottomNav.tsx`, `TeamIndicator.tsx`, `_forceCreate`, `profiles.insights_reveals_used`, unused `DEFAULT_MOVE_TIMER_SECONDS`, `ConfirmMoveButton.tsx` (verify zero importers first).
3. **Resolve `server/` CONTEXT.md status** (DOC-06) — confirm zero traffic before decommissioning the deployment.

**Exit criteria:** Structured logs in place; orphan list empty; `/api/log-crash` rate-limited; all removal PRs green.

---

## 5. RISK MATRIX

| Phase | Change | Failure mode | Impact | Likelihood | Mitigation |
|-------|--------|--------------|--------|------------|------------|
| A | Type moves | Missed importer → broken build | HIGH (blocking) | MEDIUM | Ship moves + importers in one PR; rely on `tsc --noEmit` |
| A | `features/auth/` move | Import cycle via barrel files | MEDIUM | LOW | Grep all importers before moving |
| B | Hook extraction | Sound/audio behavior drift | LOW | MEDIUM | Manual 4-mode smoke; parameterized hook tests |
| C | `resolveLegacy` deletion | Bot path regresses (offline/vs-bot) | HIGH | MEDIUM | Phase H bot tests green first; dual-path compare in staging |
| C | `ResolutionService` | Resolution semantics change | CRITICAL | MEDIUM | Frozen semantics rule; gold-master fixture comparisons |
| D | Timer unification | Timeout winner changes | CRITICAL | MEDIUM | Phase H R18 race tests; delta-sync verification |
| E | GameShell | Duel/Game shell regress together | HIGH | MEDIUM | Both shells smoke-tested each PR; incremental extraction |
| F | Event versioning | In-flight clients vs new ordering | HIGH | MEDIUM | Feature flag; deploy version bump; back-compat reject-silently |
| F | Reconnect sync | State overwrite still occurs | HIGH | MEDIUM | Sequence-merge tests (R2) |
| G | RLS tightening | Anonymous Quick Play breaks | CRITICAL | MEDIUM | Staged anonymous regression suite (P0 caveat) |
| H | Un-skipping suites | Hidden failures surface mid-refactor | MEDIUM | HIGH | Audit each skip; fix before refactor, in isolated PRs |
| I | Orphan removal | Hidden importer removed by mistake | MEDIUM | LOW | Verify zero importers with grep before deletion |

### 5.1 Highest-risk transitions
1. **Phase C → D sequence:** both touch move/turn/timer semantics. Do not interleave their PRs; land C fully (including `TurnManager`) before D starts.
2. **Phase G RLS** — the only change that can break *anonymous* play; gate behind the staged anonymous suite.
3. **Phase F broadcast changes** — coordinates with live clients; prefer a deploy-time version gate.

---

## 6. ROLLBACK STRATEGY

1. **Per-PR reversibility:** every PR must be revertable without schema migration or data migration. No refactor PR bundles a DB migration.
2. **RLS change (Phase G) is the exception:** it is reversible via a single revert of the policy SQL, but the staged anonymous suite must be run before AND after. Keep the old policies in a commented migration file for instant re-apply.
3. **Feature flags:** Phase F changes gate behind a flag defaulting to legacy behavior for one release cycle. If ordering issues surface, flip back without code revert.
4. **Dual-path comparison (C/D):** if the new service diverges from the legacy path in staging, keep the legacy path until parity is proven; remove it only after N consecutive matches with zero divergence.
5. **Emergency rollback trigger:** any red core-suite test, any multiplayer bug report matching R1/R2/R18, or any anonymous-play failure after Phase G → revert the last PR and re-run the affected suite.

---

## 7. TESTING STRATEGY

1. **Pre-refactor baseline (Phase H):** capture current behavior with tests *before* touching code — tests are the change spec.
2. **Golden fixtures:** for resolution/timer logic (C, D), maintain fixed FEN + move-sequence fixtures with expected `MoveComparison` / winner outputs; any refactor must reproduce them byte-for-byte.
3. **Four-mode smoke matrix** (must pass per phase):
   - Online 2v2 (two clients, realtime ordering)
   - Offline vs-bot (exercises `resolveLegacy` migration, bot continuation)
   - Quick Play (anonymous) — critical after Phase G
   - Duel 1v1 (engine + shell)
4. **Realtime tests:** use a mocked `RealtimeChannel`/presence harness for ordering + reconnect scenarios (T-05/T-06); manual cross-device smoke for latency-dependent cases.
5. **CI gates:** `npx tsc --noEmit`, `npm test` (no new failures, no newly skipped suites), lint. No phase lands with a skipped block it touched still skipped.
6. **Regression register:** each resolved debt entry in P5 §9 is checked off and its regression test referenced.

---

## 8. ACCEPTANCE CRITERIA

Phase A–I are complete when **all** of the following hold:

1. **Architecture health score ≥ 70/100** (re-run the P5 §2 rubric with the same dimensions).
2. **SSOT health ≥ 80/100** (P3 rubric): resolved move, move comparison, and match timer each have exactly one owner.
3. **Zero layer violations** — no React in `lib/` or `features/auth/`; no `lib → components` imports; no cross-implementation shared types.
4. **One resolution implementation** — `resolveLegacy` deleted; `ResolutionService` shared by all four modes.
5. **One timer owner** — timeout-winner logic exists in exactly one place; R18 race test green.
6. **No allow-all RLS** on `room_players`/`games`; `Database` type matches schema; anonymous Quick Play suite green.
7. **Test shield in place** — zero skipped core suites; M17/M18/M16/M12 covered; R1/R2/R18 regressions green; `npm test` fully green.
8. **No orphaned dependencies** — Render server decommissioned (after traffic confirmation), dead components/constants removed.
9. **Docs in sync** — all 31 `CONTEXT.md` files current, DOC-01..06 resolved, P5 debt register checked off.
10. **No feature regression** — online, offline, quick-play, and duel manual smoke matrices pass at the final state.

### Partial acceptance (per phase)
Each phase's own exit criteria (§4) must pass before the next high-risk phase begins. Phases A and B are independently shippable immediately. Phase H may run concurrently with A/B but must be complete before C/D/F.

---

## 9. SEQUENCING RATIONALE

- **A first:** mechanical, high-certainty, low-risk — restores boundaries that make later refactors safer and smaller.
- **B second:** pure dedup with zero semantics risk — shrinks the M17/M18 surface before shell work.
- **H before C/D/F:** the highest-risk work is only safe under a test shield; un-skipping suites early prevents latent failures from surfacing mid-refactor.
- **C before D:** move resolution is upstream of timer resolution (timeout winners compare captured pieces); unifying resolution first keeps the timer contract stable.
- **D after C:** single resolution + single turn manager make the authoritative timer tractable.
- **E after D:** shell extraction is easier once engines own timers and turns.
- **F late but before G:** realtime ordering is behavioral; land it while RLS is still permissive so tests don't conflate auth failures with ordering failures.
- **G after F:** tighten security once behavior is stable; anonymous suite staging is mandatory.
- **I last:** cleanup/observability benefits from the settled architecture and avoids churning removed files.

---

## 10. APPENDIX

### 10.1 Recommendation → phase cross-reference (from P5 §10)

| Rec | Recommendation | Phase |
|-----|----------------|-------|
| 1 | Unify `resolveLegacy` into `resolvePendingMoves` | C |
| 2 | Extract `buildMoveComparison()` factory | C |
| 3 | Extract checkmate short-circuit helper | C |
| 4 | Move `features/auth/` components + hooks | A |
| 5 | Split `lib/settings.ts` | A |
| 6 | Move shared types to `features/shared/` | A |
| 7 | `useAudioInit()` + `useGameSounds()` | B |
| 8 | `useGameOverSave()` | B |
| 9 | Single `TimerService` | D |
| 10 | Extract `ResolutionService` | C |
| 11 | Extract `TurnManager` | C |
| 12 | Shared `GameShell` | E |
| 13 | Event versioning / sequence numbers | F |
| 14 | Engine-level lock timeout | F |
| 15 | Versioned reconnect sync | F |
| 16 | Regenerate `Database` type + tighten RLS | G |
| 17 | Backfill tests | H |
| 18 | Structured event log + crash analytics | I |
| 19 | Consolidate room creation + expiry constants | A |
| 20 | `ProfileService` adoption | A |

### 10.2 Debt register → phase coverage

- **A:** S-09, S-10, S-11, S-13, S-14, S-15, D-07, D-08, R-03 (n/a), V8
- **B:** D-04, D-05, D-06, D-11 (optional)
- **C:** S-04, S-05, D1, D-01, D-02, D-09 (partly), V3, V9, B-05
- **D:** S-06, S-07 (n/a), D-03, D-12, D-17, V1, S2, R18
- **E:** S-07, S-08, D-13, V10
- **F:** R1, R2, R3, B-07
- **G:** R-01, R-02, R-05
- **H:** T-01..T-09
- **I:** R-04, DOC-06, §3.5 orphans
- **Unmapped / carried:** D-10, D-14, D-15, D-16, D-19, D-20, D-21, D-23, B-01 (covered by A step 5), B-02, B-03, B-04, B-06, B-08, B-09, DOC-01..05 — resolve opportunistically within their phase or as follow-ups; validate each against the P5 register before closing.

### 10.3 Cross-reference

- P5: `05_ARCHITECTURAL_REVIEW.md` — §§2, 5, 6, 7 (health, violations, duplication, SSOT), §9 (debt register), §10 (recommendations).
- P4: `04_EVENT_FLOW.md` — §7 (races R1–R18), §8 (ordering rules) for Phase F.
- P3: `03_STATE_OWNERSHIP.md` — §7 (V1–V10), §9 (refactor priorities) for Phases C/D.
- P2: `02_MODULE_ARCHITECTURE.md` — §3 (module specs), §7 (dependency analysis) for Phase A/E.
- Module IDs (M01–M35) follow Phase 2 definitions; debt IDs follow the P5 §9 register.

---

### Phase 5 Part 2 Complete

This document is **documentation only**. No implementation was modified.

**Phases A–I are proposals to be executed in future phases — each must re-validate against `05_ARCHITECTURAL_REVIEW.md` before starting, and must never change game resolution semantics.**
