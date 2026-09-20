# DB / Network Performance Audit — static baselines (PERF-01, Phase 0)

> Branch: `perf/db-network-optimization`. Scope: measure-only instrumentation, zero behavior change.
> Governing rules: `docs/ARCHITECTURE.md` §12 (§12 single-bundle + narrow columns), §13 (single-flight caches),
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

## Static baselines (trips counted from source)

| Surface | Trips / mount or tick | Interval | Finding |
|---|---|---|---|
| Duel poll (`duelGame.ts:281`) | 1× `duel_games.select('*')` / tick | 2s | VIOLATION §12: `*` on poll; narrow to `status,player_black` (Phase 1) |
| Matchmaking tick (`MatchmakingQueue.tsx:87`) | `findAvailableRoom` (1 rooms + ≤4 parallel RPCs) + `checkMyRoomJoined` + `rooms.select('*')` ≈ up to 7 / tick | 3s | VIOLATION §12: `*` in poll; no overlap guard (Phase 1+3) |
| Four-player tick (`FourPlayerLobby.tsx:137`) | `fetchPlayers` (2 trips) + `rooms.select(status)` = 3 / tick | 2s | SUSPECT: narrow but poll-heavy; overlap guard first (Phase 3) |
| Room routing (`page.tsx:444`) | 1–2× `rooms.select('*')` (code + id fallback) / join | on demand | VIOLATION §12: narrow to `id,code,mode,time_seconds` (Phase 1) |
| History bundle (`matchHistory.ts:262`) | 1× memberships + 1× games (narrow, no JSONB) / load | on demand | OK per §12; memberships needs server `.limit(200)` (Phase 1) |
| Friends bundle (`friends.ts:137`) | 1× friendships + 1× profiles.in / load | on demand | OK per §12; FriendsPanel chains `loadChallenges()` sequentially (Phase 2) |
| Online polls (`onlineGame.ts:860,1053,1288`) | 3× `select('*')` sites | gameplay | VIOLATION §12: narrow to `player_id,team,status` / submission cols (Phase 1, ADR-006 safe) |
| Challenge list (`challenges.ts:108`) | `select('*').limit(20)` | on demand | VIOLATION §12: narrow list cols (Phase 1) |
| Four-player room lookup (`fourPlayerActions.ts:236`) | `rooms.select('*')` | on demand | VIOLATION §12: narrow (Phase 1) |
| Messages (`messages.ts:67,84`) | uncapped sender/content selects | on demand | SUSPECT: cap `.limit(200)` (Phase 1) |

## Runtime measurements (fill via `?debug=1`)

| Metric | Before | After | Method |
|---|---|---|---|
| Duel poll duration / overlap count | TODO | — | `[PERF] duel poll` + `pollOverlaps` |
| Matchmaking tick duration / overlap | TODO | — | `[PERF] matchmaking tick` |
| Four-player tick duration / overlap | TODO | — | `[PERF] fourplayer tick` |
| Room-code resolve duration | TODO | — | `[PERF] room-routing resolve` |
| History bundle duration | TODO | — | `[PERF] history bundle` |
| Friends bundle duration | TODO | — | `[PERF] friends bundle` |
| `npx tsc --noEmit` | must pass | — | per commit |
| `npm test` | no new failures | — | per commit |
| `npm run build` | must pass | — | per phase |

## Stop conditions honored

No schema/RLS/RPC-volatility change; no auth/OAuth/PKCE/deep-link change; no game-sync
semantic change (ADR-005/006); no billing/ads/push touch; no new state/data framework;
no generic DB abstraction. Phase 1+ only for items with measured evidence above.
