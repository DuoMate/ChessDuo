# ChessDuo Realtime Load Test (P0-3)

Executed against **staging** (Supabase). Never run against production.

## What it measures
The `scripts/loadtest/run.mjs` harness drives real Supabase Realtime + DB +
RLS for N concurrent games (10 / 25 / 50 / 100). It isolates the
transport/data layer (no browser, no Stockfish WASM), which is exactly the
capacity surface this test targets. For in-app channel counts, also run the
browser procedure below.

## Prerequisites
1. Staging Supabase on **Pro** (confirm the Realtime connection limit in the
   dashboard — this is the number the test validates against).
2. Seeded accounts: usernames `player1..playerN`, emails
   `player1@example.com..`, all with the same known password.
3. Apply `supabase/tables.sql` + `supabase/migrations/db_cleanup.sql` to
   staging first (the P0-1 RLS policies are required — the harness exercises
   the authenticated paths).

## Run
```bash
export SUPABASE_URL=https://<project>.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
export TEST_USER_BASE=player
export TEST_USER_PASSWORD=<pw>
export TEST_USERS=200

node scripts/loadtest/run.mjs --games 10  --turns 6
node scripts/loadtest/run.mjs --games 25  --turns 6
node scripts/loadtest/run.mjs --games 50  --turns 6
node scripts/loadtest/run.mjs --games 100 --turns 6
```

Each run prints a JSON summary:
`peakConcurrentChannels`, `subscribeLatencyMs.p50/p95`,
`dbWriteLatencyMs.p50/p95`, `channelErrorCount`, `failedGames`, `stuckGames`,
`durationMs`.

## In-app metric capture (browser)
For the actual client channel profile, build web with diagnostics enabled and
drive a few games in Chromium:

```bash
NEXT_PUBLIC_CHESSDUO_DIAGNOSTICS=true npm run build
```

Then read the counters from any open tab during/after a game:

```js
// in DevTools console:
window.__chessDuoRealtime.getReport()
// => { active, peak, created, removed, subscribed, channelErrors,
//      closed, subscribeErrors, reconnectAttempts, reconnectSuccess,
//      recoveryLatencyMs:{count,p50,p95,max}, byType }
```

Reset before a run: `window.__chessDuoRealtime.reset()`.

## DB-side metrics to record per run (Supabase dashboard + pg_stat_statements)
- Realtime connection count at peak (compare to the plan limit).
- Realtime events/s.
- DB time share attributable to realtime `list_changes` / WAL.
- Slowest queries in `completed_games`, `room_players`, `turn_submissions`,
  `games`, `messages` during the window.

## Pass gates (do NOT rely on theoretical numbers)
| Metric | Pass | Concern |
|--------|------|---------|
| peak channels | < 80% of confirmed plan limit | >80% = capacity risk |
| subscribe latency p95 | < 5s | CHANNEL_ERROR storm if higher |
| db write latency p95 | < 2s | resolution stalls |
| channelErrorCount | < 1% of subscribes | reconnect amplification |
| failedGames / stuckGames | 0 at 100 games | launch blocker if > 0 |
| realtime share of DB time | < 60% | WAL scan cost |

## Report
After each of the 4 runs, record the exact numbers into the P0-3 status:
do not mark P0-3 COMPLETE until all four runs are executed, the numbers are
captured, and the 100-game run meets the pass gates.
