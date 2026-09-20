# DB / Network Performance Audit — static baselines (PERF-01 Phase 0 + PERF-02/03 results)

> Branch: `perf/db-network-optimization`.
> Governing rules: `docs/ARCHITECTURE.md` §12 (single-bundle + narrow columns), §13 (single-flight caches),
> §8/§8.1 (RLS-safe join, canonical RPC path), ADR-007 (round-trips over indexes).
> This file does NOT replace `performance-audit.md` (UI audit, 2026-09-15) — it tracks DB/network work.
> No runtime numbers below are manufactured: trip counts are counted from source; timing TODOs are
> filled via `?debug=1` runs (`[PERF]`, `[PERF][DB]`, `[PERF][POLL]` logs + `window.__CHESS_PERF__`).

## Instrumentation added (PERF-01)

Extended `src/lib/perfHarness.ts` (existing DEBUG-gated harness — no new framework):
`dbRequests` / `pollTicks` / `pollOverlaps` counters, `incDbRequest`, `incPollTick`,
`startMark`/`logTiming`, `tryEnterPoll`/`exitPoll` (measure-only: overlaps counted, never skipped).
Measure points: duel poll, matchmaking tick, four-player tick, room-code routing,
history bundle, friends bundle. All no-ops in production without `?debug=1`.
Test: `src/lib/__tests__/perfHarness.test.ts` (5 tests, TDD red→green).

## Findings (trips counted from source; ✅ = fixed, ⏸ = intentionally stopped)

| Surface | Trips / mount or tick | Interval | Finding |
|---|---|---|---|
| Duel poll (`duelGame.ts`) | 1× `duel_games` / tick, overlap-skipped | 2s | ✅ PERF-02: `*` → `status,player_black`. ✅ PERF-05: slow ticks never stack (skip + `pollOverlaps` telemetry); start detection + realtime untouched. Hidden poll kept (game-start latency matters; browser throttles anyway) |
| Matchmaking tick (`MatchmakingQueue.tsx:87`) | `findAvailableRoom` (1 rooms + ≤4 parallel RPCs) + `checkMyRoomJoined` + `rooms` / tick, overlap-skipped, hidden-paused | 3s | ✅ PERF-02: `rooms` `*` → `id,code`. ✅ PERF-03: `checkMyRoomJoined` + `.limit(2)`, room-create → `id,code`. ✅ PERF-05: overlap skip + no hidden-tab polling (pre-game UI only; resumes next foreground tick) |
| Four-player tick (`FourPlayerLobby.tsx:137`) | `fetchPlayers` (2 trips) + `rooms.select(status)` = 3 / tick, overlap-skipped, hidden-paused | 2s | ✅ PERF-05: overlap skip + no hidden-tab polling (pre-game lobby only; resumes next foreground tick). Realtime replacement deferred — would need architecture proof per STOP rules |
| Room routing (`page.tsx:444`) | 1–2× `rooms` (code + id fallback) / join | on demand | ✅ PERF-02: `*` → `id,code,mode,time_seconds` (all consumed) |
| History bundle (`matchHistory.ts:262`) | 1× memberships + 1× games (narrow, no JSONB) / load | on demand | ✅ PERF-02: memberships + server `.limit(200)` (= `MAX_ROOM_LOOKUP` cap, identical semantics) |
| Friends bundle (`friends.ts:137`) | 1× friendships + 1× profiles.in / load | on demand | ✅ PERF-04: bundle + `loadChallenges()` launched together (independent tables/state; bundle still gates `setLoading`). Test: concurrency assertion in `FriendsPanel.test.tsx` (TDD red→green) |
| Online polls (`onlineGame.ts`) | 3 narrow sites | gameplay | ✅ PERF-03: start-gate + sync roster → `player_id,team` (`status` lived only in a DEBUG log, dropped there); restore → `player_id,turn_number,move_san,move_from,move_to,piece` (exactly `handleSubmissionFromDB`'s reads; unused `game_id` trimmed from its private param). ADR-006 untouched |
| Challenge room pre-create (`challenges.ts:37`, `challenge/[code]/client.tsx:101`) | 1× rooms insert-return each | on demand | ✅ PERF-02: `*` → `id` / `id,code` (only cols consumed) |
| Four-player join (`fourPlayerActions.ts:234`) | 1× rooms / join | on demand | ✅ PERF-02: `*` → `id,code,time_seconds` (only cols consumed) |
| Challenge list (`challenges.ts:108`) | `select('*').limit(20)` | on demand | ⏸ STOP: no production caller (only its own test) — zero user impact |
| Challenge detail (`challenges.ts:63,86`) | single-row `select('*')` | on demand | ⏸ STOP: `ChallengeLink` return-type contract — narrowing changes public shape |
| Messages (`messages.ts:65,82`) | uncapped sender/content selects | on demand | ⏸ STOP: `getUnreadCounts` has no caller; challenge volume tiny — cap would change semantics without evidence |

## Phase 2 parallelization verdicts (PERF-04)
- ✅ FriendsPanel `loadData`: bundle + challenges concurrent (proven: separate tables, separate setters, timing preserved).
- ✅ Game team labels: white + black username fetches via `Promise.all` (proven: same-table independent reads, merged afterwards; no component harness exists for this path — guarded by tsc + suite).
- ⏸ STOP `handleAcceptChallenge` (room upsert → duel update → mark-read): independent tables but sequential WRITES — parallelizing would change partial-failure semantics. Left sequential.
- ⏸ STOP ProfilePanel: history effect and status/profile effect already run concurrently; `getMatchHistory(5)` vs `getHistoryPageWithStats(5)` is trip-identical (same bundle). No win available.

## Runtime measurements (fill via `?debug=1`)

| Metric | Before | After | Method |
|---|---|---|---|
| Duel poll duration / overlap count | TODO | — | `[PERF] duel poll` + `pollOverlaps` |
| Matchmaking tick duration / overlap | TODO | — | `[PERF] matchmaking tick` |
| Four-player tick duration / overlap | TODO | — | `[PERF] fourplayer tick` |
| Room-code resolve duration | TODO | — | `[PERF] room-routing resolve` |
| History bundle duration | TODO | — | `[PERF] history bundle` |
| Friends bundle duration | TODO | — | `[PERF] friends bundle` |
| `npx tsc --noEmit` | must pass | ✅ PERF-01→06 + ADS-01→04 (1 pre-existing env error) | per commit |
| `npm test` | no new failures | ✅ PERF-01→06 + ADS-01→04 (baseline-identical, 1510 passed) | per commit |
| `npm run build` | must pass | ⛔ BLOCKED (pre-existing: uninstalled native packages) | per phase |

## Phase 4 session/waterfall verdicts (PERF-06)

- ✅ Removed dead `supabase` imports in `game/page.tsx` + `duel/page.tsx` (zero references; hygiene only).
- ⏸ STOP `usePremium` double `getSession()`: same-tick calls collapse via AuthService single-flight (proven no-op gain); outer call owns the signed-out fast path — removing it risks premium fail-closed semantics.
- ⏸ STOP game/duel/coach session-gated render: unblocking the dynamic chunk before identity validation risks mounting the engine with the wrong player + redirect races with pending room/invite actions. Needs runtime proof + auth review first.
- ⏸ STOP middleware: already `/history`-only; no measured latency attributable to it.

## Stop conditions honored
No schema/RLS/RPC-volatility change; no auth/OAuth/PKCE/deep-link change; no game-sync
semantic change (ADR-005/006); no billing/ads/push touch; no new state/data framework;
no generic DB abstraction.
