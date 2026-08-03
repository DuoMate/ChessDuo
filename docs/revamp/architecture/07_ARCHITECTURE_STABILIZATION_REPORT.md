# CHESSDUO — PHASE 6: ARCHITECTURE STABILIZATION REPORT

> **Engineering roadmap deliverable.** Module-by-module assessment against the authoritative architecture documents (P1–P6), with stabilization steps identified, compliance scores, and a catalogue of remaining work.
> This document is **documentation only** — no implementation changes were made.
> Pairs with: `06_REFACTORING_ROADMAP.md` (P5 Part 2), `05_ARCHITECTURAL_REVIEW.md` (P5 Part 1), `04_EVENT_FLOW.md` (P4), `03_STATE_OWNERSHIP.md` (P3), `02_MODULE_ARCHITECTURE.md` (P2), `01_REPOSITORY_DISCOVERY.md` (P1).

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Architecture Compliance Score](#2-architecture-compliance-score)
3. [Module Stabilization — Complete Assessment](#3-module-stabilization--complete-assessment)
4. [Boundary Enforcement — Current State](#4-boundary-enforcement--current-state)
5. [State Consolidation — Current State](#5-state-consolidation--current-state)
6. [Dependency Cleanup — Current State](#6-dependency-cleanup--current-state)
7. [Documentation Synchronization](#7-documentation-synchronization)
8. [Unstabilized Modules — Future Work Required](#8-unstabilized-modules--future-work-required)
9. [Stabilization Plan Summary](#9-stabilization-plan-summary)
10. [Appendix](#10-appendix)

---

## 1. EXECUTIVE SUMMARY

Phase 6 is the **first implementation phase** of the ChessDuo Engineering Constitution — the transition point from architecture documentation (Phases 1–5) to code-level stabilization. This report assesses all 35 modules (M01–M35) against the now-authoritative architecture documents, identifies gaps between documentation and implementation, and defines the stabilization steps necessary to close them.

**The actual code changes are NOT performed in this report.** This document serves as the stabilization blueprint: a module-by-module gap analysis with concrete steps, estimated effort, and risk categorization. Implementation occurs per the user's direction in a subsequent phase.

### Key findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | **Layer violations exist and are mechanical to fix** — `features/auth/AuthGate.tsx` (BV1), `features/auth/useAuthSession.ts` (BV2), `lib/settings.ts` useSettings hook (BV3), `lib/duelGame.ts` `'use client'` (BV4) | HIGH |
| 2 | **Shared types live in wrong modules** — `GameStatus`/`MoveComparison` in `localGame.ts`, `PromotionPiece` in `components/ChessBoard.tsx`, imported by `GameInterface`/`chessUtils` (BV5, S4) | MEDIUM |
| 3 | **Hardcoded magic numbers** — `Game.tsx` and `DuelGame.tsx` use `600` instead of `DEFAULT_TEAM_TIMER_SECONDS` from `gameConstants.ts` (documented but not enforced) | MEDIUM |
| 4 | **17 of 33 CONTEXT.md files are out of date** — some missing Recent Changes entirely, others contain stale data (MultiPV=2 not 6, SvelteKit template remnants, "Spinner" instead of "PageLoading") | MEDIUM |
| 5 | **`server/` module documented as active but likely orphaned** — `SERVER_URL` removed from all engines; evaluation is always local WASM via Stockfish (P5 §3.5) | MEDIUM |
| 6 | **Game.tsx has 2,477 lines with 2 inline components** (`CapturedPiecesDisplay`, `PromotionModal`) that should be standalone files per architecture conventions | MEDIUM |
| 7 | **Remaining `as any` cast in `Game.tsx`** — `(evaluator as any).getInitError()` on the Stockfish evaluator | LOW |
| 8 | **No behavior changes identified that would break user-visible functionality** — all stabilization steps are mechanical moves, constant substitutions, or documentation sync | — |

### What is already compliant and needs no change

- **M12 GameState**: framework-free, clean architecture, no violations detected.
- **M23 Stockfish**: well-isolated, proper factory pattern, comprehensive tests.
- **M27 Supabase Client**: proper singleton, well-typed (minor `Database` type gaps deferred to Phase G).
- **M29 API Infra**: per-route handlers well-separated, rate limiting in place.
- **M30 Billing**: mature state machine, provider-agnostic, comprehensive tests.
- **M32 Push**: well-hardened after bug sweeps, detailed CONTEXT.md.
- **M06/M07/M08/M09/M10/M11**: room/lobby/matchmaking modules structurally sound.
- **M24 Bot**: well-structured with opening books and difficulty tiers (note: `console.log` volume tracked but accepted per architecture).

---

## 2. ARCHITECTURE COMPLIANCE SCORE

### 2.1 Current score (pre-stabilization) — based on P5 §2 rubric

| Dimension | P5 Score | Current | Justification |
|-----------|----------|---------|---------------|
| Layer separation | 45 | 45 | BV1–BV5 still present; `features/auth/` React, `lib/settings.ts` hook, `lib/duelGame.ts` engine |
| Interface contracts | 75 | 75 | GameInterface strong; M16 island still lacks shared contract |
| Single ownership | 30 | 30 | Timer/resolution/status still split; no consolidation performed |
| Dependency direction | 50 | 50 | `chessUtils`→components inversion, `GameInterface`→`localGame` type imports |
| Testability | 30 | 30 | Game.tsx/DuelGame.tsx/duelGame.ts zero tests; ~1,950 skipped lines |
| Event-driven design | 55 | 55 | Coordinator pattern good; ordering assumptions fragile |
| Error handling | 50 | 50 | Toast + documented catches; no structured logging |
| Configuration management | 70 | 70 | Env vars defined; settings localStorage-only |
| Documentation | 60 | 60 | 5 DOC inconsistencies documented, 17 CONTEXT.md files stale |
| Modularity | 35 | 35 | God objects confirmed; inline components not extracted |
| **Overall** | **42** | **42** | No deterioration since P5; no improvements yet either |

### 2.2 Target score (post-stabilization)

| Dimension | Current | Target | Delta | Achieved by |
|-----------|---------|--------|-------|-------------|
| Layer separation | 45 | 55 | +10 | Fix BV1–BV4: move auth components/hooks, split settings |
| Interface contracts | 75 | 78 | +3 | Move shared types to `features/shared/`; fix type inversions |
| Single ownership | 30 | 30 | 0 | Not addressed in this phase (deferred to Phases C/D) |
| Dependency direction | 50 | 55 | +5 | Fix BV5: remove `chessUtils→components` and `GameInterface→localGame` type imports |
| Testability | 30 | 30 | 0 | Not addressed in this phase (deferred to Phase H) |
| Event-driven design | 55 | 55 | 0 | Not addressed in this phase |
| Error handling | 50 | 52 | +2 | Remove `as any` cast; minor type hardening |
| Configuration management | 70 | 72 | +2 | Replace hardcoded `600` with `DEFAULT_TEAM_TIMER_SECONDS` |
| Documentation | 60 | 70 | +10 | Fix 17 CONTEXT.md files; resolve DOC-01–05 |
| Modularity | 35 | 40 | +5 | Extract 2 inline components from Game.tsx |
| **Overall** | **42** | **~50** | **+8** | |

**Note:** The +8 point improvement is conservative — it reflects only mechanical, zero-risk changes. The larger gains (resolution unification, timer SSOT, test backfill) are in the Phase C–I roadmap and would collectively lift the score to ≥70/100 at project completion (§8 acceptance criteria).

---

## 3. MODULE STABILIZATION — COMPLETE ASSESSMENT

Each module is assessed against: P2 (`02_MODULE_ARCHITECTURE.md`) module spec, P3 state ownership, P4 event flow, P5 boundary violations, and the actual source implementation.

---

### M01 — Authentication

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/authService.ts` (14), `src/lib/supabaseAuthUtils.ts` (233), `src/lib/capacitorAuth.ts` (111), `src/components/Auth.tsx` (488), `src/components/AuthGate.tsx` (6), `src/features/auth/AuthGate.tsx` (173), `src/features/auth/useAuthSession.ts` (136), `src/middleware.ts` (44) |
| **Architecture compliance** | Partially compliant |
| **Reason** | BV1: `features/auth/AuthGate.tsx` imports React — React components must live in `components/`. BV2: `features/auth/useAuthSession.ts` imports `useState`/`useEffect`/`useRef` — React hooks must live in `hooks/`. |
| **Violations to resolve** | BV1 (HIGH), BV2 (HIGH), BV14 (MEDIUM — auth state machine in `Auth.tsx`; deferred) |
| **Stabilization steps** | 1. Move `src/features/auth/AuthGate.tsx` → `src/components/AuthGate.tsx` (replacing the thin 6-line wrapper). 2. Move `src/features/auth/useAuthSession.ts` → `src/hooks/useAuthSession.ts`. 3. Update all importers in one PR. |
| **Behavior change** | None |
| **Estimated effort** | Small (mechanical move + import path updates) |
| **Risk** | LOW — verify all importers via grep before moving; rely on `tsc --noEmit` |

---

### M02 — User Profile

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/ProfilePanel.tsx` (252), `src/components/ProfileEditor.tsx` (214), `src/lib/profileService.ts` (37), `src/components/InitialsAvatar.tsx` (58), `src/features/shared/avatars.ts` (17) |
| **Architecture compliance** | Compliant in structure; BV6 deferred |
| **Reason** | Direct `profiles` reads in 12+ UI call sites (BV6 — HIGH; P5 §5.2). The `profileService.ts` exists but is inconsistently used. |
| **Violations to resolve** | BV6 (HIGH — deferred to Phase A step 5: ProfileService adoption needs broader sweep) |
| **Stabilization steps** | Phase 6 scope: none. Full adoption deferred to Phase A step 5 of the refactoring roadmap. |
| **Behavior change** | N/A |
| **Estimated effort** | N/A for this phase |

---

### M03 — Settings

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/SettingsPanel.tsx` (180), `src/lib/settings.ts` (118), `src/components/ConfigurationPanel.tsx` (160), `src/lib/sounds.ts` (329) |
| **Architecture compliance** | Partially compliant |
| **Reason** | BV3 (HIGH): `lib/settings.ts` exports `useSettings()` React hook — `lib/` must be framework-free (P5 refactoring principle #6). S1 (MEDIUM): hook couples pure localStorage utilities to React. DOC-04: "Supabase sync" documented but not implemented. |
| **Violations to resolve** | BV3 (HIGH), S1 (MEDIUM) |
| **Stabilization steps** | 1. Rename `lib/settings.ts` → `lib/settingsStorage.ts` (pure localStorage utilities only). 2. Extract `useSettings()` hook → `src/hooks/useSettings.ts` with `'use client'` directive. 3. Update importers (`Game.tsx`, `DuelGame.tsx`, layout) in the same PR. |
| **Behavior change** | None |
| **Estimated effort** | Small (split one file into two; update import paths) |
| **Risk** | LOW — mechanical split; no logic change |

---

### M04 — Browser Routing

| Field | Detail |
|-------|--------|
| **Source files** | `src/app/layout.tsx` (88), `src/app/providers.tsx` (88), `src/app/page.tsx` (1,564), `src/middleware.ts` (44), route pages |
| **Architecture compliance** | Partially compliant |
| **Reason** | P5 identified `home page.tsx` (1,564 lines) as a "god page" — marketing + session + room auto-join + matchmaking in one file (P5 §4.4). `premium/page.tsx` is 522 lines with business logic inline. These are structural issues deferred to the refactoring roadmap (Phase A step 7 + Phase E split). Not a boundary violation that can be mechanically fixed. |
| **Violations to resolve** | God-page architecture (S-03, HIGH — deferred to Phase E) |
| **Stabilization steps** | Phase 6 scope: fix DOC-03 — `ARCHITECTURE.md` references legacy `src/proxy.ts`; actual file is `src/middleware.ts` (per P2, verified). |
| **Behavior change** | N/A |
| **Estimated effort** | Small (doc-only for this phase) |

---

### M05 — Mobile Navigation

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/HomeBottomNav.tsx` (95), `src/components/BottomNav.tsx` (92), `src/components/DesktopSidebar.tsx` (112), `src/components/SidebarNav.tsx` (85), `src/components/BoardBottomNav.tsx` (102), `src/components/MobileStatusBar.tsx` (75), `src/components/BackButton.tsx` (42), `src/hooks/useIsMobile.ts` (25) |
| **Architecture compliance** | Compliant |
| **Reason** | No violations detected. `BottomNav.tsx` documented as legacy (superseded by `HomeBottomNav`); P5 §3.5 identifies `TeamIndicator.tsx` as legacy (replaced by `BoardTopBar`). Both are tracked as known orphans, not violations. |
| **Violations to resolve** | None |
| **Stabilization steps** | None |

---

### M06 — Capacitor Bridge

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/capacitorAuth.ts` (111), `src/lib/capgo-stub.ts` (10), `src/hooks/useCapacitorBackButton.ts` (45) |
| **Architecture compliance** | Compliant |
| **Reason** | BV19 (LOW-MEDIUM): Deep-link URL translation in `capacitorAuth.ts` rather than M07. Documented but deferred as it's low-priority and cross-module. |
| **Violations to resolve** | BV19 (deferred) |
| **Stabilization steps** | None for Phase 6 |

---

### M07 — Deep Linking

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/challenges.ts` (111), `src/lib/share.ts` (58), `src/lib/appUrl.ts` (8), `src/lib/notificationRedirect.ts` (69), `src/app/challenge/[code]/page.tsx` (9), `src/app/invite/[userId]/page.tsx` (9) |
| **Architecture compliance** | Compliant |
| **Reason** | H4 (MEDIUM): `.well-known/` deploy sync dependency. H10 (MEDIUM): challenge page queries `rooms` directly. Both documented, deferred to Phase F/G. Skeleton pages (9 lines each) are thin wrappers but lack explicit loading/error states — minor ARCH rule gap. |
| **Violations to resolve** | H10 (deferred); skeleton pages (LOW) |
| **Stabilization steps** | None for Phase 6 (deferred) |

---

### M08 — Room Management

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/roomActions.ts` (66), `src/lib/roomService.ts` (35), `src/components/Room.tsx` (265) |
| **Architecture compliance** | Partially compliant |
| **Reason** | D7 (MEDIUM): 3 room-creation paths — `roomActions.ts`, `matchmaking.ts`, `fourPlayerActions.ts`. V8 (MEDIUM): `ROOM_EXPIRY_MS` duplicated (24h vs 60s). H3 (MEDIUM): `host_team` + `get_room_join_state` RPC contract is a hidden dependency. All documented, deferred. |
| **Violations to resolve** | D7, V8, H3 (all MEDIUM — deferred to Phase A step 4) |
| **Stabilization steps** | None for Phase 6 |

---

### M09 — Matchmaking

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/matchmaking.ts` (147), `src/components/MatchmakingQueue.tsx` (204) |
| **Architecture compliance** | Compliant |
| **Reason** | O(n) room scan documented as known scalability limitation (P1 §15). Not a violation for current scale. |
| **Violations to resolve** | None (scalability note only) |
| **Stabilization steps** | None |

---

### M10 — 4-Player Lobby

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/fourPlayerActions.ts` (251), `src/components/FourPlayerLobby.tsx` (498) |
| **Architecture compliance** | Compliant |
| **Reason** | No violations detected. Share button native sheet changes (Bug 35/37) applied correctly. |
| **Violations to resolve** | None |
| **Stabilization steps** | None |

---

### M11 — Lobby UI

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/GameLobby.tsx` (299), `src/components/GameLoading.tsx` (143), `src/components/ChallengePicker.tsx` (133) |
| **Architecture compliance** | Compliant |
| **Reason** | No violations detected. |
| **Violations to resolve** | None |
| **Stabilization steps** | None |

---

### M12 — Game Engine (Core)

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/game-engine/gameState.ts` (352), `src/lib/pendingAction.ts` (59) |
| **Architecture compliance** | Fully compliant |
| **Reason** | Framework-free, well-typed, single responsibility, clean public API. Entire test suite is skipped (T-03, HIGH) — this is a test gap (deferred to Phase H), not a violation of the module's architecture. |
| **Violations to resolve** | T-03 (HIGH — deferred to Phase H) |
| **Stabilization steps** | None |

---

### M13 — Shared Game Interface & Constants

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/shared/GameInterface.ts` (64), `src/features/shared/gameConstants.ts` (28), `src/features/shared/accuracy.ts` (33), `src/features/shared/evaluationCache.ts` (61), `src/lib/chessUtils.ts` (41) |
| **Architecture compliance** | Partially compliant |
| **Reason** | S4 (MEDIUM): `GameInterface.ts` imports `GameStatus`/`MoveComparison` from `features/offline/game/localGame.ts` — the shared contract depends on one implementation's types. BV5 (MEDIUM): `lib/chessUtils.ts` imports `PromotionPiece` from `components/ChessBoard.tsx` — data layer depends on presentation layer. `DEFAULT_TEAM_TIMER_SECONDS` exists in `gameConstants.ts` but is not consistently imported by consumers (M17/M18). |
| **Violations to resolve** | S4 (MEDIUM), BV5 (MEDIUM) |
| **Stabilization steps** | 1. Move `GameStatus`, `MoveComparison` from `localGame.ts` → `features/shared/gameTypes.ts`. 2. Move `PromotionPiece` from `components/ChessBoard.tsx` → `features/shared/gameTypes.ts`. 3. Update all importers (`GameInterface.ts`, `onlineGame.ts`, `chessUtils.ts`, `components/*`) in one PR. |
| **Behavior change** | None |
| **Estimated effort** | Small (extract types, update import paths) |
| **Risk** | LOW — types-only move; `tsc --noEmit` ensures safety |

---

### M14 — LocalGame (Offline Engine)

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/offline/game/localGame.ts` (753) |
| **Architecture compliance** | Partially compliant |
| **Reason** | D1 (CRITICAL): `resolveLegacy` (~170 lines) fully duplicates `resolvePendingMoves`. D2 (HIGH): checkmate short-circuit duplicated. D3 (HIGH): MoveComparison construction duplicated. All deferred to Phase C — this is the core resolution work, not a mechanical fix. |
| **Violations to resolve** | D1, D2, D3, D6, D9 (CRITICAL/HIGH — all deferred to Phase C) |
| **Stabilization steps** | None for Phase 6 |

---

### M15 — OnlineGame (Online Engine)

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/online/game/onlineGame.ts` (1,678) |
| **Architecture compliance** | Partially compliant |
| **Reason** | God object (1,678 lines). S-02 (HIGH). D2/D3/D4/D9/D12/D13/D17 duplicated logic. H2: alphabetical coordinator election. All structural — deferred to Phase C/D/F. |
| **Violations to resolve** | S-02, D2–D4, D9, D12, D13, D17, H2 (all deferred) |
| **Stabilization steps** | None for Phase 6 |

---

### M16 — Duel Game Engine

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/duelGame.ts` (475) |
| **Architecture compliance** | Partially compliant |
| **Reason** | BV4 (LOW-MEDIUM): Full game engine with `'use client'` directive lives in `lib/`. Should be in `features/duel/`. H9 (MEDIUM): `'use client'` makes it browser-only from lib/. No shared contract — island architecture (V10). Zero tests (T-02, CRITICAL). Presence scheme diverges from M28 (BV22). D4/D17/D23 duplicates timer/reconnect logic. All deferred to Phases D/E/F. |
| **Violations to resolve** | BV4, H9, V10, T-02, BV22, D4, D17, D23 (all deferred) |
| **Stabilization steps** | None for Phase 6 |

---

### M17 — Game Shell (2v2)

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/Game.tsx` (2,477) |
| **Architecture compliance** | Not compliant |
| **Reason** | S-01 (CRITICAL): God object — 2,477 lines, 49 imports, 28+ useState, 16+ useRef, 14+ useEffect. Multiple violations within the file: inline `CapturedPiecesDisplay` defined at line ~110 should be a standalone component; inline `PromotionModal` defined at line ~137 should be a standalone component; hardcoded `600` (lines ~247, ~2150) instead of `DEFAULT_TEAM_TIMER_SECONDS`; one remaining `as any` cast `(evaluator as any).getInitError()`; inline `style={{}}` for static values. BV6: direct `profiles` read (HIGH). BV11: bot turn continuation in UI (HIGH). BV12: timeout logic in UI (HIGH). BV13/BV15/BV16/BV17/BV23/BV24/BV25: multiple boundary violations. T-01: zero tests (CRITICAL). |
| **Violations to resolve** | *Phase 6 scope*: magic numbers, `as any`, inline components. *Deferred*: everything else. |
| **Stabilization steps (Phase 6)** | 1. Replace hardcoded `600` with `DEFAULT_TEAM_TIMER_SECONDS` import from `gameConstants.ts` (2 locations). 2. Fix `(evaluator as any).getInitError()` — add proper typing for the evaluator init error. 3. Extract `CapturedPiecesDisplay` and `PromotionModal` from inline definitions to `src/components/CapturedPiecesDisplay.tsx` and `src/components/PromotionModal.tsx`. |
| **Behavior change** | None |
| **Estimated effort** | Small–Medium (constants: trivial; as any: trivial; inline extraction: moderate — verify all ref closures) |
| **Risk** | LOW for constants + type fix. MEDIUM for inline extraction — verify no closure over private state that would change behavior. |

---

### M18 — Duel Shell

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/DuelGame.tsx` (634) |
| **Architecture compliance** | Partially compliant |
| **Reason** | Siblings with M17 — many of the same structural issues at smaller scale. Hardcoded `600` (lines ~443, ~487) instead of `DEFAULT_TEAM_TIMER_SECONDS`. BV6: direct `profiles` read. BV13/BV15/BV16/duplicates sound/game-over logic. Zero tests (T-02, CRITICAL — same gap as M16). |
| **Violations to resolve** | *Phase 6 scope*: magic numbers. *Deferred*: remaining violations (test gaps, dedup, direct reads). |
| **Stabilization steps (Phase 6)** | Replace hardcoded `600` with `DEFAULT_TEAM_TIMER_SECONDS` from `gameConstants.ts` (2 locations). |
| **Behavior change** | None |
| **Estimated effort** | Trivial |
| **Risk** | LOW |

---

### M19 — ChessBoard

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/ChessBoard.tsx` (518), `src/components/MobileChessBoard.tsx` (23) |
| **Architecture compliance** | Compliant |
| **Reason** | BV23 (LOW-MEDIUM): `boardKey` remount used to cancel moves — documented, deferred. `style={{}}` in 8+ places — some are dynamic (acceptable), some appear static (should be Tailwind). ARCH.md mentions `CapturedPieces.tsx` as a component; actual code has `CapturedPiecesDisplay` inline in `Game.tsx` (extraction planned for M17). |
| **Violations to resolve** | BV23 (deferred); static style cleanup (LOW) |
| **Stabilization steps** | None for Phase 6 (BV23 deferred; style cleanup is cosmetic) |

---

### M20 — Move Resolution

| Field | Detail |
|-------|--------|
| **Source files** | Cross-cutting — `GameOverModal.tsx` (93), `MoveResolvedInline.tsx` (243), `MoveComparison.tsx` (216), `MoveInsights.tsx` (130), `ResignConfirmModal.tsx` (57), `LeaveConfirmModal.tsx` (65) |
| **Architecture compliance** | Partially compliant |
| **Reason** | No owner module (V3, CRITICAL). 4 implementations across M14/M15/M16/M17. D1–D3 duplications. Component name mismatch: `02_MODULE_ARCHITECTURE.md` §3 lists `MoveResolvedCard.tsx` and `ConfirmMoveButton.tsx`; actual files are `MoveResolvedInline.tsx` and `ConfirmMoveBar.tsx`. *P2 doc drift — needs update.* |
| **Violations to resolve** | V3, D1–D3 (CRITICAL/HIGH — deferred to Phase C). Component name mismatch (doc update). |
| **Stabilization steps** | Update `02_MODULE_ARCHITECTURE.md` §3 M20: rename `MoveResolvedCard` → `MoveResolvedInline`, `ConfirmMoveButton` → `ConfirmMoveBar`. |
| **Behavior change** | None (doc-only) |
| **Estimated effort** | Trivial |
| **Risk** | NONE |

---

### M21 — Turn Management

| Field | Detail |
|-------|--------|
| **Source files** | `TurnStatusArea.tsx` (171), `PendingMovesRow.tsx` (115), `BoardBottomNav.tsx` (102), `BoardTopBar.tsx` (266), `ConfirmMoveBar.tsx` (53), `GameMenu.tsx` (105) |
| **Architecture compliance** | Compliant |
| **Reason** | No violations detected. |
| **Violations to resolve** | None |
| **Stabilization steps** | None |

---

### M22 — Timer

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/TeamTimer.tsx` (93), `src/components/MatchTimer.tsx` (65) |
| **Architecture compliance** | Partially compliant |
| **Reason** | V1 (HIGH): 4 owners (M12/M15/M17/M22) + M16 island. D4 (HIGH): timer countdown+timeout duplicated ×3. D19 (LOW-MEDIUM): circular timer SVG duplicated ×2 (`MatchTimer.tsx` + `TeamTimer.tsx`). R18 (MEDIUM): dual timer race. No `TeamTimer.test.tsx`. All deferred to Phase D. |
| **Violations to resolve** | V1, D4, D19, R18 (all deferred) |
| **Stabilization steps** | None for Phase 6 |

---

### M23 — Stockfish Evaluation

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/mobile-engine/BrowserMoveEvaluator.ts` (264), `src/features/mobile-engine/evaluatorFactory.ts` (16) |
| **Architecture compliance** | Fully compliant |
| **Reason** | Well-isolated singleton via factory. Comprehensive test coverage (BrowserMoveEvaluator, evaluatorFactory, benchmark, moveEvaluation, e2e). DOC-01: `src/features/bots/CONTEXT.md` says MultiPV=2; actual is 6 per the 2026-08-02 revert. Also `src/features/offline/game/CONTEXT.md` line 14. `src/features/mobile-engine/CONTEXT.md` body text describes the reverted (old) state. Documentation-only issue. |
| **Violations to resolve** | DOC-01 (LOW — doc staleness) |
| **Stabilization steps** | Update 3 CONTEXT.md files to reflect MultiPV=6, eager init, all-moves-in-results (per the 2026-08-02 revert). |
| **Behavior change** | None (doc-only) |
| **Estimated effort** | Trivial |

---

### M24 — Bot AI

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/bots/chessBot.ts` (514), `src/features/bots/botConfig.ts` (150), `src/features/bots/difficulty.ts` (82), `src/features/bots/openings.ts` (348), `src/components/BotEloSelector.tsx` (36) |
| **Architecture compliance** | Compliant |
| **Reason** | Well-structured. `console.log` volume (30+ calls behind `DEBUG &&`) is documented and accepted per architecture (chatter is gated debug, not shipping logs). DOC-01: MultiPV documented as 2 in `bots/CONTEXT.md` but actual is 6. |
| **Violations to resolve** | DOC-01 (doc-only) |
| **Stabilization steps** | Update `src/features/bots/CONTEXT.md` line 24: MultiPV=2 → MultiPV=6. |
| **Behavior change** | None (doc-only) |

---

### M25 — Move Playback

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/MovePlayback.tsx` (169), `src/components/ReplayView.tsx` (169), `src/components/RoundHistorySidebar.tsx` (131) |
| **Architecture compliance** | Compliant |
| **Reason** | No violations detected. |
| **Violations to resolve** | None |
| **Stabilization steps** | None |

---

### M26 — Game Persistence

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/gamePersistence.ts` (92), `src/lib/matchHistory.ts` (167) |
| **Architecture compliance** | Compliant |
| **Reason** | No direct violations. Missing standalone tests for `gamePersistence.ts` and `matchHistory.ts` — test gap, not an architecture violation (deferred to Phase H). |
| **Violations to resolve** | Test gaps (deferred to Phase H) |
| **Stabilization steps** | None |

---

### M27 — Supabase Client

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/supabase.ts` (232), `src/lib/supabaseTypes.ts` (20), `src/lib/supabaseAuthUtils.ts` (233), `src/lib/subscriptionManager.ts` (31) |
| **Architecture compliance** | Compliant |
| **Reason** | R-02 (MEDIUM): `games`, `duel_games`, `message_type` missing from `Database` type. R-05 (MEDIUM): hand-maintained type drift vs `tables.sql`. Both deferred to Phase G. |
| **Violations to resolve** | R-02, R-05 (deferred to Phase G) |
| **Stabilization steps** | None for Phase 6 |

---

### M28 — Realtime Layer

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/realtimeService.ts` (27), `src/lib/subscriptionManager.ts` (31) |
| **Architecture compliance** | Partially compliant |
| **Reason** | BV22 (MEDIUM): M16/M34 create channels directly, bypassing the M28 factory. Deferred to Phase F step 4. |
| **Violations to resolve** | BV22 (deferred to Phase F) |
| **Stabilization steps** | None for Phase 6 |

---

### M29 — API Infrastructure

| Field | Detail |
|-------|--------|
| **Source files** | 12 API route handlers + `src/lib/rateLimit.ts` (59), `src/lib/apiAuth.ts` (39) |
| **Architecture compliance** | Fully compliant |
| **Reason** | Per-isolate rate limiting is a known scalability constraint (R-03), not a violation. Structured logging/crash analytics missing — deferred to Phase I. |
| **Violations to resolve** | None (improvement deferred) |
| **Stabilization steps** | None |

---

### M30 — Premium Billing

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/billing/SubscriptionService.ts` (191), `SubscriptionStateMachine.ts` (41), `CreemBillingProvider.ts` (108), `types.ts` (63), `index.ts` (4) |
| **Architecture compliance** | Fully compliant |
| **Reason** | Mature state machine, provider-agnostic, comprehensive tests, detailed CONTEXT.md. |
| **Violations to resolve** | None |
| **Stabilization steps** | None |

---

### M31 — Insights

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/insights.ts` (64), `src/components/InsightsGate.tsx` (142), `src/components/AccuracyBottomSheet.tsx` (361), `src/components/MoveInsights.tsx` (130) |
| **Architecture compliance** | Partially compliant |
| **Reason** | BV7 (MEDIUM): `insights.ts` fallback queries `profiles.is_premium` directly, bypassing M30 `SubscriptionService`. S8 (LOW): `profiles.insights_reveals_used` dead column — quota SSOT is localStorage. Deferred. |
| **Violations to resolve** | BV7, S8 (deferred) |
| **Stabilization steps** | None for Phase 6 |

---

### M32 — Push Notifications

| Field | Detail |
|-------|--------|
| **Source files** | `src/features/push-notifications/PushNotificationService.ts` (468), `index.ts` (40), `types.ts` (21), `src/lib/webPush.ts` (324), `src/lib/notificationRedirect.ts` (69), `src/hooks/useNotificationRedirect.ts` (44), `src/hooks/useBadgeCount.ts` (112) |
| **Architecture compliance** | Compliant |
| **Reason** | Well-hardened after bug sweeps. `02_MODULE_ARCHITECTURE.md` §3 lists `NotificationHandler.tsx` at `src/features/push-notifications/` — file does not exist (logic likely folded into `PushNotificationService.ts`). Documentation-only issue. S3: badge table-name mismatch. Deferred. |
| **Violations to resolve** | ARCH.md doc drift (remove `NotificationHandler.tsx` from module spec) |
| **Stabilization steps** | Update `02_MODULE_ARCHITECTURE.md` §3 M32: remove `NotificationHandler.tsx` entry or annotate as "folded into PushNotificationService.ts". |
| **Behavior change** | None (doc-only) |
| **Estimated effort** | Trivial |

---

### M33 — Friends

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/friends.ts` (306), `src/lib/friendService.ts` (16), `src/components/FriendsPanel.tsx` (650), `src/components/FriendActionsMenu.tsx` (91) |
| **Architecture compliance** | Partially compliant |
| **Reason** | S6 (LOW-MEDIUM): `friends.ts` and `friendService.ts` overlap — unclear ownership. Deferred. S3 (MEDIUM): badge table-name mismatch. Deferred. |
| **Violations to resolve** | S6, S3 (deferred) |
| **Stabilization steps** | None for Phase 6 |

---

### M34 — Chat

| Field | Detail |
|-------|--------|
| **Source files** | `src/lib/messages.ts` (105), `src/components/ChatPanel.tsx` (138) |
| **Architecture compliance** | Compliant |
| **Reason** | BV9 (LOW-MEDIUM): ChatPanel directly calls `notifyChatMessage` from push-notifications — documented, deferred. |
| **Violations to resolve** | BV9 (deferred) |
| **Stabilization steps** | None for Phase 6 |

---

### M35 — Match History

| Field | Detail |
|-------|--------|
| **Source files** | `src/components/HistoryPanel.tsx` (213), `src/lib/matchHistory.ts` (167), `src/lib/moveClassifier.ts` (79) |
| **Architecture compliance** | Compliant |
| **Reason** | V7 (MEDIUM): dual storage (localStorage + DB, no reconcile) — documented, deferred. Missing `HistoryPanel.test.tsx` and `moveClassifier.test.ts` — test gaps, deferred to Phase H. |
| **Violations to resolve** | V7, test gaps (deferred) |
| **Stabilization steps** | None for Phase 6 |

---

## 4. BOUNDARY ENFORCEMENT — CURRENT STATE

| Rule | Status | Violations |
|------|--------|------------|
| UI components do not contain business logic | ❌ | BV11 (bot continuation in Game.tsx), BV12 (timeout in Game.tsx), BV13 (sound detection), BV14 (auth state machine), BV15 (promotion), BV16 (game-over save) |
| Business logic does not navigate screens | ❌ | BV17 (router.push in game-flow handlers), BV25 (game state → navigation) |
| Navigation does not modify game state | ⚠ | BV18 (room auto-join from URL params), BV19 (deep-link URL in capacitorAuth) |
| Board rendering does not resolve moves | ⚠ | BV23 (boardKey remount for cancel flow) |
| Move Resolution does not modify Premium | ✅ | No violations |
| Premium does not modify Friends | ✅ | No violations |
| Notifications do not modify Board State | ⚠ | Minimal — FEN diffs trigger sounds (BV24, render-driven) |
| Deep Linking does not modify Lobby logic directly | ⚠ | H3 — `host_team` RLS contract |
| Every module communicates through documented interfaces | ⚠ | BV6 (12+ direct `profiles` reads), BV8/BV9 (direct rooms query, direct chat→push), BV10 (eager Stockfish init), BV20–BV22 (realtime channels outside M28 factory) |

**Summary:** 18 boundary violations documented (BV1–BV25, excluding structural ones in §5.3–5.7 that overlap). All deferred to their respective refactoring phases (A–F). Zero new violations discovered beyond what P5 documented.

---

## 5. STATE CONSOLIDATION — CURRENT STATE

| SSOT State | Verdict | Owners | Phase 6 Impact |
|------------|---------|--------|----------------|
| Resolved move | ❌ | M14/M15/M16/M17 (4 impls) | No change (deferred to Phase C) |
| Move comparison | ❌ | M14/M15 (2 impls) | No change (deferred to Phase C) |
| Match timer | ❌ | M12/M15/M17/M22 (4 owners) | No change (deferred to Phase D) |
| Board FEN | ⚠ | Engine (M14/M15) + M17 aggregate | No change |
| Premium status | ⚠ | M30 + M31 fallback read | No change |
| Game status enum | ⚠ | M14/M15 (GameStatus) vs M16 (strings) | No change |
| History storage | ⚠ | localStorage + DB, no reconcile | No change |
| Settings | ⚠ | localStorage-only, layer violation (S1) | BV3 fix in Phase 6 extracts hook from lib/ |
| Profile row | ⚠ | M02 + M30 split writer | No change (deferred) |

**Action in Phase 6:** The settings layer violation (BV3/S1) is addressed by splitting `lib/settings.ts` into `lib/settingsStorage.ts` (pure) + `hooks/useSettings.ts` (React). This is a structural improvement — it does not change ownership (M03 still owns settings), but it fixes the boundary violation where `lib/` contained React code.

---

## 6. DEPENDENCY CLEANUP — CURRENT STATE

### 6.1 Reducible coupling (Phase 6 scope)

| From | To | Issue | Action |
|------|----|-------|--------|
| `features/shared/GameInterface.ts` | `features/offline/game/localGame.ts` | Shared contract imports types from one implementation (S4) | Move `GameStatus`/`MoveComparison` to `features/shared/gameTypes.ts` |
| `lib/chessUtils.ts` | `components/ChessBoard.tsx` | Data layer imports from presentation (BV5) | Move `PromotionPiece` to `features/shared/gameTypes.ts` |
| `components/Game.tsx` | Hardcoded `600` | Magic number (3+ uses → must be constant) | Import `DEFAULT_TEAM_TIMER_SECONDS` from `gameConstants.ts` |
| `components/DuelGame.tsx` | Hardcoded `600` | Magic number (2 uses) | Import `DEFAULT_TEAM_TIMER_SECONDS` from `gameConstants.ts` |

### 6.2 Remaining coupling (deferred)

- `Game.tsx` (M17) → 49 imports — EXTREME coupling deferred to Phase B/E.
- `onlineGame.ts` (M15) → 14 imports — deferred to Phase C/F.
- `providers.tsx` → 20 imports from all 5 layers — H1 (eager Stockfish init) deferred.
- Hidden dependencies H1–H10 — all deferred.

### 6.3 Unused / orphaned dependencies (deferred to Phase I)

- Render Stockfish server (`server/`)
- `DEFAULT_MOVE_TIMER_SECONDS` (unused constant)
- `_forceCreate` field in OnlineGame
- `BottomNav.tsx` (legacy mobile nav)
- `TeamIndicator.tsx` (legacy)
- `ConfirmMoveButton.tsx` (verify zero importers)
- `profiles.insights_reveals_used` (dead DB column)

---

## 7. DOCUMENTATION SYNCHRONIZATION

### 7.1 Architecture doc updates needed

| Doc | Update | Source |
|-----|--------|--------|
| `02_MODULE_ARCHITECTURE.md` §3 M20 | Rename `MoveResolvedCard.tsx` → `MoveResolvedInline.tsx` | Actual filename |
| `02_MODULE_ARCHITECTURE.md` §3 M20 | Rename `ConfirmMoveButton.tsx` → `ConfirmMoveBar.tsx` | Actual filename |
| `02_MODULE_ARCHITECTURE.md` §3 M32 | Remove `NotificationHandler.tsx` (does not exist) | Source audit |
| `02_MODULE_ARCHITECTURE.md` §3 M04 | `src/proxy.ts` → `src/middleware.ts` (DOC-03) | Source audit |
| `05_ARCHITECTURAL_REVIEW.md` §5 | Update BV1 after `features/auth/AuthGate.tsx` is moved | Post-stabilization |

### 7.2 CONTEXT.md files needing updates

| File | Issue | Severity |
|------|-------|----------|
| `src/features/bots/CONTEXT.md` | Line 24: "MultiPV=2" → actual is 6 (DOC-01) | LOW |
| `src/features/offline/game/CONTEXT.md` | Line 14: "MultiPV=2" → actual is 6 | LOW |
| `src/features/mobile-engine/CONTEXT.md` | Body text describes reverted state (MultiPV=2, lazy init) — should match 2026-08-02 revert | LOW |
| `src/features/game-engine/CONTEXT.md` | **No Recent Changes section** | MEDIUM |
| `src/app/duel/CONTEXT.md` | **No Recent Changes section** — many changes since last update | MEDIUM |
| `src/app/(main)/history/CONTEXT.md` | **No Recent Changes section**; "Spinner" → "PageLoading" | MEDIUM |
| `src/app/(main)/four-player/CONTEXT.md` | **No Recent Changes section** | LOW-MEDIUM |
| `src/app/(main)/privacy/CONTEXT.md` | Update in body text, not in formal Recent Changes section | LOW |
| `src/app/(main)/terms/CONTEXT.md` | **No Recent Changes section** | LOW |
| `src/app/(main)/delete-account/CONTEXT.md` | **No Recent Changes section** | LOW |
| `src/app/(main)/friends/CONTEXT.md` | Missing recent change entries (share button, panel→page) | LOW |
| `server/CONTEXT.md` | **No Recent Changes section**; likely obsolete | MEDIUM |
| `src/types/CONTEXT.md` | **No Recent Changes section** | LOW |
| `CONTEXT-SYSTEM.md` | SvelteKit conventions (`+page.svelte`, `apps/api/`) in hierarchy example | LOW |
| `src/app/welcome/CONTEXT.md` | Missing `WelcomeDisclaimer` / `PageLoading` references | LOW |
| `src/app/game/CONTEXT.md` | Missing recent changes (ConfirmMoveBar, PageLoading, insights, bot fix) | MEDIUM |
| `src/features/CONTEXT.md` | Summarize cross-module changes from 2026-08-02/03 | LOW |

### 7.3 DOC entries to resolve

| ID | Issue | Action |
|----|-------|--------|
| DOC-01 | MultiPV=2 documented, actual is 6 | Update 3 CONTEXT.md files (bots, offline, mobile-engine) |
| DOC-02 | `CONTEXT-SYSTEM.md` uses SvelteKit conventions | Update example hierarchy to Next.js paths |
| DOC-03 | ARCHITECTURE.md references `src/proxy.ts`; actual is `middleware.ts` | Fix ARCHITECTURE.md / 02_MODULE_ARCHITECTURE.md |
| DOC-04 | Settings "Supabase sync" documented but not implemented | Annotate as "not yet implemented" |
| DOC-05 | `profile/CONTEXT.md` has HTML entity `&amp;` in plain text | Fix to `&` |
| DOC-06 | `server/` CONTEXT.md status vs actual (orphaned) | Annotate as likely deprecated |

---

## 8. UNSTABILIZED MODULES — FUTURE WORK REQUIRED

### 8.1 Deferred to refactoring roadmap phases

| Module | Deferred work | Phase |
|--------|---------------|-------|
| M01 Auth | State machine extraction (BV14), React component split, 3-way Google paths | A |
| M02 Profile | ProfileService full adoption across 12+ call sites (BV6) | A |
| M04 Routing | God-page split (home page, premium page) | A/E |
| M07 Deep Link | Challenge page direct rooms query (H10), skeleton page states | F/G |
| M08 Room | Consolidate 3 room-creation paths, unify `ROOM_EXPIRY_MS` | A |
| M12 GameState | Un-skip test suite (T-03) | H |
| M13 Shared | No further work (type inversions fixed in Phase 6) | — |
| M14 LocalGame | Delete `resolveLegacy`, extract `ResolutionService` (D1–D3, C) | C |
| M15 OnlineGame | Split god object, extract `ResolutionService`, `TurnManager`, fix reconnect | C/F |
| M16 Duel Engine | Move to `features/duel/`, shared contract, test backfill (T-02) | E/F/H |
| M17 Game Shell | Extract 6+ hooks, `GameShell` composition (S-01, B-05, BV11–25) | B/C/E |
| M18 Duel Shell | Shared `GameShell`, dedup with M17, test backfill (T-02) | E/H |
| M20 Resolution | Single `ResolutionService`, `TurnManager` (V3, D1–D3) | C |
| M22 Timer | Single `TimerService`, end 4-owner split (V1, D4, R18) | D |
| M27 Supabase | Regenerate `Database` type (R-02, R-05) | G |
| M28 Realtime | Channel factory enforcement (BV22) | F |
| M29 API | Structured logging (R-04) | I |
| M31 Insights | Premium bypass fallback fix (BV7) | B (boundary fix) |
| M33 Friends | Resolve `friends.ts`/`friendService.ts` overlap (S6) | A |
| RLS | Tighten `room_players`/`games` policies (R-01) | G |
| Tests | 22 skipped suites + M17/M18/M16/M12 test backfill (T-01..T-09) | H |
| Orphans | Remove Render server + dead code (DOC-06, §3.5) | I |

### 8.2 Modules requiring NO future work (stabilized)

| Module | Status |
|--------|--------|
| M05 Mobile Nav | Compliant; no violations |
| M06 Capacitor | Compliant; BV19 deferred but low-priority |
| M09 Matchmaking | Compliant; scalability note only |
| M10 4-Player | Compliant |
| M11 Lobby UI | Compliant |
| M19 ChessBoard | Compliant; minor style cleanup deferred |
| M21 Turn Mgmt | Compliant |
| M23 Stockfish | Compliant |
| M24 Bot | Compliant; doc-only fix |
| M25 Playback | Compliant |
| M26 Persistence | Compliant; test gaps deferred |
| M30 Billing | Fully compliant |
| M32 Push | Compliant; doc-only fix |
| M34 Chat | Compliant; BV9 deferred |
| M35 History | Compliant; test gaps + dual storage deferred |

---

## 9. STABILIZATION PLAN SUMMARY

### 9.1 Phase 6 immediate actions (mechanical, zero risk)

| # | Action | Module | Effort | Risk |
|---|--------|--------|--------|------|
| 1 | Move `features/auth/AuthGate.tsx` → `components/AuthGate.tsx` | M01 | Small | LOW |
| 2 | Move `features/auth/useAuthSession.ts` → `hooks/useAuthSession.ts` | M01 | Small | LOW |
| 3 | Split `lib/settings.ts` → `lib/settingsStorage.ts` + `hooks/useSettings.ts` | M03 | Small | LOW |
| 4 | Move `GameStatus`/`MoveComparison`/`PromotionPiece` → `features/shared/gameTypes.ts` | M13/M14/M19 | Small | LOW |
| 5 | Replace hardcoded `600` with `DEFAULT_TEAM_TIMER_SECONDS` in Game.tsx (2×) | M17 | Trivial | LOW |
| 6 | Replace hardcoded `600` with `DEFAULT_TEAM_TIMER_SECONDS` in DuelGame.tsx (2×) | M18 | Trivial | LOW |
| 7 | Fix `(evaluator as any).getInitError()` in Game.tsx | M17 | Trivial | LOW |
| 8 | Extract `CapturedPiecesDisplay` from Game.tsx → standalone component | M17/M19 | Small-Med | MEDIUM |
| 9 | Extract `PromotionModal` from Game.tsx → standalone component | M17 | Small-Med | MEDIUM |
| 10 | Fix DOC-01: Update 3 CONTEXT.md files (MultiPV=2→6) | M23/M24/M14 | Trivial | NONE |
| 11 | Fix DOC-02: Update CONTEXT-SYSTEM.md (SvelteKit→Next.js) | root | Trivial | NONE |
| 12 | Fix DOC-03: ARCHITECTURE.md proxy→middleware | M04 | Trivial | NONE |
| 13 | Add "Recent Changes" to 12 CONTEXT.md files | Multiple | Small | NONE |
| 14 | Fix DOC-05: `&amp;` → `&` | M02 (profile) | Trivial | NONE |
| 15 | Annotate DOC-06: server/ likely deprecated | server/ | Trivial | NONE |
| 16 | Update 02_MODULE_ARCHITECTURE.md: fix component names (M20), remove NotificationHandler (M32) | P2 doc | Trivial | NONE |

### 9.2 Execution order (if implemented sequentially)

1. **DOC fixes first** (items 10–16) — zero behavior risk, establish the correct reference state.
2. **Constants + type fixes** (items 5–7) — mechanical, low risk, no file moves.
3. **Layer fixes** (items 1–4) — component/hook moves with import updates in single PRs.
4. **Inline extraction** (items 8–9) — moderate risk; verify all closure references.

### 9.3 Quality gates (per action)

- `npx tsc --noEmit` must pass after every change.
- `npm test` must have no new failures.
- Affected CONTEXT.md files updated with Recent Changes entry.
- Manual smoke of affected mode (online/offline/duel as applicable).

---

## 10. APPENDIX

### 10.1 Module compliance summary (35 modules)

| Module | Status | Phase 6 Action |
|--------|--------|----------------|
| M01 Auth | ⚠ | Move components (BV1/BV2) |
| M02 Profile | ⚠ | Doc-only (DOC-05) |
| M03 Settings | ⚠ | Split `lib/settings.ts` (BV3) |
| M04 Routing | ⚠ | Doc-only (DOC-03) |
| M05 Mobile Nav | ✅ | None |
| M06 Capacitor | ✅ | None |
| M07 Deep Link | ✅ | None |
| M08 Room Mgmt | ⚠ | Deferred |
| M09 Matchmaking | ✅ | None |
| M10 4-Player | ✅ | None |
| M11 Lobby UI | ✅ | None |
| M12 GameState | ✅ | None |
| M13 Shared | ⚠ | Move shared types (BV5/S4) |
| M14 LocalGame | ⚠ | Doc-only (DOC-01); deferred |
| M15 OnlineGame | ⚠ | Deferred |
| M16 Duel Engine | ⚠ | Deferred |
| M17 Game Shell | ❌ | Constants + inline extraction |
| M18 Duel Shell | ⚠ | Constants |
| M19 ChessBoard | ✅ | Doc-only (name fix) |
| M20 Resolution | ⚠ | Doc-only (name fix); deferred |
| M21 Turn Mgmt | ✅ | None |
| M22 Timer | ⚠ | Deferred |
| M23 Stockfish | ✅ | Doc-only (DOC-01) |
| M24 Bot | ✅ | Doc-only (DOC-01) |
| M25 Playback | ✅ | None |
| M26 Persistence | ✅ | None |
| M27 Supabase | ✅ | None |
| M28 Realtime | ⚠ | Deferred |
| M29 API Infra | ✅ | None |
| M30 Billing | ✅ | None |
| M31 Insights | ⚠ | Deferred |
| M32 Push | ✅ | Doc-only (remove NotificationHandler) |
| M33 Friends | ⚠ | Deferred |
| M34 Chat | ✅ | None |
| M35 History | ✅ | None |

**Legend:** ✅ compliant (no Phase 6 action needed), ⚠ partially compliant (doc-only or minor fix), ❌ not compliant (structural fix needed)

### 10.2 Cross-reference

- P1: `01_REPOSITORY_DISCOVERY.md` — repository overview, technology stack, known risks.
- P2: `02_MODULE_ARCHITECTURE.md` — M01–M35 specs, ownership, boundaries, dependency analysis.
- P3: `03_STATE_OWNERSHIP.md` — V1–V10 violations, SSOT verdicts, state lifecycle.
- P4: `04_EVENT_FLOW.md` — E01–E50 events, R1–R18 races, ordering rules.
- P5: `05_ARCHITECTURAL_REVIEW.md` — BV1–BV25, D1–D23, 61-item debt register, health score 42/100.
- P6 Part 2: `06_REFACTORING_ROADMAP.md` — Phases A–I, migration strategy, acceptance criteria.

### 10.3 Remaining risk register (post-stabilization)

| # | Risk | Severity | Deferred To |
|---|------|----------|-------------|
| 1 | `resolveLegacy` full duplication (D1) | CRITICAL | Phase C |
| 2 | Game.tsx untested (T-01) | CRITICAL | Phase H |
| 3 | DuelGame.tsx/duelGame.ts zero tests (T-02) | CRITICAL | Phase H |
| 4 | "Allow all" RLS on `room_players`/`games` (R-01) | HIGH | Phase G |
| 5 | 4 timer owners + dual-timer race (V1/R18) | HIGH | Phase D |
| 6 | 4 move-resolution implementations (V3) | HIGH | Phase C |
| 7 | Game.tsx god object (S-01) | HIGH | Phases B/C/E |
| 8 | Broadcast ordering race R1 | HIGH | Phase F |
| 9 | ~1,950 test lines skipped | HIGH | Phase H |
| 10 | Reconnect state overwrite (R2) | HIGH | Phase F |
| 11 | `profiles` direct reads in 12+ UI sites (BV6) | HIGH | Phase A |
| 12 | Settings hook in `lib/` (BV3) | HIGH | Phase 6 |
| 13 | `features/auth/` React components (BV1/BV2) | HIGH | Phase 6 |

---

### Phase 6 Complete

This document is **documentation only**. No implementation was modified. Stabilization actions identified above are **not yet executed** — they represent the blueprint for the first implementation workstream.

**The architecture compliance score remains at 42/100.** Target after stabilization: **~50/100**. Full project target (Phases A–I complete): **≥70/100**.
