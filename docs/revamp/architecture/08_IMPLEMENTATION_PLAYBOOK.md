# CHESSDUO — PHASE 8: IMPLEMENTATION PLAYBOOK

> **Permanent engineering playbook.** Transforms the architecture documentation (Phases 1–7) into an executable implementation roadmap: module inventory with risk scores, 9 sequenced phases with exact boundaries, per-phase testing strategies, commit workflow, AI rules, and definition of done.
> This document is **documentation only** — no implementation changes were made.
> Paired with: `07_ARCHITECTURE_STABILIZATION_REPORT.md` (P6), `06_REFACTORING_ROADMAP.md` (P5 Part 2), `05_ARCHITECTURAL_REVIEW.md` (P5 Part 1), `04_EVENT_FLOW.md` (P4), `03_STATE_OWNERSHIP.md` (P3), `02_MODULE_ARCHITECTURE.md` (P2), `01_REPOSITORY_DISCOVERY.md` (P1).

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Module Inventory](#2-module-inventory)
3. [Implementation Order](#3-implementation-order)
4. [Implementation Phases](#4-implementation-phases)
5. [Testing Strategy](#5-testing-strategy)
6. [Git Workflow](#6-git-workflow)
7. [AI Implementation Rules](#7-ai-implementation-rules)
8. [Review Checklist](#8-review-checklist)
9. [Definition of Done](#9-definition-of-done)
10. [Future Maintenance Guidelines](#10-future-maintenance-guidelines)

---

## 1. EXECUTIVE SUMMARY

**Objective:** Convert the 61-item technical debt register and 20 refactoring recommendations (P5) into 9 ordered, gated implementation phases with explicit boundaries, risk ratings, and verification checklists.

**Current state:** Architecture health score **42/100** (P5). SSOT health **40/100** (P3). Five CRITICAL debt items, 22 HIGH. Zero implementation changes made in Phases 1–7.

**Target state:** Health score **≥70/100**, SSOT **≥80/100**, one resolution implementation, one timer owner, no allow-all RLS, full regression test shield (P6 §8 acceptance criteria).

**Key principle:** Every phase must be independently shippable — the app is deployable after each phase completes. No long-lived branches. No behavior changes permitted without explicit approval and tests.

**Implementation branch:** `architecture-refactor` (already created and pushed).

---

## 2. MODULE INVENTORY

All 35 modules (M01–M35) assessed for architecture health, complexity, regression risk, and refactoring priority.

| # | Module | Purpose | Maturity | Health | Complexity | Reg. Risk | Dependencies | Owner | Doc | Tests | Priority | Effort | Bug Risk |
|---|--------|---------|----------|--------|------------|-----------|--------------|-------|-----|-------|----------|--------|----------|
| M01 | Auth | Sign-in/sign-up + session mgmt | MEDIUM | 45 | MEDIUM | MEDIUM | M27, M02, M30 | AuthService | ⚠ | ✅ Partial | **A** | Small | LOW |
| M02 | Profile | User profiles + avatar | MEDIUM | 55 | LOW | LOW | M27, M30 | profileService | ✅ | ✅ | B | Medium | LOW |
| M03 | Settings | localStorage settings | MEDIUM | 45 | LOW | LOW | none | useSettings | ✅ | ✅ | **A** | Small | LOW |
| M04 | Routing | App router, layout, pages | MEDIUM | 40 | HIGH | MEDIUM | M01, M05, M07 | middleware | ✅ | ⚠ Partial | C | Large | MEDIUM |
| M05 | Mobile Nav | Bottom/side navigation | HIGH | 75 | LOW | LOW | M04 | HomeBottomNav | ✅ | ✅ | — | — | — |
| M06 | Capacitor | Android bridge | HIGH | 70 | LOW | LOW | M01, M07 | capacitorAuth | ✅ | ✅ Partial | — | — | — |
| M07 | Deep Link | Challenge/invite/redirect | MEDIUM | 55 | MEDIUM | MEDIUM | M08, M27, M01, M32 | challenges | ⚠ | ✅ | D | Medium | MEDIUM |
| M08 | Room Mgmt | Room create/join/destroy | MEDIUM | 50 | MEDIUM | MEDIUM | M27, M13 | roomActions | ✅ | ✅ | **A** | Medium | LOW |
| M09 | Matchmaking | Quick play queue | MEDIUM | 60 | MEDIUM | LOW | M08, M27 | matchmaking | ✅ | ⚠ Partial | — | — | — |
| M10 | 4-Player | Four-player lobby | MEDIUM | 65 | MEDIUM | LOW | M08, M27 | fourPlayerActions | ✅ | ✅ | — | — | — |
| M11 | Lobby UI | Pre-game UI | HIGH | 70 | MEDIUM | LOW | M12 | GameLobby | ✅ | ✅ | — | — | — |
| M12 | GameState | Core state machine | HIGH | 75 | MEDIUM | HIGH | chess.js, M13 | gameState | ❌ | ❌ Skipped | **3** | Medium | MEDIUM |
| M13 | Shared | GameInterface, constants | HIGH | 55 | LOW | MEDIUM | chess.js types | shared/ | ✅ | ✅ | **A** | Small | LOW |
| M14 | LocalGame | Offline 2v2 engine | MEDIUM | 40 | HIGH | HIGH | M12, M13, M23, M24 | localGame | ⚠ | ⚠ Skipped | **4** | Large | HIGH |
| M15 | OnlineGame | Online 2v2 engine | MEDIUM | 35 | EXTREME | HIGH | M12, M13, M23, M26, M27, M28 | onlineGame | ✅ | ✅ Partial | **4** | Large | HIGH |
| M16 | Duel Engine | 1v1 engine (island) | LOW | 25 | HIGH | HIGH | chess.js, M27, M23 | duelGame | ❌ | ❌ None | **6** | Large | HIGH |
| M17 | Game Shell | 2v2 UI orchestrator | LOW | 20 | EXTREME | CRITICAL | M14/M15, M19, M22, M25, M02, M03, M31, M34, M35 | Game.tsx | ✅ | ❌ None | **2/4/6** | Large | HIGH |
| M18 | Duel Shell | 1v1 UI orchestrator | LOW | 30 | HIGH | HIGH | M16, M19, M05, M22 | DuelGame.tsx | ❌ | ❌ None | **6** | Medium | MEDIUM |
| M19 | ChessBoard | Board rendering | HIGH | 65 | MEDIUM | MEDIUM | cm-chessboard, chess.js | ChessBoard | ✅ | ✅ | — | — | — |
| M20 | Resolution | Move resolution (no owner) | LOW | 25 | HIGH | CRITICAL | M14/M15/M16/M17 | none | ✅ | ✅ Partial | **4** | Large | HIGH |
| M21 | Turn Mgmt | Turn lifecycle | MEDIUM | 55 | MEDIUM | MEDIUM | M14/M15, M17 | none | ✅ | ✅ | **4** | Medium | MEDIUM |
| M22 | Timer | Match countdown (4 owners) | LOW | 20 | MEDIUM | HIGH | M12/M15/M17/M16 | none | ✅ | ⚠ Partial | **5** | Large | HIGH |
| M23 | Stockfish | WASM evaluator | HIGH | 80 | HIGH | LOW | WASM worker, M13 | BrowserMoveEvaluator | ✅ | ✅ | — | — | — |
| M24 | Bot | Bot AI + difficulty | HIGH | 70 | HIGH | LOW | M23, M13 | chessBot | ✅ | ✅ | — | — | — |
| M25 | Playback | Move history + replay | HIGH | 70 | LOW | LOW | M13, M19 | MovePlayback | ✅ | ✅ | — | — | — |
| M26 | Persistence | Game save/load | HIGH | 65 | LOW | LOW | M27 | gamePersistence | ✅ | ❌ None | — | — | — |
| M27 | Supabase | DB client | HIGH | 75 | MEDIUM | MEDIUM | @supabase/ssr | supabase | ✅ | ✅ | **8** | Medium | MEDIUM |
| M28 | Realtime | Channel factory | HIGH | 65 | LOW | LOW | @supabase/supabase-js | subscriptionManager | ✅ | ✅ | **7** | Small | LOW |
| M29 | API Infra | Route handlers + rate-limit | HIGH | 75 | MEDIUM | LOW | M27, Supabase, jose | rateLimit | ✅ | ✅ | **9** | Small | LOW |
| M30 | Billing | Premium subscriptions | HIGH | 80 | HIGH | MEDIUM | creem, M27, M29, M01 | SubscriptionService | ✅ | ✅ | — | — | — |
| M31 | Insights | Move analysis gate | MEDIUM | 55 | MEDIUM | LOW | M13, M30, M27 | insights | ✅ | ✅ | **2** | Small | LOW |
| M32 | Push | Push notifications | HIGH | 70 | MEDIUM | MEDIUM | web-push, jose, M27, M29 | PushNotificationService | ✅ | ⚠ Minimal | — | — | — |
| M33 | Friends | Friend list + requests | MEDIUM | 50 | MEDIUM | LOW | M27, M32, M34 | friends / friendService | ❌ | ✅ Partial | **A** | Medium | LOW |
| M34 | Chat | In-app messaging | HIGH | 70 | LOW | LOW | M27, M32 | messages | ✅ | ✅ | — | — | — |
| M35 | History | Match history | HIGH | 65 | LOW | LOW | M27, M13 | matchHistory | ❌ | ❌ None | — | — | — |

**Legend:**
- **Priority:** Number = implementation phase (1–9). Letter = Quick Win sub-phase within Phase A. "—" = no changes in scope (stabilized).
- **Maturity / Health:** Qualitative assessment from P2 §3 and P5 §2. EXTREME = ≥2,000-line god object with zero tests.
- **Doc / Tests:** ✅ = current. ⚠ = stale or partial. ❌ = missing.
- **Bug Risk:** Risk of introducing a regression during refactoring (LOW/MEDIUM/HIGH/CRITICAL).

---

## 3. IMPLEMENTATION ORDER

### 3.1 Phase sequence (with rationale)

| Seq | Phase | Why this position | What depends on it |
|-----|-------|-------------------|---------------------|
| **1** | Layering & Structural Quick Wins (Phase A) | Mechanical, zero-semantics risk. Restores boundaries that all later phases rely on. Cannot be delayed — every subsequent refactor touches modules whose boundary rules change here. | Phases 2–9 (shared types, layer integrity) |
| **2** | Behavior-Preserving Dedup (Phase B) | Zero behavioral risk, removes noise before core resolution work. Extracted hooks become the foundation for GameShell (Phase 6). Cannot be delayed — dedup must happen before duplicated copies diverge. | Phase 6 (GameShell uses extracted hooks) |
| **3** | Test Backfill (Phase H) | Gate for all HIGH-risk phases. Must complete before Phase 4 begins. Cannot be delayed — resolution/timer refactors are unsafe without a regression shield covering the affected paths. | Phases 4, 5, 7 (resolution, timer, multiplayer) |
| **4** | Move Resolution Unification (Phase C) | Core correctness path. Upstream of timer unification. Cannot be delayed — resolution semantics must stabilize before the authoritative timer (Phase 5) is built on them. | Phase 5 (timer depends on unified resolution) |
| **5** | Timer Unification (Phase D) | Ends 4-owner split and R18 race. Depends on Phase 4's single resolution. Cannot be delayed — dual-timer race is a live bug surface. | Phase 6 (GameShell needs authoritative timer) |
| **6** | Shared GameShell (Phase E) | Collapses Duel island (V10). Depends on Phase 2 hooks + Phase 5 timer. Cannot be delayed — Duel island divergence grows with each M17 change. | Phase 7 (multiplayer touches both shells) |
| **7** | Multiplayer Correctness (Phase F) | Event ordering (R1 bug), lock timeout (R3 hang), reconnect (R2 overwrite). Depends on Phases 4–5 (resolution + timer are prerequisites). Positioned before Phase 8 to keep RLS permissive during behavioral work. | Phase 8 (data layer after behavior stable) |
| **8** | Data Layer & Security (Phase G) | RLS tightening, `Database` type regeneration. Last behavioral phase — security hardening after all correctness work is verified. Cannot come before Phase 7 (anonymous Quick Play must work while RLS is permissive, to isolate failures). | None (final behavioral phase) |
| **9** | Observability & Cleanup (Phase I) | Low-risk cleanup. Must come last — removes orphaned code that earlier phases might reference. | None (final phase) |

### 3.2 Dependency graph (simplified)

```
Phase 1 (Layering) ──┬── Phase 2 (Dedup) ──┐
                      │                      ├── Phase 6 (GameShell)
Phase 3 (Tests) ──────┼── Phase 4 (Resolution)── Phase 5 (Timer) ──┤
                      │                      │                      │
                      └──────────────────────┴── Phase 7 (Multiplayer) ── Phase 8 (Data) ── Phase 9 (Cleanup)
```

### 3.3 What can run in parallel

- **Phase 1 + Phase 2** can run concurrently (no overlap in modules).
- **Phase 3** can start immediately and run alongside Phases 1–2.
- **Phase 9** has no dependency on Phase 8 — it can run anytime after Phase 7.

---

## 4. IMPLEMENTATION PHASES

Each phase defines exact boundaries: allowed modules, forbidden modules, files expected to change, acceptance criteria, regression checklist, and rollback plan.

---

### PHASE 1 — Layering & Structural Quick Wins

**Objective:** Restore layer integrity with mechanical moves. Zero semantic change.

| Field | Value |
|-------|-------|
| **Risk** | LOW |
| **Estimated effort** | Small–Medium (mechanical moves + import updates) |
| **Depends on** | Nothing |
| **Blocks** | Phases 2–9 |

#### 4.1.1 Allowed Modules

| Module | Change |
|--------|--------|
| M01 Auth | Move `features/auth/AuthGate.tsx` → `components/AuthGate.tsx`. Move `features/auth/useAuthSession.ts` → `hooks/useAuthSession.ts`. Delete `features/auth/` directory. |
| M03 Settings | Split `lib/settings.ts` → `lib/settingsStorage.ts` (pure utils) + `hooks/useSettings.ts` (React hook). Update importers. |
| M13 Shared | Move `GameStatus`/`MoveComparison` from `localGame.ts` → `features/shared/gameTypes.ts`. Move `PromotionPiece` from `components/ChessBoard.tsx` → `features/shared/gameTypes.ts`. |
| M08 Room | Consolidate 3 room-creation paths → single `createRoom()`. Unify `ROOM_EXPIRY_MS` constants. |
| M02 Profile | Route all 12+ `supabase.from('profiles')` call sites through `profileService`. |
| M33 Friends | Resolve `friends.ts` vs `friendService.ts` overlap. |
| DOC-01 | Update CONTEXT.md files for MultiPV=2→6. |
| DOC-02 | Fix CONTEXT-SYSTEM.md SvelteKit→Next.js. |
| DOC-03 | Fix ARCHITECTURE.md `proxy.ts`→`middleware.ts`. |

#### 4.1.2 Forbidden Modules

- M14 LocalGame, M15 OnlineGame, M16 DuelEngine — resolution/timer logic untouched.
- M17 Game.tsx, M18 DuelGame.tsx — structural decomposition deferred.
- M20 Resolution, M22 Timer — no ownership changes in this phase.
- M27 Supabase, M28 Realtime — channel/RLS work deferred.
- All API routes (M29) — no backend changes.

#### 4.1.3 Files Expected to Change

| File | Action | Max lines changed |
|------|--------|-------------------|
| `src/components/AuthGate.tsx` | Overwrite thin wrapper with full component | +167 |
| `src/hooks/useAuthSession.ts` | Create with hook content | +136 |
| `src/features/auth/AuthGate.tsx` | DELETE | −173 |
| `src/features/auth/useAuthSession.ts` | DELETE | −136 |
| `src/lib/settings.ts` | Rename → `settingsStorage.ts`, extract hook | ~50 |
| `src/lib/settingsStorage.ts` | Create (pure localStorage utils) | +68 |
| `src/hooks/useSettings.ts` | Create (React hook) | +50 |
| `src/features/shared/gameTypes.ts` | Create with `GameStatus`/`MoveComparison`/`PromotionPiece` | +80 |
| `src/features/offline/game/localGame.ts` | Remove type exports (move to shared) | −30 |
| `src/components/ChessBoard.tsx` | Remove `PromotionPiece` export | −10 |
| `src/features/shared/GameInterface.ts` | Update import path for types | ~3 |
| `src/features/online/game/onlineGame.ts` | Update import path for types | ~3 |
| `src/lib/chessUtils.ts` | Update import path for `PromotionPiece` | ~3 |
| `src/lib/roomActions.ts` | Consolidate room creation; unify expiry constant | ~40 |
| `src/lib/matchmaking.ts` | Point to unified room creation | ~15 |
| `src/lib/fourPlayerActions.ts` | Point to unified room creation | ~15 |
| `src/components/Game.tsx` | Update `useSettings` import path | ~2 |
| `src/components/DuelGame.tsx` | Update `useSettings` import path | ~2 |
| `src/app/(main)/layout.tsx` | Update `useSettings` import path | ~2 |
| 12+ UI files with `supabase.from('profiles')` | Route through `profileService` | ~5 each |
| `src/lib/friends.ts` + `src/lib/friendService.ts` | Consolidate | ~30 |
| 3 CONTEXT.md files | Update MultiPV=2→6 | ~5 each |
| `CONTEXT-SYSTEM.md` | SvelteKit→Next.js | ~10 |
| `02_MODULE_ARCHITECTURE.md` | Fix `proxy.ts`→`middleware.ts` | ~3 |

**Maximum files:** 35 (±5). **Maximum scope:** Layer boundary + type ownership + room creation + profile reads + friends dedup + documentation sync.

#### 4.1.4 Acceptance Criteria

1. `npx tsc --noEmit` — zero errors.
2. `npm test` — no new failures.
3. Zero React imports in `features/` or `lib/` (verified by grep).
4. Zero type imports crossing implementation boundaries (`chessUtils`→components, `GameInterface`→localGame).
5. One room-creation path (`roomActions.ts` only).
6. All four game modes smoke-tested (online 2v2, offline vs-bot, Quick Play, Duel 1v1).

#### 4.1.5 Regression Checklist

| # | Check | Method |
|---|-------|--------|
| R1 | Auth gate (overlay + page variants) renders correctly | Manual smoke on `/friends`, `/duel` |
| R2 | Settings persist across sessions (localStorage) | Manual: change setting, refresh, verify |
| R3 | Room join by code still works (online + 4-player) | Manual: 2 clients, join by code |
| R4 | Matchmaking Quick Play creates rooms | Manual: tap Quick Play, verify game starts |
| R5 | Profile avatar/display name change propagates | Manual: update profile, verify in game |
| R6 | Friends list/add/remove works | Manual smoke |
| R7 | Typecheck passes on all affected files | CI: `tsc --noEmit` |
| R8 | Existing tests for auth, settings, room, friends pass | CI: `npm test` |

#### 4.1.6 Rollback Plan

Each sub-step is an independent PR. Revert the PR if:
- Any test fails that previously passed.
- Any type error surfaces after the move.
- Any game mode shows auth gate regression.

RLS is NOT changed in this phase — no DB migration to roll back.

---

### PHASE 2 — Behavior-Preserving Dedup (Hooks)

**Objective:** Extract shared hooks for audio, sounds, and game-over save. Eliminates D-04/D-05/D-06 without behavioral change.

| Field | Value |
|-------|-------|
| **Risk** | LOW |
| **Estimated effort** | Small–Medium |
| **Depends on** | Phase 1 (shared types, settings hook location) |
| **Blocks** | Phase 6 (GameShell consumes these hooks) |

#### 4.2.1 Allowed Modules

| Module | Change |
|--------|--------|
| M17 Game.tsx | Extract `tryResumeAudio`, FEN/captured-diff sound detection, game-over save effect into hooks. Delete inline copies. |
| M18 DuelGame.tsx | Replace inline copies with extracted hooks. |
| New: `hooks/useAudioInit.ts` | AudioContext resume pattern (~18 lines). |
| New: `hooks/useGameSounds.ts` | FEN/captured-diff sound triggers (~30 lines). |
| New: `hooks/useGameOverSave.ts` | Game-over save orchestration (~66 lines). |
| M31 Insights | Fix BV7: `insights.ts` premium bypass fallback. |

#### 4.2.2 Forbidden Modules

- M14, M15, M16 — engine layer (resolution/timer logic).
- M20, M22 — resolution/timer ownership.
- All new features or behavior changes.

#### 4.2.3 Files Expected to Change

| File | Action | Max lines |
|------|--------|-----------|
| `src/hooks/useAudioInit.ts` | Create | +18 |
| `src/hooks/useGameSounds.ts` | Create | +30 |
| `src/hooks/useGameOverSave.ts` | Create | +66 |
| `src/components/Game.tsx` | Remove inline copies; wire hooks | −60 |
| `src/components/DuelGame.tsx` | Remove inline copies; wire hooks | −60 |
| `src/lib/insights.ts` | Fix premium bypass fallback (BV7) | ~10 |

**Maximum files:** 8. **Maximum scope:** UI-layer dedup only.

#### 4.2.4 Acceptance Criteria

1. `npm test` — no new failures. Sound/game-over tests pass.
2. Audio behavior identical in all 4 modes (manual smoke: confirm sounds fire on capture/check/move).
3. Game-over save behavior identical (manual: complete game, verify localStorage entry).
4. Insights premium gate still functional (manual: verify premium→insights flow).
5. Zero behavior drift between M17 and M18 for extracted logic.
6. `tsc --noEmit` zero errors.

#### 4.2.5 Regression Checklist

| # | Check |
|---|-------|
| R1 | Sound plays on piece capture (all modes) |
| R2 | Sound plays on check |
| R3 | Sound respects sound-enabled setting |
| R4 | Game-over saves to localStorage and Supabase |
| R5 | Insights gate enforces reveal limit |

#### 4.2.6 Rollback Plan

Independent PRs per hook. Revert any hook PR if its audio/save behavior differs from the original inline code. Use dual-path comparison: run old inline code alongside new hook in dev for N matches before removing the old path.

---

### PHASE 3 — Test Backfill

**Objective:** Build the regression shield required by Phases 4, 5, and 7. Un-skip all 22 describe.skip blocks. Write critical-path tests for M17/M18/M16/M12.

| Field | Value |
|-------|-------|
| **Risk** | LOW (tests only; no production code changed except skip removals) |
| **Estimated effort** | Large (~1,950 skipped lines + new tests) |
| **Depends on** | Phases 1–2 (module locations stabilized) |
| **Blocks** | Phases 4, 5, 7 |

#### 4.3.1 Allowed Modules

| Module | Action |
|--------|--------|
| M12 GameState | Un-skip entire test suite. Fix failures. |
| M15 OnlineGame | Write reconnect + broadcast-ordering tests. |
| M17 Game.tsx | Write critical-path tests (turn lifecycle, bot continuation, timer tick, game-over save). |
| M18 DuelGame.tsx + M16 duelGame.ts | Write engine + shell tests. |
| M22 Timer | Write R18 dual-timer race test. |
| M23/M24 Stockfish/Bot | Un-skip accuracy/benchmark/bot-integration suites. |
| M32 Push | Expand from 1 test to coverage of register/send/redirect flows. |
| M07 Deep Link | Write challenge-page + invite-page tests. |
| Middleware | Write auth redirect tests. |

Test harness: mocked `supabase`, mocked `RealtimeChannel`, mocked Stockfish evaluator, golden FEN + move-sequence fixtures for resolution/timer logic.

#### 4.3.2 Forbidden Modules

- M14, M15 — no behavior changes. Tests only.
- M20, M22 — no ownership changes. Tests only.
- No refactoring mixed with test writing.

#### 4.3.3 Files Expected to Change

| File | Action |
|------|--------|
| `src/lib/__tests__/gameState.test.ts` | Un-skip; fix failures |
| `src/lib/__tests__/accuracyAndMoveTrail.test.ts` | Un-skip |
| `src/lib/__tests__/botIntegration.test.ts` | Un-skip |
| `src/lib/__tests__/gameOver.test.ts` | Un-skip |
| `src/lib/__tests__/moveValidation.test.ts` | Un-skip |
| `src/lib/__tests__/localGame.test.ts` | Un-skip (~260 lines) |
| `src/lib/__tests__/onlineGame.test.ts` | Add reconnect tests |
| `src/components/__tests__/Game.test.tsx` | **Create** — critical paths |
| `src/components/__tests__/DuelGame.test.tsx` | **Create** — engine + shell |
| `src/lib/__tests__/duelGame.test.ts` | **Create** |
| `src/components/__tests__/MatchTimer.test.tsx` | Add R18 race test |
| `src/features/push-notifications/__tests__/PushNotificationService.test.ts` | Expand coverage |
| `src/app/__tests__/middleware.test.ts` | **Create** |
| `src/app/challenge/__tests__/` | **Create** |

**Maximum files:** 30 (±5, all in `__tests__/`). **Maximum scope:** Test files only (except skip removals in source comments).

#### 4.3.4 Acceptance Criteria

1. Zero `describe.skip` blocks in core suites (gameState, gameOver, moveValidation, localGame, botIntegration, accuracy).
2. `npm test` fully green.
3. `Game.tsx` critical-path coverage ≥ 60% (turn lifecycle, bot continuation, timer tick, game-over save).
4. `DuelGame.tsx` + `duelGame.ts` coverage ≥ 50%.
5. `gameState.ts` coverage ≥ 80%.
6. R1 (broadcast ordering), R2 (reconnect overwrite), R18 (dual-timer race) have regression tests that are green.

#### 4.3.5 Regression Checklist

Tests are the regression shield — each new test captures current behavior. Any refactor in Phases 4–9 that breaks a Phase 3 test must either:
- Fix the refactor to preserve behavior, OR
- Get explicit approval for the behavioral change (update the test to reflect the new, correct behavior).

#### 4.3.6 Rollback Plan

Tests are additive. No rollback needed for test files. If a skip removal exposes a latent bug, re-skip that specific block, file the bug separately, and continue with remaining suites.

---

### PHASE 4 — Move Resolution Unification

**Objective:** Collapse 4 resolution implementations → 1 `ResolutionService`. Delete `resolveLegacy` (~170 lines, D1 CRITICAL). Extract `TurnManager`.

| Field | Value |
|-------|-------|
| **Risk** | HIGH (core correctness path: all game modes) |
| **Estimated effort** | Medium–Large |
| **Depends on** | Phase 3 (test shield must be green) |
| **Blocks** | Phase 5 (timer unification) |

#### 4.4.1 Allowed Modules

| Module | Change |
|--------|--------|
| M14 LocalGame | Delete `resolveLegacy`. Switch bot path to `resolvePendingMoves`. |
| M15 OnlineGame | Extract `buildMoveComparison()` factory, checkmate short-circuit helper. |
| New: `features/shared/resolutionService.ts` | Pure `(a, b, fen) → MoveComparison` shared by all engines. |
| New: `features/shared/turnManager.ts` | Engine-level turn advancement + bot continuation. |
| M17 Game.tsx | Remove UI-driven bot continuation refs (`pendingOpponentTurnRef`, etc.). Wire `TurnManager`. |

#### 4.4.2 Forbidden Modules

- M16 duelGame.ts — Duel engine resolution handled in Phase 6 (GameShell).
- M22 Timer — no timer logic changes.
- Any resolution semantics change — checkmate short-circuit, winner determination, and ordering must be bit-for-bit identical.

#### 4.4.3 Files Expected to Change

| File | Action | Max lines |
|------|--------|-----------|
| `src/features/offline/game/localGame.ts` | Delete `resolveLegacy` (~170 lines); update call sites | −170 |
| `src/features/online/game/onlineGame.ts` | Extract `buildMoveComparison` factory, checkmate helper | variable |
| `src/features/shared/resolutionService.ts` | **Create** | +120 |
| `src/features/shared/turnManager.ts` | **Create** | +100 |
| `src/components/Game.tsx` | Remove bot continuation refs; wire TurnManager | −50 |
| `src/features/shared/GameInterface.ts` | Add resolution/turn methods if needed | +10 |

**Maximum files:** 8. **Maximum scope:** Resolution pipeline only (M14, M15, M17, shared).

#### 4.4.4 Acceptance Criteria

1. Exactly one resolution implementation (`resolutionService.ts`).
2. `resolveLegacy` deleted — verified by grep.
3. Zero bot-continuation logic in `Game.tsx` (verified by grep for `pendingOpponentTurnRef`, `initialBotTurnTriggeredRef`, `opponentInProgressRef`).
4. All Phase 3 resolution tests still green — golden fixtures match bit-for-bit.
5. All four modes smoke-tested with identical move outcomes.

#### 4.4.5 Regression Checklist

| # | Check |
|---|-------|
| R1 | Online 2v2 move resolution produces same outcomes |
| R2 | Offline vs-bot move resolution produces same outcomes |
| R3 | Duel 1v1 move resolution produces same outcomes |
| R4 | Checkmate detection works in all modes |
| R5 | Bot continuation triggers correctly after resolution |
| R6 | Golden fixture comparison: input FEN + 2 moves → expected MoveComparison matches |
| R7 | Phase 3 resolution tests pass |

#### 4.4.6 Rollback Plan

**Feature flag:** Two `ResolutionService` implementations — old path and new path. New path is enabled with a flag (`useUnifiedResolution = true`). Run both paths in staging, compare outputs. If divergence, fix the new path. Only flip the flag in prod after N consecutive matches (N≥100 games). Old path code is deleted one release later.

---

### PHASE 5 — Timer Unification

**Objective:** Single authoritative `TimerService`. End 4-owner split. Fix R18 dual-timer race. Absorb reconnect timer restoration (D-12/D-17).

| Field | Value |
|-------|-------|
| **Risk** | HIGH (timeout winner determination affects match outcomes) |
| **Estimated effort** | Large |
| **Depends on** | Phase 4 (resolution unified) |
| **Blocks** | Phase 6 (GameShell needs authoritative timer) |

#### 4.5.1 Allowed Modules

| Module | Change |
|--------|--------|
| New: `features/shared/timerService.ts` | Authoritative clock with delta-sync for reconnect. Contains timeout-winner determination (captured-piece comparison). |
| M17 Game.tsx | Remove inline `tickMatchTimer`. Subscribe to TimerService events. |
| M18 DuelGame.tsx | Same — remove inline timer. |
| M15 OnlineGame | Remove inline `startMatchTimer`. Call TimerService. |
| M22 Timer | Merge `TeamTimer` + `MatchTimer` into TimerService consumers. |
| `gameConstants.ts` | Verify `DEFAULT_MOVE_TIMER_SECONDS` status. |

#### 4.5.2 Forbidden Modules

- No resolution changes (overlaps with Phase 4 territory).
- No audio/sound changes.
- No UI layout changes beyond timer wiring.

#### 4.5.3 Files Expected to Change

| File | Action | Max lines |
|------|--------|-----------|
| `src/features/shared/timerService.ts` | **Create** | +150 |
| `src/components/Game.tsx` | Remove timer logic; wire service | −80 |
| `src/components/DuelGame.tsx` | Remove timer logic; wire service | −40 |
| `src/features/online/game/onlineGame.ts` | Remove `startMatchTimer`; wire service | −60 |
| `src/lib/duelGame.ts` | Remove timer logic; wire service | −40 |
| `src/components/TeamTimer.tsx` | Wire to TimerService events | ~20 |
| `src/components/MatchTimer.tsx` | Wire to TimerService events | ~20 |

**Maximum files:** 10. **Maximum scope:** Timer logic only.

#### 4.5.4 Acceptance Criteria

1. One timer owner (`timerService.ts`).
2. Zero countdown logic in shells (grep for `setInterval`/`setTimeout` timer patterns in `components/Game.tsx` and `components/DuelGame.tsx`).
3. Phase 3 R18 dual-timer race test green.
4. Reconnect timer restoration verified (no drift after reconnect).
5. All four modes smoke-tested — timeout outcomes identical.

#### 4.5.5 Regression Checklist

| # | Check |
|---|-------|
| R1 | Match timer displays correct time in all modes |
| R2 | Timeout fires at 0 |
| R3 | Timeout winner determined correctly (captured-piece comparison) |
| R4 | Timer resumes correctly after reconnect |
| R5 | Duel 1v1 per-player clocks work |
| R6 | Phase 3 R18 test passes |

#### 4.5.6 Rollback Plan

Same dual-path strategy as Phase 4. Run old timer path alongside new `TimerService`. Compare timeout events and remaining-time snapshots. Flip the flag after N consecutive matches.

---

### PHASE 6 — Shared GameShell

**Objective:** Collapse Duel island (V10). Remove M17/M18 duplication with shared `GameShell` components.

| Field | Value |
|-------|-------|
| **Risk** | MEDIUM |
| **Estimated effort** | Large |
| **Depends on** | Phase 2 (dedup hooks) + Phase 5 (timer) |
| **Blocks** | Phase 7 (multiplayer touches both shells) |

#### 4.6.1 Allowed Modules

| Module | Change |
|--------|--------|
| M16 duelGame.ts | Move from `lib/` → `features/duel/DuelGameEngine.ts`. Add shared contract. |
| New: `components/GameShell.tsx` | Shared modal set, nav guard, back-button, promotion, board wiring. Parameterized by engine. |
| M17 Game.tsx | Shrink to thin wrapper composing GameShell. |
| M18 DuelGame.tsx | Shrink to thin wrapper composing GameShell. |

#### 4.6.2 Forbidden Modules

- No resolution/timer logic changes.
- No mode-specific game rule changes.
- No new features.

#### 4.6.3 Files Expected to Change

| File | Action | Max lines |
|------|--------|-----------|
| `src/features/duel/DuelGameEngine.ts` | **Create** (move from `lib/duelGame.ts`) | — (move) |
| `src/lib/duelGame.ts` | Redirect to new location | −475 |
| `src/components/GameShell.tsx` | **Create** | +300 |
| `src/components/Game.tsx` | Shrink to wrapper | −500 |
| `src/components/DuelGame.tsx` | Shrink to wrapper | −300 |

**Maximum files:** 8. **Maximum scope:** Shell layer only.

#### 4.6.4 Acceptance Criteria

1. `DuelGame.tsx` ≤ 200 lines (thin wrapper).
2. `Game.tsx` reduced by ≥ 400 lines.
3. No duplicated modal/nav/board wiring between shells.
4. Duel engine lives in `features/duel/` (not `lib/`).
5. Both modes smoke-tested — identical UX.

#### 4.6.5 Regression Checklist

| # | Check |
|---|-------|
| R1 | 2v2 game shell: all modals open/close correctly |
| R2 | Duel game shell: all modals open/close correctly |
| R3 | Navigation guard works in both modes |
| R4 | Back-button works in both modes |
| R5 | Promotion modal works in both modes |
| R6 | Confirm-move flow works in both modes |

#### 4.6.6 Rollback Plan

Incremental extraction — each shared component (modal set, nav guard, promotion) is its own PR. Revert any PR that causes a regression in either shell.

---

### PHASE 7 — Multiplayer Correctness

**Objective:** Harden realtime correctness: event versioning (R1 fix), lock timeout (R3 hang fix), reconnect merge (R2 fix). Enforce channel factory (BV22).

| Field | Value |
|-------|-------|
| **Risk** | HIGH (live multiplayer behavior) |
| **Estimated effort** | Medium |
| **Depends on** | Phases 4–5 (resolution + timer) |
| **Blocks** | Phase 8 (data layer after behavioral stability) |

#### 4.7.1 Allowed Modules

| Module | Change |
|--------|--------|
| M15 OnlineGame | Add sequence numbers to broadcasts. Add engine-level lock timeout. Versioned reconnect sync. |
| M28 Realtime | Enforce channel factory — route M16/M34 through subscriptionManager. |
| M16 duelGame.ts | Route channels through M28 factory. |

#### 4.7.2 Forbidden Modules

- No resolution/timer semantics changes.
- No new Realtime patterns — use existing `subscriptionManager` factory.

#### 4.7.3 Files Expected to Change

| File | Action |
|------|--------|
| `src/features/online/game/onlineGame.ts` | Sequence numbers, lock timeout, versioned sync |
| `src/lib/subscriptionManager.ts` | Enforce factory; add M16/M34 registration |
| `src/lib/duelGame.ts` (or `features/duel/`) | Use M28 factory for channels |
| `src/lib/messages.ts` | Use M28 factory for channels |

**Maximum files:** 6. **Maximum scope:** Broadcast layer + channel lifecycle.

#### 4.7.4 Acceptance Criteria

1. R1 regression test green (turn_resolved before player_locked is rejected).
2. Lock timeout bounded (waitForTeammateLock no longer hangs indefinitely).
3. Reconnect merge test green (syncGameState no longer overwrites fresher state).
4. All broadcast channels created through M28 factory.
5. Multiplayer 2v2 smoke with 2 real clients — no ordering anomalies.

#### 4.7.5 Regression Checklist

| # | Check |
|---|-------|
| R1 | Turn resolution order: player_move → player_locked → turn_resolved |
| R2 | Stale lock rejected |
| R3 | Reconnect does not lose in-flight moves |
| R4 | Chat channels use factory |
| R5 | Duel channels use factory |
| R6 | Phase 3 broadcast-ordering tests pass |

#### 4.7.6 Rollback Plan

**Feature flag** defaulting to legacy broadcast path for one release cycle. If ordering issues surface, flip back to legacy path without code revert. Version-bump the broadcast schema so old clients ignore new sequence fields (backward-compatible).

---

### PHASE 8 — Data Layer & Security

**Objective:** Close "Allow all" RLS holes. Regenerate `Database` types. Fix type drift.

| Field | Value |
|-------|-------|
| **Risk** | MEDIUM (anonymous Quick Play must not break) |
| **Estimated effort** | Medium |
| **Depends on** | Phase 7 (multipayer stable) |
| **Blocks** | Nothing |

#### 4.8.1 Allowed Modules

| Module | Change |
|--------|--------|
| M27 Supabase | Regenerate `Database` type from schema. Add `games`, `duel_games`, `message_type`. |
| Supabase RLS | Tighten `room_players` and `games` policies from allow-all → authenticated+participant. |
| Supabase schema | Run staged anonymous Quick Play regression suite before and after RLS change. |

#### 4.8.2 Forbidden Modules

- No game logic changes.
- No feature changes.
- Must NOT break anonymous Quick Play (P0 caveat).

#### 4.8.3 Files Expected to Change

| File | Action |
|------|--------|
| `src/lib/supabaseTypes.ts` | Regenerate from schema |
| `supabase/tables.sql` | Add RLS policies; comment old policies for instant re-apply |
| `src/lib/supabase.ts` | Update type references if needed |

**Maximum files:** 5. **Maximum scope:** DB schema + types only.

#### 4.8.4 Acceptance Criteria

1. No allow-all policies on `room_players` or `games`.
2. `Database` type includes `games`, `duel_games`, `message_type`.
3. Anonymous Quick Play regression suite green.
4. Existing multiplayer manual smoke passes.
5. `host_team` + `get_room_join_state` RPC contract intact.

#### 4.8.5 Regression Checklist

| # | Check |
|---|-------|
| R1 | Anonymous user can create a Quick Play game |
| R2 | Anonymous user can join a room by code |
| R3 | Authenticated user can create/join rooms |
| R4 | Room_players insert/update/delete works |
| R5 | Games insert works |
| R6 | Duel games insert works |

#### 4.8.6 Rollback Plan

RLS changes are the ONLY phase with a DB migration. Keep the old policies as commented SQL in the same migration file for instant re-apply. Run the anonymous Quick Play suite before AND after deployment. If it fails after, revert the policy and investigate.

---

### PHASE 9 — Observability & Cleanup

**Objective:** Structured logging, crash analytics, orphan removal.

| Field | Value |
|-------|-------|
| **Risk** | LOW |
| **Estimated effort** | Small–Medium |
| **Depends on** | Phases 1–7 (stable architecture) |
| **Blocks** | Nothing |

#### 4.9.1 Allowed Modules

| Module | Change |
|--------|--------|
| M29 API | Structured event log service. Rate limit `/api/log-crash`. |
| P5 §3.5 orphans | Remove Render server (`server/`), `BottomNav.tsx`, `TeamIndicator.tsx`, `_forceCreate`, `profiles.insights_reveals_used`, `ConfirmMoveButton.tsx`, `DEFAULT_MOVE_TIMER_SECONDS`. |

#### 4.9.2 Forbidden Modules

- No active feature removal.
- No evaluation pipeline changes.

#### 4.9.3 Files Expected to Change

| File | Action |
|------|--------|
| `src/lib/eventLog.ts` | **Create** |
| `src/app/api/log-crash/route.ts` | Add rate limiting |
| `server/` | DELETE (after traffic confirmation) |
| `src/components/BottomNav.tsx` | DELETE (verify zero importers) |
| `src/components/TeamIndicator.tsx` | DELETE (verify zero importers) |
| `src/features/online/game/onlineGame.ts` | Remove `_forceCreate` field |
| `src/components/ConfirmMoveButton.tsx` | DELETE (verify zero importers — already superseded by `ConfirmMoveBar`) |
| `src/features/shared/gameConstants.ts` | Remove `DEFAULT_MOVE_TIMER_SECONDS` if confirmed unused |

#### 4.9.4 Acceptance Criteria

1. Structured logs pipe to crash analytics endpoint.
2. `/api/log-crash` rate-limited.
3. Orphan list empty (verified by grep for each removed symbol).
4. Server deployment confirmed zero traffic → decommissioned.
5. All imports check out (`tsc --noEmit` green).
6. Architecture health score ≥ 70/100 (final measurement).

---

## 5. TESTING STRATEGY

### 5.1 Per-phase test matrix

| Phase | Unit | Integration | Realtime (mock) | Multiplayer (live) | APK | Manual 4-mode |
|-------|------|-------------|-----------------|---------------------|-----|---------------|
| 1 | ✅ | — | — | — | — | ✅ |
| 2 | ✅ | — | — | — | — | ✅ |
| 3 | ✅ | ✅ | ✅ | — | — | — |
| 4 | ✅ (golden fixtures) | ✅ | ✅ (mock channels) | — | — | ✅ |
| 5 | ✅ (golden fixtures) | ✅ | — | — | — | ✅ |
| 6 | ✅ | ✅ | — | — | — | ✅ two shells |
| 7 | ✅ | ✅ | ✅ (mock) | ✅ (2 real clients) | — | cross-device |
| 8 | ✅ (anonymous suite) | — | — | ✅ (anonymous QP) | ✅ | cross-device |
| 9 | ✅ | — | — | — | — | — |

### 5.2 Golden fixtures standard

For Phases 4–5 (resolution + timer):
- Fixed FEN positions + move-sequence inputs.
- Expected `MoveComparison` output (all 20+ fields).
- Expected winner determination.
- Any refactor must reproduce outputs bit-for-bit.

### 5.3 Four-mode smoke matrix

Required after every phase:
1. **Online 2v2** — two real clients, full turn lifecycle, game-over trigger.
2. **Offline vs-bot** — one client, Quick Play, bot resolution, game-over save.
3. **Quick Play (anonymous)** — required after Phase 8 RLS changes.
4. **Duel 1v1** — one client vs opponent, engine + shell, game-over.

### 5.4 CI gates

- `npx tsc --noEmit` — must pass (zero errors).
- `npm test` — must pass (zero failures).
- `npm run lint` — no new warnings.

---

## 6. GIT WORKFLOW

### 6.1 Branch naming

```
architecture-refactor/phase-1/auth-layering
architecture-refactor/phase-1/settings-split
architecture-refactor/phase-1/shared-types
architecture-refactor/phase-1/room-consolidate
architecture-refactor/phase-1/profile-service
architecture-refactor/phase-1/friends-consolidate
architecture-refactor/phase-2/audio-init-hook
architecture-refactor/phase-2/game-sounds-hook
architecture-refactor/phase-2/gameover-save-hook
architecture-refactor/phase-3/test-backfill-gameState
architecture-refactor/phase-3/test-backfill-onlineGame
...
architecture-refactor/phase-9/cleanup
```

### 6.2 Commit strategy

| Rule | Detail |
|------|--------|
| **Commit size** | ≤ 3 non-doc files per commit. CONTEXT.md updates count as 1 doc file. |
| **Commit message** | Conventional commits: `refactor(auth): move AuthGate to components/ (BV1)` |
| **No mixed commits** | Never mix refactoring with feature work, bug fixes, or test writing (except Phase 3). |
| **Docs with code** | Every commit that changes source MUST either update a CONTEXT.md or add a follow-up task. |
| **Separate test PRs** | In Phase 3, each un-skip or new test file is its own PR. |

### 6.3 Merge strategy

1. Feature branch off `architecture-refactor`.
2. Squash-merge to `architecture-refactor` after review.
3. When `architecture-refactor` is stable (a phase passes all gates), merge to `develop`.
4. `develop` → `prod` after manual 4-mode smoke.

### 6.4 Deployment strategy

- **Phase 1–3:** Single deployment to staging. Verify 4-mode smoke. Deploy to prod.
- **Phase 4–5:** Deploy behind feature flag. Dual-path comparison in staging for ≥ 100 games. Flip flag in prod. One release later, remove old path.
- **Phase 6–7:** Gradual deployment — each shared component PR deploys independently.
- **Phase 8:** Staging deployment. Run anonymous suite before AND after RLS change. Deploy to prod only if suite is green in both environments.
- **Phase 9:** Single deployment. No flag needed.

### 6.5 Review checklist (per PR)

- [ ] `tsc --noEmit` passes.
- [ ] `npm test` passes.
- [ ] No new skipped tests.
- [ ] Relevant CONTEXT.md updated.
- [ ] No behavior changes (verified by golden fixture or manual smoke).
- [ ] No new imports from wrong layer (`lib/` importing React, `features/` importing components).
- [ ] Touch targets ≥ 44×44px if UI changed.
- [ ] Font sizes ≥ 11px if UI changed.
- [ ] `dark:` variants present if UI changed.

---

## 7. AI IMPLEMENTATION RULES

These rules govern ALL AI-assisted implementation in ChessDuo. They are permanent and binding.

### RULE 1 — Single Module Only
**Never modify multiple high-risk modules together.** Each AI session refactors exactly ONE module. If a change requires touching another module, explain exactly why before making the change.

### RULE 2 — No Feature + Refactor Mixing
**Never mix feature work with refactoring.** An AI session is EITHER a refactoring session OR a feature session. Never both. The constitution scope must be stated at the start.

### RULE 3 — No Bug Fix + Architecture Mixing
**Never mix bug fixes with architecture work.** If a bug is discovered during refactoring, document it, file it separately, and continue with the refactoring. Do not fix it inline.

### RULE 4 — Preserve Behavior
**Every implementation must preserve behavior.** No user-visible changes unless explicitly documented and approved in a separate feature/bugfix session. If a refactor requires a behavioral change (e.g., fixing a latent bug exposed by the refactor), stop and ask.

### RULE 5 — Update CONTEXT.md
**Every implementation must update the relevant context.md.** After modifying any module, add a Recent Changes entry to that module's CONTEXT.md. If the module has no CONTEXT.md, assess whether one should be created.

### RULE 6 — Update Architecture Docs
**Every architecture change must update architecture docs.** If a module's boundary, ownership, or interface changes, update the relevant `docs/revamp/architecture/*.md` file. Check off resolved debt register entries in `05_ARCHITECTURAL_REVIEW.md`.

### RULE 7 — Include Validation
**Every implementation must include validation.** After every change: run `tsc --noEmit`, `npm test`, and the relevant manual smoke test. Report results.

### RULE 8 — Include Regression Testing
**Every implementation must include regression testing.** Before and after: golden fixtures for resolution/timer work, manual 4-mode smoke for UI changes, cross-device multiplayer for realtime changes.

### RULE 9 — Read Before Write
**Read every relevant file before editing.** Read the module's CONTEXT.md, its architecture doc sections (P2 §3, P3, P4, P5), and all files in the change set before making any edit.

### RULE 10 — Strangler Fig Only
**Prefer extraction over rewriting.** Never rewrite a module wholesale. Extract logic into new hooks/services while the old module shrinks incrementally. Delete the old path only after the new path is proven identical.

### RULE 11 — Feature Flags for High-Risk Phases
**Feature flags are mandatory for Phases 4, 5, and 7.** Run both old and new implementations in parallel. Compare outputs. Flip flag only after parity is proven (N≥100 consecutive matches for resolution/timer).

### RULE 12 — No New Abstractions
**Do not introduce new abstractions unless necessary.** The architecture already defines the module boundaries. Do not create new layers, patterns, or frameworks during refactoring.

### RULE 13 — Check the Architecture Path
**The authoritative architecture docs live in `docs/revamp/architecture/`.** The constitution may reference `docs/architecture/` — always translate to `docs/revamp/architecture/`. This is a path alias discrepancy in the constitution template, not a bug.

### RULE 14 — Stop After Each Module
**Do not continue to another module after completing one.** After each module is stabilized, stop and present the results. Wait for the next instruction.

### RULE 15 — Delete-account Flow Excluded
**The delete-account flow is excluded from all architecture phases.** Do not refactor, analyze, or modify anything related to account deletion. This was an explicit user mandate from Phase 1.

---

## 8. REVIEW CHECKLIST

### 8.1 Per-phase pre-implementation review

- [ ] Architecture docs re-read: P2 §3 module spec, P3 state ownership, P4 events, P5 violations (relevant sections only — not the full documents).
- [ ] CONTEXT.md for the target module read.
- [ ] All source files in the change set read.
- [ ] All importers identified via grep.
- [ ] Test suite for the affected module located.
- [ ] Golden fixtures prepared (if Phases 4–5).
- [ ] Feature flag named and scoped (if Phases 4/5/7).

### 8.2 Per-PR review

- [ ] `tsc --noEmit` passes.
- [ ] `npm test` passes.
- [ ] No new skipped tests.
- [ ] No new layer violations (grep for React in `features/`/`lib/`).
- [ ] No new type inversions (grep for `components/` in `lib/`, etc.).
- [ ] CONTEXT.md updated.
- [ ] Debt register entry checked off in `05_ARCHITECTURAL_REVIEW.md` (if resolved).

### 8.3 Per-phase completion review

- [ ] All acceptance criteria for the phase met.
- [ ] Regression checklist items all verified.
- [ ] Four-mode smoke tested.
- [ ] Phase exit criteria from `06_REFACTORING_ROADMAP.md` §4 verified.
- [ ] Architecture compliance score re-measured (update `07_ARCHITECTURE_STABILIZATION_REPORT.md`).

---

## 9. DEFINITION OF DONE

A phase is **done** when ALL of the following are true:

1. **Code:** All steps in the phase are implemented. `tsc --noEmit` and `npm test` pass.
2. **Behavior:** No user-visible changes. Four-mode smoke matrix passes. Golden fixtures match (Phases 4–5).
3. **Boundaries:** Layer violations resolved for all modules in the phase. No new violations introduced.
4. **State:** State ownership improved per the phase's plan. No new split-ownership states.
5. **Docs:** Relevant CONTEXT.md files updated. Debt register entries checked off. Architecture docs reflect the current state.
6. **Regression:** Regression checklist all verified. No skipped tests for the affected modules.
7. **Review:** PR reviewed against the roadmap checklist (§8).
8. **Deployability:** The app is deployable to production (feature flags gated for Phases 4/5/7).

---

## 10. FUTURE MAINTENANCE GUIDELINES

1. **Before any new feature:** Read the relevant module spec in `02_MODULE_ARCHITECTURE.md`. Verify the feature fits within the documented boundary. If it crosses a boundary, update the architecture docs FIRST.
2. **Before modifying a god object (M17/M15):** Check the `06_REFACTORING_ROADMAP.md` — the module may already be scheduled for decomposition. Extract rather than add.
3. **Before adding a new module:** Add it to `02_MODULE_ARCHITECTURE.md` (next available M-number), define its state in `03_STATE_OWNERSHIP.md`, and document its events in `04_EVENT_FLOW.md`. Create a CONTEXT.md.
4. **Before adding a new method to GameInterface:** Add to `features/shared/GameInterface.ts`, implement in BOTH `onlineGame.ts` AND `localGame.ts`, and use in `Game.tsx` typed as `GameInterface`.
5. **After any architecture change:** Re-run the health score rubric (P5 §2). Track the score in the `07_ARCHITECTURE_STABILIZATION_REPORT.md`.
6. **CONTEXT.md discipline:** Every source file belongs to exactly one module. Every module has a CONTEXT.md. Every change to a module adds a Recent Changes entry.
7. **Test discipline:** New behavior = new test. Skipped tests = filed bug. Zero skipped core-suite blocks is the steady-state target.
8. **Layer discipline:** `features/` = framework-free. `lib/` = framework-free utilities + services. `hooks/` = React hooks. `components/` = React components. `app/` = Next.js pages. No exceptions.
9. **RLS discipline:** Never add "allow all" policies. Always stage anonymous-play regression tests before deploying RLS changes to production.

---

### Phase 8 Complete

This document is **documentation only**. No implementation was modified.

**This is now the permanent engineering playbook for ChessDuo.** All future architecture work — whether AI-assisted or human — must follow the phase boundaries, testing strategy, git workflow, and AI implementation rules defined herein.

**Next step:** Await implementation approval. Phase 1 (Layering & Structural Quick Wins) is ready to begin. M01 Auth (BV1/BV2) is the first module to stabilize.
