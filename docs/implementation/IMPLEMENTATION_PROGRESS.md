# ChessDuo Implementation Progress

> **Single source of truth.** Updated after every module completion.
> **Last updated:** 2026-08-03
> **Active branch:** `architecture-refactor`
> **Last commit:** `2bf09be`

---

## Overall Metrics

| Metric | Value |
|--------|-------|
| Total Modules (roadmap) | 17 |
| Completed | 8 |
| In Progress | 0 |
| Remaining | 9 |
| Overall Progress | 47% |
| Current Architecture Score | 42/100 |
| Current Regression Risk | HIGH (no test shield) |
| Production Readiness | 38/100 |
| Active Production Bugs | 38 (5 CRITICAL, 17 HIGH) |

---

## Current Roadmap

| # | Module | Priority | Status | Branch | Commit | Bugs |
|:-:|--------|:--------:|:------:|--------|:------:|------|
| 1 | M15 OnlineGame test backfill | 81.8 | ✅ Completed | `test/onlinegame-broadcast-reconnect-lock` | `b3d91ff` | R1,R2,R3 |
| 2 | M12 GameState un-skip tests | 73.0 | ✅ Completed | `architecture-refactor` | `5f9dd07` | T-03 |
| 3 | M15 R3 lock timeout fix | 72.3 | ✅ Completed | `test/onlinegame-broadcast-reconnect-lock` | `7ca7cd2` | R3 |
| 4 | M14 D1 delete resolveLegacy | 62.3 | ✅ Completed | `architecture-refactor` | `405e2e0` | S-04,D1 |
| 5 | M08 Room D7/V8 dedup | 58.0 | ✅ Completed | `architecture-refactor` | `3782ba9` | D7,V8 |
| 6 | M17 Game.tsx critical-path tests | 73.8 | ✅ Completed | `architecture-refactor` | `42c5efd` | S-01,B-05,B-06 |
| 7 | M15 R1 broadcast ordering fix | 68.0 | ✅ Completed | `architecture-refactor` | `bee09e2` | R1 |
| 8 | M16/M18 Duel engine + shell tests | 64.8 | Not Started | `test/duel-engine-shell` | — | T-02 |
| 9 | M15 R2 reconnect merge fix | 59.0 | Not Started | `fix/onlinegame-reconnect-merge` | — | R2,R10 |
| 10 | M07 Deep Link skeleton pages | 55.3 | Not Started | `fix/deeplink-skeleton-pages` | — | H10 |
| 11 | M02 Profile BV6 adoption | 50.8 | Not Started | `refactor/profile-service-adoption` | — | — |
| 12 | M33 Friends S6 consolidation | 49.5 | Not Started | `refactor/friends-consolidation` | — | R5,R14 |
| 13 | M31 Insights BV7 fix | 47.3 | Not Started | `fix/insights-premium-bypass` | — | — |
| 14 | M28 Realtime BV22 factory | 46.3 | Not Started | `refactor/realtime-channel-factory` | — | — |
| 15 | M13 Shared Types relocation | 45.5 | Not Started | `refactor/shared-types-relocation` | — | — |
| 16 | M04 Browser Routing middleware | 43.0 | Not Started | `refactor/browser-routing-guards` | — | — |
| 17 | M22 Timer R4/R18 unification | 40.8 | Not Started | `refactor/timer-unification` | — | R4,R18 |

---

## Completed Modules

### M01 — Auth (BV1/BV2)

| Field | Value |
|-------|-------|
| Status | ✅ Completed |
| Date | 2026-08-03 |
| Commit | `2bf09be` |
| Branch | `architecture-refactor` |
| Report | `docs/implementation/M01_AUTH.md` |
| Files Changed | 8 (2 created, 2 deleted, 4 edited) |
| Net Lines | −137 |
| Behaviour Changes | None |
| Regression Risk | None |
| Testing | tsc green, 985/993 pass (8 pre-existing) |
| Architecture Rules | BV1 (React→components/), BV2 (hook→hooks/) |
| Bugs Addressed | BV1, BV2 |
| Lessons Learned | Thin re-export wrappers make migration trivial. Grep both path aliases and relative imports. |

### M03 — Settings (BV3)

| Field | Value |
|-------|-------|
| Status | ✅ Completed |
| Date | 2026-08-03 |
| Commit | `2bf09be` |
| Branch | `architecture-refactor` |
| Report | `docs/implementation/M03_SETTINGS.md` |
| Files Changed | 15 (2 created, 1 deleted, 12 edited) |
| Net Lines | −7 |
| Behaviour Changes | None |
| Regression Risk | None |
| Testing | tsc green, 985/993 pass (8 pre-existing) |
| Architecture Rules | BV3 (React hook→hooks/, pure utils stay in lib/) |
| Bugs Addressed | BV3 |
| Lessons Learned | test mocks use string literals — grep for jest.mock paths separately from imports. |

---

## Current Active Module

| Field | Value |
|-------|-------|
| Current Phase | Position 1 — M15 OnlineGame test backfill |
| Current Branch | `test/onlinegame-broadcast-reconnect-lock` (to be created) |
| Current Objective | Write test scenarios for R1, R2, R3 |
| Current Risks | None (tests only, additive) |
| Pending Validation | tsc + npm test green on new tests |

---

## Remaining Modules

```
Position  1: M15 OnlineGame test backfill         ← CURRENT
Position  2: M12 GameState un-skip tests
Position  3: M15 R3 lock timeout fix
Position  4: M14 D1 delete resolveLegacy
Position  5: M08 Room D7/V8 dedup
Position  6: M17 Game.tsx critical-path tests
Position  7: M15 R1 broadcast ordering fix
Position  8: M16/M18 Duel engine + shell tests
Position  9: M15 R2 reconnect merge fix
Position 10: M07 Deep Link skeleton pages
Position 11: M02 Profile BV6 adoption
Position 12: M33 Friends S6 consolidation
Position 13: M31 Insights BV7 fix
Position 14: M28 Realtime BV22 factory
Position 15: M13 Shared Types relocation
Position 16: M04 Browser Routing middleware
Position 17: M22 Timer R4/R18 unification
```

---

## Bug Reduction Progress

| Bug | Severity | Status | Owning Module | Position |
|-----|:--------:|:------:|---------------|:--------:|
| R1 — broadcast ordering | HIGH | Pending | M15 OnlineGame | 1, 7 |
| R2 — reconnect overwrite | HIGH | Pending | M15 OnlineGame | 1, 9 |
| R3 — lock timeout hang | HIGH | Pending | M15 OnlineGame | 1, 3 |
| R4 — timer drift | HIGH | Pending | M22 Timer | 17 |
| R5 — badge duplications | MED | Pending | M33 Friends | 12 |
| R10 — reconnect double-sync | MED | Pending | M15 OnlineGame | 9 |
| R14 — friends table mismatch | LOW-MED | Pending | M33 Friends | 12 |
| R18 — dual-timer race | MED | Pending | M22 Timer | 17 |
| S-04/D1 — resolveLegacy dup | CRITICAL | ✅ Resolved | M14 LocalGame | 4 |
| T-01 — Game.tsx zero tests | CRITICAL | ✅ Resolved | M17 Game.tsx | 6 |
| T-02 — Duel zero tests | CRITICAL | Pending | M16/M18 | 8 |
| T-03 — gameState suite skipped | HIGH | ✅ Resolved | M12 GameState | 2 |
| T-05 — reconnect untested | HIGH | Pending | M15 OnlineGame | 1 |
| T-06 — broadcast ordering untested | HIGH | Pending | M15 OnlineGame | 1 |
| H10 — challenge queries rooms | MED | Pending | M07 Deep Link | 10 |
| BV1 — features/auth/ React | HIGH | ✅ Resolved | M01 Auth | (done) |
| BV2 — features/auth/ hook | HIGH | ✅ Resolved | M01 Auth | (done) |
| BV3 — lib/settings.ts hook | HIGH | ✅ Resolved | M03 Settings | (done) |
| BV5 — shared types inversion | MED | Pending | M13 Shared Types | 15 |
| BV6 — profiles bypass | HIGH | Pending | M02 Profile | 11 |
| BV7 — premium bypass | LOW | Pending | M31 Insights | 13 |
| BV22 — channel factory bypass | LOW | Pending | M28 Realtime | 14 |
| D7 — room creation dup | MED | ✅ Resolved | M08 Room | 5 |
| V8 — expiry constants dup | MED | ✅ Resolved | M08 Room | 5 |
| S6 — friends overlap | MED | Pending | M33 Friends | 12 |

**Summary:** 9 resolved, 17 pending, 0 in progress.

---

## Architecture Metrics

| Metric | Current | Target |
|--------|:-------:|:------:|
| Architecture Health Score | 42/100 | 70/100 |
| Documentation Coverage | 61% | 100% |
| State Ownership (SSOT) | 40/100 | 80/100 |
| Module Compliance (avg) | 61% | 80% |
| Active Layer Violations | 3 (BV4, BV5, BV6) | 0 |
| Technical Debt Items | 61 | ≤30 |
| CONTEXT.md Staleness | 11 files | 0 |

---

## Release Readiness

| Gate | Status |
|------|:------:|
| Architecture Complete | ❌ 38/100 |
| Core Modules Complete | ❌ 2 of 17 |
| Critical Bugs Remaining | 5 (S-04, T-01, T-02, R-01, T-05) |
| Regression Tests | ❌ 0 critical-path tests |
| Test Shield in Place | ❌ 22 describe.skip blocks |
| 4-Mode Smoke Matrix | ❌ Not run after M01/M03 |
| Play Store Ready | ❌ |
| Production Ready | ❌ |
